package auth

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"github.com/mshipilov5/Ryadom_spbu/backend/internal/core"
)

var (
	ErrUsernameTaken     = errors.New("username already registered")
	ErrUserNotFound      = errors.New("user not found")
	ErrForbidden         = errors.New("role change forbidden")
	ErrBootstrapConflict = errors.New("bootstrap username belongs to another account")
)

type Store struct {
	db *sql.DB
}

func New(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) BootstrapAdmin(ctx context.Context, username, name, passwordHash string) error {
	var bootstrap bool
	err := s.db.QueryRowContext(ctx, `
		INSERT INTO auth_users (username, display_name, password_hash, roles, bootstrap_admin)
		VALUES ($1, $2, $3, '["admin"]'::jsonb, TRUE)
		ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
		RETURNING bootstrap_admin
	`, username, name, passwordHash).Scan(&bootstrap)
	if err != nil {
		return err
	}
	if !bootstrap {
		return ErrBootstrapConflict
	}
	return nil
}

func (s *Store) Register(ctx context.Context, username, name, passwordHash string, token, previous []byte, expiresAt time.Time) (core.User, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return core.User{}, err
	}
	defer tx.Rollback()

	user, err := scanUser(tx.QueryRowContext(ctx, `
		INSERT INTO auth_users (username, display_name, password_hash)
		VALUES ($1, $2, $3)
		ON CONFLICT (username) DO NOTHING
		RETURNING id, username, display_name, roles
	`, username, name, passwordHash))
	if errors.Is(err, sql.ErrNoRows) {
		return core.User{}, ErrUsernameTaken
	}
	if err != nil {
		return core.User{}, err
	}
	if err := insertSession(ctx, tx, user.ID, token, previous, expiresAt); err != nil {
		return core.User{}, err
	}
	return user, tx.Commit()
}

func (s *Store) PasswordHash(ctx context.Context, username string) (string, string, error) {
	var id, hash string
	err := s.db.QueryRowContext(ctx, `
		SELECT id, password_hash FROM auth_users WHERE username = $1
	`, username).Scan(&id, &hash)
	if errors.Is(err, sql.ErrNoRows) {
		err = ErrUserNotFound
	}
	return id, hash, err
}

func (s *Store) CreateSession(ctx context.Context, userID string, token, previous []byte, expiresAt time.Time) (core.User, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return core.User{}, err
	}
	defer tx.Rollback()

	user, err := scanUser(tx.QueryRowContext(ctx, `
		SELECT id, username, display_name, roles FROM auth_users WHERE id = $1
	`, userID))
	if err != nil {
		return core.User{}, err
	}
	if err := insertSession(ctx, tx, user.ID, token, previous, expiresAt); err != nil {
		return core.User{}, err
	}
	return user, tx.Commit()
}

func insertSession(ctx context.Context, tx *sql.Tx, userID string, token, previous []byte, expiresAt time.Time) error {
	if _, err := tx.ExecContext(ctx, `
		DELETE FROM auth_sessions WHERE expires_at <= NOW() OR token_hash = $1
	`, previous); err != nil {
		return err
	}
	_, err := tx.ExecContext(ctx, `
		INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)
	`, token, userID, expiresAt)
	return err
}

func (s *Store) SessionUser(ctx context.Context, token []byte) (*core.User, error) {
	user, err := scanUser(s.db.QueryRowContext(ctx, `
		SELECT u.id, u.username, u.display_name, u.roles
		FROM auth_sessions s JOIN auth_users u ON u.id = s.user_id
		WHERE s.token_hash = $1 AND s.expires_at > NOW()
	`, token))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *Store) DeleteSession(ctx context.Context, token []byte) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM auth_sessions WHERE token_hash = $1`, token)
	return err
}

func (s *Store) ListUsers(ctx context.Context) ([]core.User, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id, username, display_name, roles FROM auth_users ORDER BY username`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	users := []core.User{}
	for rows.Next() {
		user, err := scanUser(rows)
		if err != nil {
			return nil, err
		}
		users = append(users, user)
	}
	return users, rows.Err()
}

func (s *Store) UpdateRoles(ctx context.Context, actorID, username string, roles []string) (core.User, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return core.User{}, err
	}
	defer tx.Rollback()

	// Lock both accounts in the same order so role revocations and grants serialize.
	rows, err := tx.QueryContext(ctx, `
		SELECT id, username, roles ? 'admin', bootstrap_admin FROM auth_users
		WHERE id = $1 OR username = $2 ORDER BY id FOR UPDATE
	`, actorID, username)
	if err != nil {
		return core.User{}, err
	}
	defer rows.Close()

	var actorIsAdmin, targetFound, targetIsBootstrap bool
	for rows.Next() {
		var id, name string
		var isAdmin, isBootstrap bool
		if err := rows.Scan(&id, &name, &isAdmin, &isBootstrap); err != nil {
			return core.User{}, err
		}
		if id == actorID {
			actorIsAdmin = isAdmin
		}
		if name == username {
			targetFound, targetIsBootstrap = true, isBootstrap
		}
	}
	if err := rows.Err(); err != nil {
		return core.User{}, err
	}
	if !actorIsAdmin {
		return core.User{}, ErrForbidden
	}
	if !targetFound {
		return core.User{}, ErrUserNotFound
	}
	updated := core.User{Roles: roles}
	if targetIsBootstrap && !updated.HasRole("admin") {
		return core.User{}, ErrForbidden
	}
	encoded, err := json.Marshal(roles)
	if err != nil {
		return core.User{}, err
	}
	user, err := scanUser(tx.QueryRowContext(ctx, `
		UPDATE auth_users SET roles = $2 WHERE username = $1
		RETURNING id, username, display_name, roles
	`, username, encoded))
	if err != nil {
		return core.User{}, err
	}
	return user, tx.Commit()
}

func scanUser(row interface{ Scan(...any) error }) (core.User, error) {
	var user core.User
	var roles []byte
	if err := row.Scan(&user.ID, &user.Username, &user.DisplayName, &roles); err != nil {
		return core.User{}, err
	}
	if err := json.Unmarshal(roles, &user.Roles); err != nil {
		return core.User{}, err
	}
	return user, nil
}
