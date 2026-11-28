package http

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/mshipilov5/Ryadom_spbu/backend/internal/core"
	authservice "github.com/mshipilov5/Ryadom_spbu/backend/internal/service/auth"
	authstore "github.com/mshipilov5/Ryadom_spbu/backend/internal/store/auth"
)

const sessionCookieName = "ryadom_session"

type userResponse struct {
	User *core.User `json:"user"`
}

func (r *Router) mountAuth(v1 fiber.Router) {
	auth := v1.Group("/auth", r.authRequest)
	auth.Get("/session", r.getSession)
	auth.Post("/session", authRateLimit(60), r.login)
	auth.Delete("/session", r.logout)
	auth.Post("/register", authRateLimit(20), r.register)

	users := v1.Group("/users", r.authRequest)
	users.Get("/", r.listUsers)
	users.Patch("/", r.updateUserRoles)
}

func (r *Router) authRequest(ctx *fiber.Ctx) error {
	ctx.Set("Cache-Control", "no-store")
	switch ctx.Method() {
	case fiber.MethodPost, fiber.MethodPatch, fiber.MethodDelete:
		origin := ctx.Get("Origin")
		if origin != "" && origin != ctx.BaseURL() && !r.allowedAuthOrigin(origin) {
			return writeError(ctx, fiber.StatusForbidden, "forbidden", "Запрос с этого адреса запрещён")
		}
	}
	return ctx.Next()
}

func (r *Router) allowedAuthOrigin(origin string) bool {
	for _, allowed := range strings.Split(r.corsOrigins, ",") {
		if strings.TrimSpace(allowed) == origin {
			return true
		}
	}
	return false
}

func authRateLimit(max int) fiber.Handler {
	return limiter.New(limiter.Config{
		Max: max, Expiration: time.Minute,
		LimitReached: func(ctx *fiber.Ctx) error {
			return writeError(ctx, fiber.StatusTooManyRequests, "rate_limited", "Слишком много запросов. Попробуйте позже")
		},
	})
}

func (r *Router) currentAuthUser(ctx *fiber.Ctx) (*core.User, error) {
	return r.auth.CurrentUser(ctx.UserContext(), ctx.Cookies(sessionCookieName))
}

func (r *Router) getSession(ctx *fiber.Ctx) error {
	user, err := r.currentAuthUser(ctx)
	if err != nil {
		return r.writeAuthError(ctx, err)
	}
	return ctx.JSON(userResponse{User: user})
}

func (r *Router) login(ctx *fiber.Ctx) error {
	var form struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if status := readAuthJSON(ctx, &form); status != 0 {
		return invalidAuthJSON(ctx, status)
	}
	user, token, err := r.auth.Login(ctx.UserContext(), form.Username, form.Password, ctx.Cookies(sessionCookieName))
	if err != nil {
		return r.writeAuthError(ctx, err)
	}
	r.setSessionCookie(ctx, token, int(authservice.SessionTTL.Seconds()))
	return ctx.JSON(userResponse{User: &user})
}

func (r *Router) register(ctx *fiber.Ctx) error {
	var form struct {
		Username    string `json:"username"`
		DisplayName string `json:"displayName"`
		Password    string `json:"password"`
	}
	if status := readAuthJSON(ctx, &form); status != 0 {
		return invalidAuthJSON(ctx, status)
	}
	user, token, err := r.auth.Register(ctx.UserContext(), form.Username, form.DisplayName, form.Password, ctx.Cookies(sessionCookieName))
	if err != nil {
		return r.writeAuthError(ctx, err)
	}
	r.setSessionCookie(ctx, token, int(authservice.SessionTTL.Seconds()))
	return ctx.Status(fiber.StatusCreated).JSON(userResponse{User: &user})
}

func (r *Router) logout(ctx *fiber.Ctx) error {
	if err := r.auth.Logout(ctx.UserContext(), ctx.Cookies(sessionCookieName)); err != nil {
		return r.writeAuthError(ctx, err)
	}
	r.setSessionCookie(ctx, "", -1)
	return ctx.JSON(userResponse{})
}

