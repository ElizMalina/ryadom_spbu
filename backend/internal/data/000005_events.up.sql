CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id BIGINT NOT NULL REFERENCES auth_users(id),
    title VARCHAR(160) NOT NULL CHECK (title <> ''),
    scheduled_date DATE NOT NULL CHECK (scheduled_date BETWEEN DATE '2020-01-01' AND DATE '2100-12-31'),
    scheduled_time TIME(0) NOT NULL CHECK (scheduled_time < TIME '24:00:00' AND EXTRACT(SECOND FROM scheduled_time) = 0),
    address VARCHAR(300) NOT NULL CHECK (address <> ''),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX events_creator_schedule_idx ON events (creator_id, scheduled_date, scheduled_time, id);

CREATE TABLE event_participants (
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    student_id BIGINT NOT NULL REFERENCES auth_users(id),
    PRIMARY KEY (event_id, student_id)
);

CREATE INDEX event_participants_student_idx ON event_participants (student_id, event_id);
