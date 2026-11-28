package events

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"sort"

	"github.com/mshipilov5/Ryadom_spbu/backend/internal/core"
	"golang.org/x/text/collate"
	"golang.org/x/text/language"
)

var ErrInvalidStudents = errors.New("selected accounts must have the student role")

const (
	ActionDeleted    = "deleted"
	ActionUnassigned = "unassigned"
)

type Store struct {
	db *sql.DB
}

func New(db *sql.DB) *Store {
	return &Store{db: db}
}

const (
	eventFields = `
		e.id, e.title, to_char(e.scheduled_date, 'YYYY-MM-DD'),
		left(e.scheduled_time::text, 5), e.address, e.created_at,
		organizer.id, organizer.username, organizer.display_name`
	participantFields = `
		COALESCE((
			SELECT jsonb_agg(jsonb_build_object(
				'id', u.id::text, 'username', u.username, 'displayName', u.display_name
			) ORDER BY u.id)
			FROM event_participants p JOIN auth_users u ON u.id = p.student_id
			WHERE p.event_id = e.id
		), '[]'::jsonb)`
	eventSource = `
		FROM events e JOIN auth_users organizer ON organizer.id = e.creator_id`
	eventOrder = ` ORDER BY e.scheduled_date, e.scheduled_time, e.id`
)

func (s *Store) ListCreated(ctx context.Context, userID string) ([]core.CreatedEvent, error) {
	rows, err := s.db.QueryContext(ctx, "SELECT "+eventFields+", "+participantFields+eventSource+
		" WHERE e.creator_id = $1"+eventOrder, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []core.CreatedEvent{}
	for rows.Next() {
		item, err := scanCreated(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Store) ListAssigned(ctx context.Context, userID string) ([]core.Event, error) {
	rows, err := s.db.QueryContext(ctx, "SELECT "+eventFields+eventSource+
		" JOIN event_participants p ON p.event_id = e.id WHERE p.student_id = $1"+eventOrder, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []core.Event{}
	for rows.Next() {
		var item core.Event
		if err := rows.Scan(eventDestinations(&item)...); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Store) ListStudents(ctx context.Context) ([]core.EventUser, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, username, display_name FROM auth_users WHERE roles ? 'student' ORDER BY id
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	students := []core.EventUser{}
	for rows.Next() {
		var student core.EventUser
		if err := rows.Scan(&student.ID, &student.Username, &student.DisplayName); err != nil {
			return nil, err
		}
		students = append(students, student)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	russianOrder := collate.New(language.Russian)
	sort.SliceStable(students, func(i, j int) bool {
		return russianOrder.CompareString(students[i].DisplayName, students[j].DisplayName) < 0
	})
	return students, nil
}

func (s *Store) Create(ctx context.Context, creatorID string, input core.CreateEventInput, studentIDs []int64) (core.CreatedEvent, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return core.CreatedEvent{}, err
	}
	defer tx.Rollback()

	// Keep selected roles stable until the event and all assignments are saved.
	var validStudents int
	if err := tx.QueryRowContext(ctx, `
		SELECT count(*) FROM (
			SELECT id FROM auth_users WHERE id = ANY($1::bigint[]) AND roles ? 'student' ORDER BY id FOR SHARE
		) selected
	`, studentIDs).Scan(&validStudents); err != nil {
		return core.CreatedEvent{}, err
	}
	if validStudents != len(studentIDs) {
		return core.CreatedEvent{}, ErrInvalidStudents
	}

	var id string
	if err := tx.QueryRowContext(ctx, `
		INSERT INTO events (creator_id, title, scheduled_date, scheduled_time, address)
		VALUES ($1, $2, $3::date, $4::time, $5) RETURNING id
	`, creatorID, input.Title, input.Date, input.Time, input.Address).Scan(&id); err != nil {
		return core.CreatedEvent{}, err
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO event_participants (event_id, student_id)
		SELECT $1, unnest($2::bigint[])
	`, id, studentIDs); err != nil {
		return core.CreatedEvent{}, err
	}

	item, err := scanCreated(tx.QueryRowContext(ctx, "SELECT "+eventFields+", "+participantFields+eventSource+
		" WHERE e.id = $1", id))
	if err != nil {
		return core.CreatedEvent{}, err
	}
	return item, tx.Commit()
}

func (s *Store) Remove(ctx context.Context, eventID, actorID string, manage, student bool) (string, error) {
	if !manage && !student {
		return "", sql.ErrNoRows
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return "", err
	}
	defer tx.Rollback()

	var creatorID string
	if err := tx.QueryRowContext(ctx, "SELECT creator_id FROM events WHERE id = $1 FOR UPDATE", eventID).Scan(&creatorID); err != nil {
		return "", err
	}

	if manage && creatorID == actorID {
		if _, err := tx.ExecContext(ctx, "DELETE FROM events WHERE id = $1", eventID); err != nil {
			return "", err
		}
		return ActionDeleted, tx.Commit()
	}
	if !student {
		return "", sql.ErrNoRows
	}
	result, err := tx.ExecContext(ctx, "DELETE FROM event_participants WHERE event_id = $1 AND student_id = $2", eventID, actorID)
	if err != nil {
		return "", err
	}
	removed, err := result.RowsAffected()
	if err != nil {
		return "", err
	}
	if removed == 0 {
		return "", sql.ErrNoRows
	}
	return ActionUnassigned, tx.Commit()
}

func scanCreated(row interface{ Scan(...any) error }) (core.CreatedEvent, error) {
	var item core.CreatedEvent
	var participants []byte
	if err := row.Scan(append(eventDestinations(&item.Event), &participants)...); err != nil {
		return core.CreatedEvent{}, err
	}
	if err := json.Unmarshal(participants, &item.Participants); err != nil {
		return core.CreatedEvent{}, err
	}
	return item, nil
}

func eventDestinations(item *core.Event) []any {
	return []any{
		&item.ID, &item.Title, &item.Date, &item.Time, &item.Address, &item.CreatedAt,
		&item.Organizer.ID, &item.Organizer.Username, &item.Organizer.DisplayName,
	}
}