func (r *Router) setSessionCookie(ctx *fiber.Ctx, value string, maxAge int) {
	ctx.Cookie(&fiber.Cookie{
		Name: sessionCookieName, Value: value, Path: "/", MaxAge: maxAge,
		HTTPOnly: true, Secure: r.authCookieSecure, SameSite: fiber.CookieSameSiteLaxMode,
	})
}

func (r *Router) listUsers(ctx *fiber.Ctx) error {
	user, err := r.currentAuthUser(ctx)
	if err != nil {
		return r.writeAuthError(ctx, err)
	}
	if user == nil {
		return writeError(ctx, fiber.StatusUnauthorized, "unauthorized", "Войдите в аккаунт")
	}
	users, err := r.auth.ListUsers(ctx.UserContext(), user)
	if err != nil {
		return r.writeAuthError(ctx, err)
	}
	return ctx.JSON(fiber.Map{"users": users})
}

func (r *Router) updateUserRoles(ctx *fiber.Ctx) error {
	user, err := r.currentAuthUser(ctx)
	if err != nil {
		return r.writeAuthError(ctx, err)
	}
	if user == nil {
		return writeError(ctx, fiber.StatusUnauthorized, "unauthorized", "Войдите в аккаунт")
	}
	if !user.HasRole("admin") {
		return r.writeAuthError(ctx, authstore.ErrForbidden)
	}
	var form struct {
		Username string   `json:"username"`
		Roles    []string `json:"roles"`
	}
	if status := readAuthJSON(ctx, &form); status != 0 {
		return invalidAuthJSON(ctx, status)
	}
	if form.Roles == nil {
		return r.writeAuthError(ctx, authservice.ErrInvalidInput)
	}
	updated, err := r.auth.UpdateRoles(ctx.UserContext(), user, form.Username, form.Roles)
	if err != nil {
		return r.writeAuthError(ctx, err)
	}
	return ctx.JSON(userResponse{User: &updated})
}

func readAuthJSON(ctx *fiber.Ctx, dst any) int {
	contentType, _, err := mime.ParseMediaType(ctx.Get("Content-Type"))
	if err != nil || contentType != "application/json" {
		return fiber.StatusUnsupportedMediaType
	}
	body := ctx.Body()
	if len(body) > 4096 || !bytes.HasPrefix(bytes.TrimSpace(body), []byte("{")) {
		return fiber.StatusBadRequest
	}
	decoder := json.NewDecoder(bytes.NewReader(body))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(dst); err != nil || decoder.Decode(&struct{}{}) != io.EOF {
		return fiber.StatusBadRequest
	}
	return 0
}

func invalidAuthJSON(ctx *fiber.Ctx, status int) error {
	if status == fiber.StatusUnsupportedMediaType {
		return writeError(ctx, status, "unsupported_media_type", "Ожидается JSON")
	}
	return writeError(ctx, status, "invalid_request", "Проверьте данные запроса")
}

func (r *Router) writeAuthError(ctx *fiber.Ctx, err error) error {
	switch {
	case errors.Is(err, authservice.ErrInvalidInput):
		return writeError(ctx, fiber.StatusBadRequest, "invalid_request", "Проверьте данные запроса")
	case errors.Is(err, authservice.ErrInvalidCredentials):
		return writeError(ctx, fiber.StatusUnauthorized, "invalid_credentials", "Неверный логин или пароль")
	case errors.Is(err, authstore.ErrForbidden):
		return writeError(ctx, fiber.StatusForbidden, "forbidden", "Действие недоступно")
	case errors.Is(err, authstore.ErrUsernameTaken):
		return writeError(ctx, fiber.StatusConflict, "username_taken", "Этот логин уже занят")
	case errors.Is(err, authstore.ErrUserNotFound):
		return writeError(ctx, fiber.StatusNotFound, "user_not_found", "Пользователь не найден")
	default:
		r.log.Error("auth request failed", "path", ctx.Path())
		return writeError(ctx, fiber.StatusInternalServerError, "internal_error", "Не удалось обработать запрос. Повторите попытку позже.")
	}
}
