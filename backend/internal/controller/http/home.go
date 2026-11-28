package http

import "github.com/gofiber/fiber/v2"

type homeItem struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Href        string `json:"href"`
}

type homeFeedResponse struct {
	Message  string    `json:"message"`
	Event    *homeItem `json:"event"`
	Practice *homeItem `json:"practice"`
}

func (r *Router) getHome(ctx *fiber.Ctx) error {
	ctx.Set(fiber.HeaderCacheControl, "no-store")
	return ctx.JSON(homeFeedResponse{
		Message: "Начните с небольшого шага",
		Practice: &homeItem{
			Title:       "Пауза на 2 минуты",
			Description: "Короткое упражнение",
			Href:        "/practices",
		},
	})
}
