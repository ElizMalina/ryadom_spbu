CREATE TABLE content_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind VARCHAR(16) NOT NULL CHECK (kind IN ('wall', 'article')),
    author_id BIGINT NOT NULL REFERENCES auth_users(id),
    title VARCHAR(160),
    body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
    status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
    reviewed_by BIGINT REFERENCES auth_users(id),
    reviewed_at TIMESTAMPTZ,
    material_id BIGINT UNIQUE REFERENCES materials(id),
    CHECK ((kind = 'wall' AND title IS NULL AND material_id IS NULL)
        OR (kind = 'article' AND title IS NOT NULL AND char_length(title) > 0)),
    CHECK ((status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL)
        OR (status IN ('approved', 'rejected') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);

CREATE INDEX content_submissions_kind_status_idx ON content_submissions(kind, status, created_at DESC);
CREATE INDEX content_submissions_author_idx ON content_submissions(author_id, created_at DESC)
    WHERE kind = 'article';
