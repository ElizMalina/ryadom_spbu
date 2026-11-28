package submissions

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"
)

var (
	ErrOwnArticleReview = errors.New("clinical reviewer cannot approve their own article")
	ErrStaleRevision    = errors.New("article changed since it was opened for review")
)

type Submission struct {
	ID         string
	Kind       string
	AuthorID   string
	AuthorName string
	Title      string
	Body       string
	Status     string
	CreatedAt  time.Time
	Revision   int
}

type Store struct {
	db *sql.DB
}

func New(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) List(ctx context.Context, kind, view, userID string) ([]Submission, error) {
	query := `
		SELECT s.id::text, s.kind, s.author_id::text, u.display_name, COALESCE(s.title, ''),
		       s.body, s.status, s.created_at, s.revision
		FROM content_submissions s JOIN auth_users u ON u.id = s.author_id
		WHERE s.kind = $1`
	args := []any{kind}
	switch view {
	case "public":
		query += " AND s.kind = 'wall' AND s.status = 'approved'"
	case "queue":
		query += " AND s.status = 'pending'"
	case "mine":
		query += " AND s.kind = 'article' AND s.author_id = $2::bigint"
		args = append(args, userID)
	default:
		return nil, fmt.Errorf("unsupported submission view %q", view)
	}

	rows, err := s.db.QueryContext(ctx, query+" ORDER BY s.created_at DESC, s.id", args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]Submission, 0)
	for rows.Next() {
		var item Submission
		if err := rows.Scan(&item.ID, &item.Kind, &item.AuthorID, &item.AuthorName,
			&item.Title, &item.Body, &item.Status, &item.CreatedAt, &item.Revision); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Store) Create(ctx context.Context, kind, userID, title, body string) (string, error) {
	var id string
	err := s.db.QueryRowContext(ctx, `
		INSERT INTO content_submissions (kind, author_id, title, body)
		VALUES ($1, $2::bigint, NULLIF($3, ''), $4) RETURNING id::text`,
		kind, userID, title, body).Scan(&id)
	return id, err
}

func (s *Store) ReviseArticle(ctx context.Context, id, userID, title, body string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var materialID sql.NullInt64
	err = tx.QueryRowContext(ctx, `
		UPDATE content_submissions
		SET title = $3, body = $4, status = 'pending', reviewed_by = NULL, reviewed_at = NULL,
		    revision = revision + 1
		WHERE id = $1::uuid AND kind = 'article' AND author_id = $2::bigint
		RETURNING material_id`, id, userID, title, body).Scan(&materialID)
	if err != nil {
		return err
	}
	if materialID.Valid {
		if _, err := tx.ExecContext(ctx, `
			UPDATE materials SET status = 'draft', published_at = NULL, updated_at = NOW() WHERE id = $1`,
			materialID.Int64); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (s *Store) DeleteArticle(ctx context.Context, id, userID string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var materialID sql.NullInt64
	err = tx.QueryRowContext(ctx, `
		DELETE FROM content_submissions
		WHERE id = $1::uuid AND kind = 'article' AND author_id = $2::bigint
		RETURNING material_id`, id, userID).Scan(&materialID)
	if err != nil {
		return err
	}
	if materialID.Valid {
		if _, err := tx.ExecContext(ctx, "DELETE FROM materials WHERE id = $1", materialID.Int64); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (s *Store) Review(ctx context.Context, kind, id, reviewerID, status string, expectedRevision int) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var item Submission
	var materialID sql.NullInt64
	err = tx.QueryRowContext(ctx, `
		SELECT s.author_id::text, u.display_name, COALESCE(s.title, ''), s.body, s.material_id, s.revision
		FROM content_submissions s JOIN auth_users u ON u.id = s.author_id
		WHERE s.id = $1::uuid AND s.kind = $2 AND s.status = 'pending'
		FOR UPDATE OF s`, id, kind).
		Scan(&item.AuthorID, &item.AuthorName, &item.Title, &item.Body, &materialID, &item.Revision)
	if err != nil {
		return err
	}
	if kind == "article" && item.Revision != expectedRevision {
		return ErrStaleRevision
	}
	if kind == "article" && status == "approved" && reviewerID == item.AuthorID {
		return ErrOwnArticleReview
	}

	var reviewedAt time.Time
	err = tx.QueryRowContext(ctx, `
		UPDATE content_submissions
		SET status = $2, reviewed_by = $3::bigint, reviewed_at = NOW()
		WHERE id = $1::uuid
		RETURNING reviewed_at`, id, status, reviewerID).Scan(&reviewedAt)
	if err != nil {
		return err
	}

	if kind == "article" && status == "approved" {
		if err := publishArticle(ctx, tx, id, reviewerID, item, reviewedAt, materialID); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func publishArticle(
	ctx context.Context, tx *sql.Tx, id, reviewerID string, item Submission, reviewedAt time.Time, materialID sql.NullInt64,
) error {
	var reviewer string
	if err := tx.QueryRowContext(ctx, "SELECT display_name FROM auth_users WHERE id = $1::bigint", reviewerID).
		Scan(&reviewer); err != nil {
		return err
	}
	summary := []rune(strings.Join(strings.Fields(item.Body), " "))
	if len(summary) > 200 {
		summary = summary[:200]
	}
	duration := (utf8.RuneCountInString(item.Body) + 899) / 900

	if materialID.Valid {
		_, err := tx.ExecContext(ctx, `
			UPDATE materials
			SET title = $2, summary = $3, body = $4, duration_minutes = $5, author = $6,
			    reviewer = $7, reviewed_at = $8, status = 'published', published_at = $8, updated_at = $8
			WHERE id = $1`, materialID.Int64, item.Title, string(summary), item.Body, duration,
			item.AuthorName, reviewer, reviewedAt)
		return err
	}

	var categoryID int64
	if err := tx.QueryRowContext(ctx, `
		INSERT INTO material_categories (slug, name) VALUES ('user-articles', 'Авторские статьи')
		ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug RETURNING id`).Scan(&categoryID); err != nil {
		return err
	}

	var newMaterialID int64
	err := tx.QueryRowContext(ctx, `
		INSERT INTO materials
		    (slug, type, title, summary, category_id, duration_minutes, body, author, reviewer,
		     reviewed_at, status, published_at)
		VALUES ($1, 'article', $2, $3, $4, $5, $6, $7, $8, $9, 'published', $9)
		RETURNING id`, "article-"+id, item.Title, string(summary), categoryID, duration, item.Body,
		item.AuthorName, reviewer, reviewedAt).Scan(&newMaterialID)
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, "UPDATE content_submissions SET material_id = $2 WHERE id = $1::uuid", id, newMaterialID)
	return err
}
