package http

import (
	"database/sql"
	"encoding/json"
	"errors"
	"math"
	"mime"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/mshipilov5/Ryadom_spbu/backend/internal/core"
	"github.com/mshipilov5/Ryadom_spbu/backend/internal/store/submissions"
)

type submissionsController struct {
	router *Router
	store  *submissions.Store
}

type submissionResponse struct {
	ID         string    `json:"id"`
	Kind       string    `json:"kind,omitempty"`
	AuthorID   string    `json:"authorId,omitempty"`
	AuthorName string    `json:"authorName,omitempty"`
	Title      string    `json:"title,omitempty"`
	Body       string    `json:"body"`
	Status     string    `json:"status,omitempty"`
	CreatedAt  time.Time `json:"createdAt"`
	Revision   int       `json:"revision,omitempty"`
}

func (r *Router) mountSubmissions(v1 fiber.Router, db *sql.DB) {
	controller := &submissionsController{router: r, store: submissions.New(db)}
	group := v1.Group("/submissions")
	group.Get("/:kind", controller.list)
	group.Post("/:kind", controller.create)
	group.Patch("/:kind/:id", controller.update)
	group.Delete("/:kind/:id", controller.remove)
}

func (c *submissionsController) authorize(ctx *fiber.Ctx, role string) (*core.User, error) {
	user, err := c.router.currentAuthUser(ctx)
	if err != nil {
		return nil, c.router.writeAuthError(ctx, err)
	}
	if user == nil {
		return nil, writeError(ctx, fiber.StatusUnauthorized, "unauthorized", "Требуется войти в систему")
	}
	if role != "" && !user.HasRole(role) {
		return nil, submissionForbidden(ctx)
	}
	return user, nil
}

func (c *submissionsController) list(ctx *fiber.Ctx) error {
	kind := ctx.Params("kind")
	if !validSubmissionKind(kind) {
		return submissionNotFound(ctx)
	}
	view := ctx.Query("view")
	if view == "" {
		view = "queue"
		if kind == "wall" {
			view = "public"
		}
	}

	var userID string
	switch {
	case kind == "wall" && view == "public":
	case view == "queue":
		user, err := c.authorize(ctx, reviewRole(kind))
		if user == nil || err != nil {
			return err
		}
	case kind == "article" && view == "mine":
		user, err := c.authorize(ctx, "consultant")
		if user == nil || err != nil {
			return err
		}
		userID = user.ID
	default:
		return writeError(ctx, fiber.StatusBadRequest, "invalid_view", "Недопустимое представление списка")
	}

	items, err := c.store.List(ctx.UserContext(), kind, view, userID)
	if err != nil {
		return c.router.writeServiceError(ctx, err)
	}
	result := make([]submissionResponse, 0, len(items))
	for _, item := range items {
		response := submissionResponse{ID: item.ID, Body: item.Body, CreatedAt: item.CreatedAt}
		if view != "public" {
			response.Kind = item.Kind
			response.Status = item.Status
		}
		if kind == "article" {
			response.Title = item.Title
			response.AuthorID = item.AuthorID
			response.AuthorName = item.AuthorName
			if view == "queue" {
				response.Revision = item.Revision
			}
		}
		result = append(result, response)
	}
	return ctx.JSON(fiber.Map{"items": result})
}

func (c *submissionsController) create(ctx *fiber.Ctx) error {
	kind := ctx.Params("kind")
	if !validSubmissionKind(kind) {
		return submissionNotFound(ctx)
	}
	role := "student"
	if kind == "article" {
		role = "consultant"
	}
	user, err := c.authorize(ctx, role)
	if user == nil || err != nil {
		return err
	}

	input, err := readSubmissionInput(ctx)
	if input == nil {
		return err
	}
	title, body, valid := submissionContent(kind, input)
	if !valid {
		return invalidSubmissionContent(ctx)
	}

	id, err := c.store.Create(ctx.UserContext(), kind, user.ID, title, body)
	if err != nil {
		return c.router.writeServiceError(ctx, err)
	}
	return ctx.Status(fiber.StatusCreated).JSON(fiber.Map{"id": id, "status": "pending"})
}

