WITH removed_submissions AS (
    DELETE FROM content_submissions RETURNING material_id
)
DELETE FROM materials WHERE id IN (SELECT material_id FROM removed_submissions);

DROP TABLE content_submissions;
