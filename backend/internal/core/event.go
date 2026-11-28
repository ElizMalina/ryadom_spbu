package core

import "time"

type EventUser struct {
	ID          string `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"displayName"`
}

type Event struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Date      string    `json:"date"`
	Time      string    `json:"time"`
	Address   string    `json:"address"`
	Organizer EventUser `json:"organizer"`
	CreatedAt time.Time `json:"createdAt"`
}

type CreatedEvent struct {
	Event
	Participants []EventUser `json:"participants"`
}

type CreateEventInput struct {
	Title      string   `json:"title"`
	Date       string   `json:"date"`
	Time       string   `json:"time"`
	Address    string   `json:"address"`
	StudentIDs []string `json:"studentIds"`
}
