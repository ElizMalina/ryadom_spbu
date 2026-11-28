package integration_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHomeFeedForGuest(t *testing.T) {
	server := newTestServer()
	request := httptest.NewRequest(http.MethodGet, "/api/v1/home", nil)
	response := executeRequest(t, server, request)
	if response.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", response.StatusCode, http.StatusOK)
	}
	if got := response.Header.Get("Cache-Control"); got != "no-store" {
		t.Fatalf("Cache-Control = %q, want no-store", got)
	}

	var feed struct {
		Message  string          `json:"message"`
		Event    json.RawMessage `json:"event"`
		Practice *struct {
			Title       string `json:"title"`
			Description string `json:"description"`
			Href        string `json:"href"`
		} `json:"practice"`
	}
	decodeResponse(t, response, &feed)
	if feed.Message == "" || string(feed.Event) != "null" {
		t.Fatalf("invalid guest feed: message = %q, event = %s", feed.Message, feed.Event)
	}
	if feed.Practice == nil || feed.Practice.Title == "" ||
		feed.Practice.Description == "" || feed.Practice.Href != "/practices" {
		t.Fatalf("invalid practice card: %+v", feed.Practice)
	}
}
