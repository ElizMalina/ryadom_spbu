CREATE TABLE auth_users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(64) NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9][a-z0-9._-]{2,63}$'),
    display_name VARCHAR(100) NOT NULL CHECK (display_name <> ''),
    password_hash TEXT NOT NULL,
    roles JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (
        jsonb_typeof(roles) = 'array'
        AND roles <@ '["student", "consultant", "psychologist", "admin", "moderator", "reviewer"]'::jsonb
    ),
    bootstrap_admin BOOLEAN NOT NULL DEFAULT FALSE CHECK (NOT bootstrap_admin OR roles ? 'admin')
);

CREATE UNIQUE INDEX auth_single_bootstrap_admin ON auth_users (bootstrap_admin) WHERE bootstrap_admin;

CREATE TABLE auth_sessions (
    token_hash BYTEA PRIMARY KEY CHECK (octet_length(token_hash) = 32),
    user_id BIGINT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX auth_sessions_expiry ON auth_sessions (expires_at);
