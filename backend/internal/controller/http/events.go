package http

import (
	"database/sql"
	"errors"
	"strconv"
	"strings"
	"time"
	_ "time/tzdata"
	"unicode/utf8"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/mshipilov5/Ryadom_spbu/backend/internal/core"
	"github.com/mshipilov5/Ryadom_spbu/backend/internal/store/events"
)

const eventDateTimeFormat = "2006-01-02T15:04"

var eventLocation = func() *time.Location {
	location, err := time.LoadLocation("Europe/Moscow")
	if err != nil {
		panic(err)
	}
	return location
}()

type eventsController struct {
	router *Router
	store  *events.Store
}

func (r *Router) mountEvents(v1 fiber.Router, db *sql.DB) {
	controller := &eventsController{router: r, store: events.New(db)}
	group := v1.Group("/events", r.authRequest)
	group.Get("/", controller.list)
	group.Get("/students", controller.listStudents)
	group.Post("/", controller.create)
	group.Delete("/:id", controller.remove)
}

func (c *eventsController) list(ctx *fiber.Ctx) error {
	user, err := c.user(ctx)
	if user == nil || err != nil {
		return err
	}
	scope := ctx.Query("scope")
	canManage := canManageEvents(user)
	if scope == "" {
		scope = "assigned"
		if canManage {
			scope = "created"
		}
	}
	switch scope {
	case "created":
		if !canManage {
			return eventForbidden(ctx)
		}
		items, err := c.store.ListCreated(ctx.UserContext(), user.ID)
		if err != nil {
			return c.storageError(ctx, err)
		}
		return ctx.JSON(fiber.Map{"events": items, "scope": scope})
	case "assigned":
		if !user.HasRole("student") {
			return eventForbidden(ctx)
		}
		items, err := c.store.ListAssigned(ctx.UserContext(), user.ID)
		if err != nil {
			return c.storageError(ctx, err)
		}
		return ctx.JSON(fiber.Map{"events": items, "scope": scope})
	default:
		return writeEventError(ctx, fiber.StatusBadRequest, "invalid_scope", "Выберите scope: assigned или created")
	}
}

func (c *eventsController) listStudents(ctx *fiber.Ctx) error {
	user, err := c.user(ctx)
	if user == nil || err != nil {
		return err
	}
	if !canManageEvents(user) {
		return eventForbidden(ctx)
	}
	students, err := c.store.ListStudents(ctx.UserContext())
	if err != nil {
		return c.storageError(ctx, err)
	}
	return ctx.JSON(fiber.Map{"students": students})
}

func (c *eventsController) create(ctx *fiber.Ctx) error {
	user, err := c.user(ctx)
	if user == nil || err != nil {
		return err
	}
	if !canManageEvents(user) {
		return eventForbidden(ctx)
	}

	var input core.CreateEventInput
	switch status := readJSONBody(ctx, &input, 16*1024); status {
	case fiber.StatusUnsupportedMediaType:
		return writeEventError(ctx, status, "unsupported_media_type", "Ожидается JSON")
	case fiber.StatusBadRequest:
		return writeEventError(ctx, status, "invalid_json", "Проверьте данные запроса")
	}
	input.Title = strings.TrimSpace(input.Title)
	input.Address = strings.TrimSpace(input.Address)
	scheduled, err := time.ParseInLocation(eventDateTimeFormat, input.Date+"T"+input.Time, eventLocation)
	if err != nil || scheduled.Format(eventDateTimeFormat) != input.Date+"T"+input.Time ||
		scheduled.Year() < 2020 || scheduled.Year() > 2100 ||
		!validEventText(input.Title, 160) || !validEventText(input.Address, 300) {
		return invalidEventFields(ctx)
	}
	studentIDs, valid := parseStudentIDs(input.StudentIDs)
	if !valid {
		return invalidEventFields(ctx)
	}
	if scheduled.Before(time.Now().In(eventLocation).Truncate(time.Minute)) {
		return writeEventError(ctx, fiber.StatusBadRequest, "past_meeting", "Укажите будущие дату и время по Москве")
	}

	item, err := c.store.Create(ctx.UserContext(), user.ID, input, studentIDs)
	if errors.Is(err, events.ErrInvalidStudents) {
		return writeEventError(ctx, fiber.StatusBadRequest, "invalid_students", "Выберите существующие аккаунты с ролью студента")
	}
	if err != nil {
		return c.storageError(ctx, err)
	}
	return ctx.Status(fiber.StatusCreated).JSON(fiber.Map{"event": item})
}

func (c *eventsController) remove(ctx *fiber.Ctx) error {
	user, err := c.user(ctx)
	if user == nil || err != nil {
		return err
	}
	id := ctx.Params("id")
	parsed, err := uuid.Parse(id)
	if err != nil || !strings.EqualFold(parsed.String(), id) {
		return eventNotFound(ctx)
	}
	action, err := c.store.Remove(ctx.UserContext(), parsed.String(), user.ID, canManageEvents(user), user.HasRole("student"))
	if errors.Is(err, sql.ErrNoRows) {
		return eventNotFound(ctx)
	}
	if err != nil {
		return c.storageError(ctx, err)
	}
	return ctx.JSON(fiber.Map{"action": action})
}

func (c *eventsController) user(ctx *fiber.Ctx) (*core.User, error) {
	user, err := c.router.currentAuthUser(ctx)
	if err != nil {
		return nil, c.storageError(ctx, err)
	}
	if user == nil {
		return nil, writeEventError(ctx, fiber.StatusUnauthorized, "unauthenticated", "Войдите в аккаунт")
	}
	return user, nil
}

func (c *eventsController) storageError(ctx *fiber.Ctx, err error) error {
	c.router.log.Error("event request failed", "path", ctx.Path(), "error", err)
	return writeEventError(ctx, fiber.StatusServiceUnavailable, "storage_unavailable", "События временно недоступны")
}

func canManageEvents(user *core.User) bool {
	return user.HasRole("psychologist") || user.HasRole("consultant")
}

func validEventText(value string, maxLength int) bool {
	return value != "" && utf8.RuneCountInString(value) <= maxLength && !strings.ContainsRune(value, 0)
}

func parseStudentIDs(values []string) ([]int64, bool) {
	if len(values) == 0 || len(values) > 100 {
		return nil, false
	}
	ids := make([]int64, 0, len(values))
	seen := make(map[int64]struct{}, len(values))
	for _, value := range values {
		id, err := strconv.ParseInt(value, 10, 64)
		if err != nil || id <= 0 || strconv.FormatInt(id, 10) != value {
			return nil, false
		}
		if _, exists := seen[id]; exists {
			return nil, false
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	return ids, true
}

func invalidEventFields(ctx *fiber.Ctx) error {
	return writeEventError(ctx, fiber.StatusBadRequest, "invalid_fields", "Проверьте поля встречи")
}

func eventForbidden(ctx *fiber.Ctx) error {
	return writeEventError(ctx, fiber.StatusForbidden, "forbidden", "Недостаточно прав")
}

func eventNotFound(ctx *fiber.Ctx) error {
	return writeEventError(ctx, fiber.StatusNotFound, "not_found", "Событие не найдено")
}

func writeEventError(ctx *fiber.Ctx, status int, code, message string) error {
	return ctx.Status(status).JSON(struct {
		apiErrorResponse
		Error string `json:"error"`
	}{newErrorResponse(ctx, code, message), code})
}