func (c *submissionsController) update(ctx *fiber.Ctx) error {
	kind, id := ctx.Params("kind"), ctx.Params("id")
	if !validSubmissionKind(kind) {
		return submissionNotFound(ctx)
	}
	if !validSubmissionID(id) {
		return writeError(ctx, fiber.StatusBadRequest, "invalid_id", "Недопустимый идентификатор")
	}
	user, err := c.authorize(ctx, "")
	if user == nil || err != nil {
		return err
	}

	input, err := readSubmissionInput(ctx)
	if input == nil {
		return err
	}
	_, editsTitle := input["title"]
	_, editsBody := input["body"]
	_, reviews := input["status"]
	if (editsTitle || editsBody) && reviews {
		return writeError(ctx, fiber.StatusBadRequest, "invalid_request", "Используйте отдельный запрос для редактирования или проверки")
	}
	if kind == "article" && (editsTitle || editsBody) {
		if !user.HasRole("consultant") {
			return submissionForbidden(ctx)
		}
		title, body, valid := submissionContent(kind, input)
		if !valid {
			return invalidSubmissionContent(ctx)
		}
		err = c.store.ReviseArticle(ctx.UserContext(), id, user.ID, title, body)
		return c.changeResponse(ctx, id, "pending", err)
	}

	if !user.HasRole(reviewRole(kind)) {
		return submissionForbidden(ctx)
	}
	status, _ := input["status"].(string)
	if status != "approved" && status != "rejected" {
		return writeError(ctx, fiber.StatusBadRequest, "invalid_status", "Укажите решение: approved или rejected")
	}
	var revision int
	if kind == "article" {
		value, ok := input["revision"].(float64)
		if !ok || value < 1 || value > math.MaxInt32 || math.Trunc(value) != value {
			return writeError(ctx, fiber.StatusBadRequest, "invalid_revision", "Укажите версию статьи из очереди проверки")
		}
		revision = int(value)
	}
	err = c.store.Review(ctx.UserContext(), kind, id, user.ID, status, revision)
	return c.changeResponse(ctx, id, status, err)
}

func (c *submissionsController) changeResponse(ctx *fiber.Ctx, id, status string, err error) error {
	if errors.Is(err, sql.ErrNoRows) {
		return submissionNotFound(ctx)
	}
	if errors.Is(err, submissions.ErrStaleRevision) {
		return writeError(ctx, fiber.StatusConflict, "stale_revision", "Статья изменилась. Откройте новую версию и проверьте её")
	}
	if errors.Is(err, submissions.ErrOwnArticleReview) {
		return writeError(ctx, fiber.StatusForbidden, "forbidden", "Для одобрения статьи нужен другой клинический рецензент")
	}
	if err != nil {
		return c.router.writeServiceError(ctx, err)
	}
	return ctx.JSON(fiber.Map{"id": id, "status": status})
}

func (c *submissionsController) remove(ctx *fiber.Ctx) error {
	if ctx.Params("kind") != "article" {
		return submissionNotFound(ctx)
	}
	id := ctx.Params("id")
	if !validSubmissionID(id) {
		return writeError(ctx, fiber.StatusBadRequest, "invalid_id", "Недопустимый идентификатор")
	}
	user, err := c.authorize(ctx, "consultant")
	if user == nil || err != nil {
		return err
	}

	err = c.store.DeleteArticle(ctx.UserContext(), id, user.ID)
	if errors.Is(err, sql.ErrNoRows) {
		return submissionNotFound(ctx)
	}
	if err != nil {
		return c.router.writeServiceError(ctx, err)
	}
	return ctx.JSON(fiber.Map{"deleted": true})
}

func validSubmissionKind(kind string) bool {
	return kind == "wall" || kind == "article"
}

func validSubmissionID(id string) bool {
	parsed, err := uuid.Parse(id)
	return err == nil && parsed.String() == id
}

func reviewRole(kind string) string {
	if kind == "wall" {
		return "moderator"
	}
	return "reviewer"
}

func readSubmissionInput(ctx *fiber.Ctx) (map[string]any, error) {
	contentType, _, err := mime.ParseMediaType(ctx.Get(fiber.HeaderContentType))
	if err != nil || contentType != fiber.MIMEApplicationJSON {
		return nil, invalidAuthJSON(ctx, fiber.StatusUnsupportedMediaType)
	}

	var input map[string]any
	if err := json.Unmarshal(ctx.Body(), &input); err != nil || input == nil {
		return nil, writeError(ctx, fiber.StatusBadRequest, "invalid_json", "Ожидается JSON-объект")
	}
	return input, nil
}

func submissionContent(kind string, input map[string]any) (title, body string, valid bool) {
	body, _ = input["body"].(string)
	body = strings.TrimSpace(body)
	if body == "" || utf8.RuneCountInString(body) > 5000 || strings.ContainsRune(body, 0) {
		return "", "", false
	}
	if kind == "wall" {
		return "", body, true
	}
	title, _ = input["title"].(string)
	title = strings.TrimSpace(title)
	if title == "" || utf8.RuneCountInString(title) > 160 || strings.ContainsRune(title, 0) {
		return "", "", false
	}
	return title, body, true
}

func submissionNotFound(ctx *fiber.Ctx) error {
	return writeError(ctx, fiber.StatusNotFound, "not_found", "Запись не найдена")
}

func submissionForbidden(ctx *fiber.Ctx) error {
	return writeError(ctx, fiber.StatusForbidden, "forbidden", "Недостаточно прав для этого действия")
}

func invalidSubmissionContent(ctx *fiber.Ctx) error {
	return writeError(ctx, fiber.StatusBadRequest, "invalid_content", "Проверьте заголовок и текст записи")
}
