package integration_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/mshipilov5/Ryadom_spbu/backend/internal/core"
)

func TestEventFrontendContract(t *testing.T) {
	server := newAuthTestServer(t,
		testAuthAccount{"staff.one", "Организатор", []string{"consultant"}},
		testAuthAccount{"staff.two", "Психолог", []string{"psychologist"}},
		testAuthAccount{"student.one", "Анна", []string{"student"}},
		testAuthAccount{"student.two", "Борис", []string{"student"}},
		testAuthAccount{"student.outside", "Ольга", []string{"student"}},
	)
	const endpoint = "/api/v1/events"
	signIn := func(username string) *http.Cookie {
		t.Helper()
		return sessionCookie(t, authRequest(t, server, "POST", "/api/v1/auth/session",
			map[string]string{"username": username, "password": testStudentPassword}, nil, 200))
	}
	organizer := signIn("staff.one")
	psychologist := signIn("staff.two")
	student := signIn("student.one")
	otherStudent := signIn("student.two")
	outsideStudent := signIn("student.outside")

	authRequest(t, server, "GET", endpoint, nil, nil, 401)
	authRequest(t, server, "GET", endpoint+"/students", nil, student, 403)
	authRequest(t, server, "GET", endpoint+"?scope=created", nil, student, 403)
	authRequest(t, server, "GET", endpoint+"?scope=assigned", nil, organizer, 403)
	authRequest(t, server, "GET", endpoint+"?scope=all", nil, organizer, 400)

	var directory struct {
		Students []core.EventUser `json:"students"`
	}
	decodeResponse(t, authRequest(t, server, "GET", endpoint+"/students", nil, organizer, 200), &directory)
	if len(directory.Students) != 3 ||
		directory.Students[0].Username != "student.one" ||
		directory.Students[1].Username != "student.two" {
		t.Fatalf("directory = %#v", directory.Students)
	}

	input := core.CreateEventInput{
		Title: "  Консультация  ", Date: "2099-10-03", Time: "14:05", Address: " Аудитория 8 ",
		StudentIDs: []string{directory.Students[0].ID, directory.Students[1].ID},
	}
	authRequest(t, server, "POST", endpoint, input, student, 403)
	invalidReply := func(input core.CreateEventInput, code string) {
		t.Helper()
		var body struct {
			Error string `json:"error"`
		}
		decodeResponse(t, authRequest(t, server, "POST", endpoint, input, organizer, 400), &body)
		if body.Error != code {
			t.Fatalf("error = %q, want %q", body.Error, code)
		}
	}

	past := input
	past.Date = "2020-01-01"
	invalidReply(past, "past_meeting")
	invalid := input
	invalid.StudentIDs = []string{"9223372036854775807"}
	invalidReply(invalid, "invalid_students")
	invalid.StudentIDs = []string{input.StudentIDs[0], input.StudentIDs[0]}
	invalidReply(invalid, "invalid_fields")

	var created struct {
		Event core.CreatedEvent `json:"event"`
	}
	decodeResponse(t, authRequest(t, server, "POST", endpoint, input, organizer, 201), &created)
	item := created.Event
	if item.ID == "" || item.Title != "Консультация" || item.Address != "Аудитория 8" ||
		item.Date != input.Date || item.Time != input.Time || item.CreatedAt.IsZero() ||
		item.Organizer.Username != "staff.one" || len(item.Participants) != 2 {
		t.Fatalf("created event = %#v", item)
	}
	staffList := func(who *http.Cookie) []core.CreatedEvent {
		t.Helper()
		var result struct {
			Events []core.CreatedEvent `json:"events"`
			Scope  string              `json:"scope"`
		}
		decodeResponse(t, authRequest(t, server, "GET", endpoint+"?scope=created", nil, who, 200), &result)
		if result.Scope != "created" || result.Events == nil {
			t.Fatalf("unexpected created list: %#v", result)
		}
		return result.Events
	}
	if actual := staffList(organizer); len(actual) != 1 || actual[0].ID != item.ID {
		t.Fatalf("organizer events = %#v", actual)
	}
	if actual := staffList(psychologist); len(actual) != 0 {
		t.Fatalf("another specialist received someone else's events: %#v", actual)
	}

	assignedList := func(who *http.Cookie) []map[string]json.RawMessage {
		t.Helper()
		var result struct {
			Events []map[string]json.RawMessage `json:"events"`
			Scope  string                       `json:"scope"`
		}
		decodeResponse(t, authRequest(t, server, "GET", endpoint+"?scope=assigned", nil, who, 200), &result)
		if result.Scope != "assigned" || result.Events == nil {
			t.Fatalf("unexpected assigned list: %#v", result)
		}
		return result.Events
	}
	if actual := assignedList(student); len(actual) != 1 ||
		string(actual[0]["id"]) != `"`+item.ID+`"` ||
		actual[0]["organizer"] == nil || actual[0]["participants"] != nil {
		t.Fatalf("student events = %#v", actual)
	}
	if actual := assignedList(outsideStudent); len(actual) != 0 {
		t.Fatalf("unassigned student events = %#v", actual)
	}

	itemPath := endpoint + "/" + item.ID
	authRequest(t, server, "DELETE", itemPath, nil, psychologist, 404)
	authRequest(t, server, "DELETE", itemPath, nil, outsideStudent, 404)
	checkAction := func(who *http.Cookie, want string) {
		t.Helper()
		var result struct {
			Action string `json:"action"`
		}
		decodeResponse(t, authRequest(t, server, "DELETE", itemPath, nil, who, 200), &result)
		if result.Action != want {
			t.Fatalf("action = %q, want %q", result.Action, want)
		}
	}
	checkAction(student, "unassigned")
	if len(assignedList(student)) != 0 || len(assignedList(otherStudent)) != 1 {
		t.Fatal("canceling participation changed the wrong assignments")
	}
	checkAction(organizer, "deleted")
	if len(assignedList(otherStudent)) != 0 || len(staffList(organizer)) != 0 {
		t.Fatal("the deleted event is still visible")
	}
	authRequest(t, server, "POST", endpoint, input, psychologist, 201)
}
