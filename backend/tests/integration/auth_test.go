package integration_test

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/mshipilov5/Ryadom_spbu/backend/config"
	"github.com/mshipilov5/Ryadom_spbu/backend/internal/app"
	"github.com/mshipilov5/Ryadom_spbu/backend/internal/core"
	"golang.org/x/crypto/bcrypt"
)

const testStudentPassword = "fixture-student-password"

func TestAccountSessionsAndRoleChanges(t *testing.T) {
	server := newAuthTestServer(t)
	const session = "/api/v1/auth/session"
	const register = "/api/v1/auth/register"
	const users = "/api/v1/users"
	login := map[string]string{"username": "  New.Student  ", "password": testStudentPassword}

	var response struct {
		User *core.User `json:"user"`
	}
	decodeResponse(t, authRequest(t, server, "GET", session, nil, nil, 200), &response)
	if response.User != nil {
		t.Fatal("guest session returned a user")
	}
	authRequest(t, server, "GET", users, nil, nil, 401)
	authRequest(t, server, "POST", register, map[string]string{
		"username": "another.student", "displayName": "Студент", "password": testStudentPassword,
	}, nil, 404)
	signedIn := authRequest(t, server, "POST", session, login, nil, 200)
	decodeResponse(t, signedIn, &response)
	if response.User == nil || response.User.Username != "new.student" || response.User.Roles == nil || len(response.User.Roles) != 0 {
		t.Fatalf("sign-in returned an unexpected user: %#v", response.User)
	}
	token := sessionCookie(t, signedIn)
	for _, credentials := range []map[string]string{
		{"username": "new.student", "password": "wrong"},
		{"username": "студент", "password": testStudentPassword},
		{"username": "new.student", "password": ""},
	} {
		result := authRequest(t, server, "POST", session, credentials, nil, 401)
		var failure struct {
			Code string `json:"code"`
		}
		decodeResponse(t, result, &failure)
		if failure.Code != "invalid_credentials" {
			t.Fatalf("login error = %q, want invalid_credentials", failure.Code)
		}
	}
	authRequest(t, server, "POST", session, map[string]string{"username": "new.student"}, nil, 400)
	authRequest(t, server, "GET", users, nil, token, 403)
	authRequest(t, server, "PATCH", users, map[string]any{"username": "new.student", "roles": []string{"admin"}}, token, 403)

	admin := sessionCookie(t, authRequest(t, server, "POST", session, map[string]string{
		"username": "admin.test", "password": "bootstrap-test-password",
	}, nil, 200))
	authRequest(t, server, "GET", users, nil, admin, 200)
	authRequest(t, server, "PATCH", users, map[string]any{"username": "admin.test", "roles": []string{}}, admin, 403)
	authRequest(t, server, "PATCH", users, map[string]any{"username": "new.student", "roles": []string{"guest"}}, admin, 400)
	authRequest(t, server, "PATCH", users, map[string]any{"username": "new.student", "roles": []string{"student"}}, admin, 200)
	decodeResponse(t, authRequest(t, server, "GET", session, nil, token, 200), &response)
	if !response.User.HasRole("student") {
		t.Fatal("existing session did not pick up the new role")
	}
	authRequest(t, server, "PATCH", users, map[string]any{"username": "new.student", "roles": []string{}}, admin, 200)
	decodeResponse(t, authRequest(t, server, "GET", session, nil, token, 200), &response)
	if response.User == nil || response.User.Roles == nil || len(response.User.Roles) != 0 {
		t.Fatal("existing session did not pick up revoked roles")
	}
	replaced := sessionCookie(t, authRequest(t, server, "POST", session, login, token, 200))
	assertGuest := func(cookie *http.Cookie) {
		t.Helper()
		decodeResponse(t, authRequest(t, server, "GET", session, nil, cookie, 200), &response)
		if response.User != nil {
			t.Fatal("old session remains active")
		}
	}
	assertGuest(token)
	authRequest(t, server, "DELETE", session, nil, replaced, 200)
	assertGuest(replaced)

	request := httptest.NewRequest("POST", session, bytes.NewBufferString(`{"username":"blocked"}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Origin", "https://other-origin.example")
	if result := executeRequest(t, server, request); result.StatusCode != 403 {
		t.Fatalf("cross-origin login returned %d, want 403", result.StatusCode)
	}
}

func newAuthTestServer(t *testing.T) *fiber.App {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("set TEST_DATABASE_URL to test HTTP authentication against PostgreSQL")
	}
	database, err := sql.Open("pgx", dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = database.Close() })
	schema := fmt.Sprintf("test_auth_%d", time.Now().UnixNano())
	if _, err := database.Exec("CREATE SCHEMA " + schema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = database.Exec("DROP SCHEMA " + schema + " CASCADE") })
	address, err := url.Parse(dsn)
	if err != nil {
		t.Fatal(err)
	}
	query := address.Query()
	query.Set("search_path", schema)
	address.RawQuery = query.Encode()
	server, closeServer, err := app.New(context.Background(), config.Config{
		DatabaseURL: address.String(), CORSAllowedOrigins: "http://localhost:3000",
		AuthCookieSecure: true, AuthBootstrapAdminUsername: "admin.test", AuthBootstrapAdminPassword: "bootstrap-test-password",
	}, slog.Default())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = closeServer() })
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(testStudentPassword), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := database.Exec(
		"INSERT INTO "+schema+".auth_users (username, display_name, password_hash) VALUES ($1, $2, $3)",
		"new.student", "Студент", string(passwordHash),
	); err != nil {
		t.Fatal(err)
	}
	return server
}

func authRequest(t *testing.T, server *fiber.App, method, path string, payload any, cookie *http.Cookie, status int) *http.Response {
	t.Helper()
	body := &bytes.Buffer{}
	if payload != nil {
		if err := json.NewEncoder(body).Encode(payload); err != nil {
			t.Fatal(err)
		}
	}
	request := httptest.NewRequest(method, path, body)
	if payload != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	if cookie != nil {
		request.AddCookie(cookie)
	}
	response := executeRequest(t, server, request)
	if response.StatusCode != status {
		t.Fatalf("%s %s returned %d, want %d", method, path, response.StatusCode, status)
	}
	return response
}

func sessionCookie(t *testing.T, response *http.Response) *http.Cookie {
	t.Helper()
	for _, cookie := range response.Cookies() {
		if cookie.Name != "ryadom_session" {
			continue
		}
		if cookie.Value == "" || !cookie.Secure || !cookie.HttpOnly || cookie.SameSite != http.SameSiteLaxMode || cookie.Path != "/" {
			t.Fatal("session cookie attributes are invalid")
		}
		return cookie
	}
	t.Fatal("session cookie missing")
	return nil
}
