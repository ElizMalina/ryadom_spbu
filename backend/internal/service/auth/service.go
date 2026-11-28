package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/mshipilov5/Ryadom_spbu/backend/internal/core"
	authstore "github.com/mshipilov5/Ryadom_spbu/backend/internal/store/auth"
	"golang.org/x/crypto/bcrypt"
)

const SessionTTL = 8 * time.Hour

var (
	ErrInvalidInput       = errors.New("invalid auth input")
	ErrInvalidCredentials = errors.New("invalid credentials")
	usernamePattern       = regexp.MustCompile(`^[a-z0-9][a-z0-9._-]{2,63}$`)
	// An unknown username still performs one bcrypt comparison.
	dummyHash = []byte("$2a$10$zDbX04kUg9X9UCPN4uM93uBMJYqr5W9wtVuAS17fFll9ACR4voF1C")
)

type Service struct {
	store *authstore.Store
}

func New(store *authstore.Store) *Service {
	return &Service{store: store}
}

func (s *Service) BootstrapAdmin(ctx context.Context, username, password string) error {
	if username == "" && password == "" {
		return nil
	}
	username = normalizeUsername(username)
	if !usernamePattern.MatchString(username) || !validNewPassword(password) {
		return ErrInvalidInput
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	return s.store.BootstrapAdmin(ctx, username, "Администратор", string(hash))
}

func (s *Service) Login(ctx context.Context, username, password, previous string) (core.User, string, error) {
	username = normalizeUsername(username)
	if !usernamePattern.MatchString(username) || password == "" || len(password) > 72 {
		return core.User{}, "", ErrInvalidCredentials
	}
	id, hash, err := s.store.PasswordHash(ctx, username)
	if errors.Is(err, authstore.ErrUserNotFound) {
		_ = bcrypt.CompareHashAndPassword(dummyHash, []byte(password))
		return core.User{}, "", ErrInvalidCredentials
	}
	if err != nil {
		return core.User{}, "", err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)); err != nil {
		return core.User{}, "", ErrInvalidCredentials
	}
	token, digest, err := newToken()
	if err != nil {
		return core.User{}, "", err
	}
	user, err := s.store.CreateSession(ctx, id, digest, tokenHash(previous), time.Now().Add(SessionTTL))
	return user, token, err
}

func (s *Service) CurrentUser(ctx context.Context, token string) (*core.User, error) {
	hash := tokenHash(token)
	if hash == nil {
		return nil, nil
	}
	return s.store.SessionUser(ctx, hash)
}

func (s *Service) Logout(ctx context.Context, token string) error {
	hash := tokenHash(token)
	if hash == nil {
		return nil
	}
	return s.store.DeleteSession(ctx, hash)
}

func (s *Service) ListUsers(ctx context.Context, actor *core.User) ([]core.User, error) {
	if !actor.HasRole("admin") {
		return nil, authstore.ErrForbidden
	}
	return s.store.ListUsers(ctx)
}

func (s *Service) UpdateRoles(ctx context.Context, actor *core.User, username string, roles []string) (core.User, error) {
	if !actor.HasRole("admin") {
		return core.User{}, authstore.ErrForbidden
	}
	username = normalizeUsername(username)
	if !usernamePattern.MatchString(username) || len(roles) > 6 {
		return core.User{}, ErrInvalidInput
	}
	normalized := make([]string, 0, len(roles))
	seen := make(map[string]struct{}, len(roles))
	for _, role := range roles {
		switch role {
		case "student", "consultant", "psychologist", "admin", "moderator", "reviewer":
		default:
			return core.User{}, ErrInvalidInput
		}
		if _, duplicate := seen[role]; !duplicate {
			seen[role] = struct{}{}
			normalized = append(normalized, role)
		}
	}
	return s.store.UpdateRoles(ctx, actor.ID, username, normalized)
}

func normalizeUsername(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func validNewPassword(password string) bool {
	return len(password) <= 72 && utf8.RuneCountInString(password) >= 12
}

func newToken() (string, []byte, error) {
	data := make([]byte, 32)
	if _, err := rand.Read(data); err != nil {
		return "", nil, err
	}
	digest := sha256.Sum256(data)
	return base64.RawURLEncoding.EncodeToString(data), digest[:], nil
}

func tokenHash(token string) []byte {
	if len(token) != base64.RawURLEncoding.EncodedLen(32) {
		return nil
	}
	data, err := base64.RawURLEncoding.Strict().DecodeString(token)
	if err != nil {
		return nil
	}
	digest := sha256.Sum256(data)
	return digest[:]
}
