package submissions

import (
	"context"
	"database/sql"
	"errors"
	"os"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/mshipilov5/Ryadom_spbu/backend/internal/migrate"
)

func TestPostgresPublicationLifecycle(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set TEST_DATABASE_URL to test the submissions store against PostgreSQL")
	}
	ctx := context.Background()
	config, err := pgx.ParseConfig(url)
	if err != nil {
		t.Fatal(err)
	}
	adminDB := stdlib.OpenDB(*config)
	t.Cleanup(func() { _ = adminDB.Close() })

	schema := "submissions_test_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	schemaSQL := pgx.Identifier{schema}.Sanitize()
	if _, err := adminDB.ExecContext(ctx, "CREATE SCHEMA "+schemaSQL); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := adminDB.ExecContext(ctx, "DROP SCHEMA "+schemaSQL+" CASCADE"); err != nil {
			t.Error(err)
		}
	})

	config.RuntimeParams["search_path"] = schema
	db := stdlib.OpenDB(*config)
	t.Cleanup(func() { _ = db.Close() })
	if err := migrate.Up(ctx, db); err != nil {
		t.Fatal(err)
	}
	createUser := func(username string) string {
		t.Helper()
		var id string
		if err := db.QueryRowContext(ctx, `
			INSERT INTO auth_users (username, display_name, password_hash)
			VALUES ($1, $1, 'test') RETURNING id::text`, username).Scan(&id); err != nil {
			t.Fatal(err)
		}
		return id
	}
	author := createUser("test-author")
	reviewer := createUser("test-reviewer")
	store := New(db)

	wall, err := store.Create(ctx, "wall", author, "", "Сообщение")
	if err != nil {
		t.Fatal(err)
	}
	public, err := store.List(ctx, "wall", "public", "")
	if err != nil || len(public) != 0 {
		t.Fatalf("pending wall entry publicly visible: %+v (%v)", public, err)
	}
	if err := store.Review(ctx, "wall", wall, reviewer, "approved", 0); err != nil {
		t.Fatal(err)
	}
	public, err = store.List(ctx, "wall", "public", "")
	if err != nil || len(public) != 1 || public[0].ID != wall {
		t.Fatalf("approved wall entry missing: %+v (%v)", public, err)
	}

	id, err := store.Create(ctx, "article", author, "Заголовок", "Первая редакция")
	if err != nil {
		t.Fatal(err)
	}
	assertPublicArticle := func(expectedBody string) {
		t.Helper()
		var body, reviewedBy string
		err := db.QueryRowContext(ctx, `
			SELECT body, reviewer FROM materials
			WHERE slug = $1 AND status = 'published'`, "article-"+id).Scan(&body, &reviewedBy)
		if expectedBody == "" {
			if !errors.Is(err, sql.ErrNoRows) {
				t.Fatalf("unapproved article is public: %q (%v)", body, err)
			}
			return
		}
		if err != nil || body != expectedBody || reviewedBy != "test-reviewer" {
			t.Fatalf("public article body=%q reviewer=%q (%v)", body, reviewedBy, err)
		}
	}

	assertPublicArticle("")
	if err := store.Review(ctx, "article", id, author, "approved", 1); !errors.Is(err, ErrOwnArticleReview) {
		t.Fatalf("self-review returned %v", err)
	}
	if err := store.Review(ctx, "article", id, reviewer, "approved", 1); err != nil {
		t.Fatal(err)
	}
	assertPublicArticle("Первая редакция")
	if err := store.Review(ctx, "article", id, reviewer, "rejected", 1); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("repeat review returned %v", err)
	}
	if err := store.ReviseArticle(ctx, id, reviewer, "Чужая статья", "Чужая редакция"); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("edit by non-owner returned %v", err)
	}
	if err := store.ReviseArticle(ctx, id, author, "Новый заголовок", "Новая редакция"); err != nil {
		t.Fatal(err)
	}
	assertPublicArticle("")
	if err := store.Review(ctx, "article", id, reviewer, "approved", 1); !errors.Is(err, ErrStaleRevision) {
		t.Fatalf("stale review returned %v", err)
	}
	assertPublicArticle("")
	queue, err := store.List(ctx, "article", "queue", "")
	if err != nil || len(queue) != 1 || queue[0].Revision != 2 {
		t.Fatalf("revised entry missing from queue: %+v (%v)", queue, err)
	}
	if err := store.Review(ctx, "article", id, reviewer, "approved", queue[0].Revision); err != nil {
		t.Fatal(err)
	}
	assertPublicArticle("Новая редакция")
	if err := store.DeleteArticle(ctx, id, author); err != nil {
		t.Fatal(err)
	}
	assertPublicArticle("")
}
