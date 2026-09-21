-- Optional image attachment on a feedback ticket. Stores the file's path
-- relative to UPLOAD_DIR (implementation detail), not a public URL — the
-- servable URL is derived at read time (see feedback repository), so
-- changing the serving route later needs no data migration.
ALTER TABLE feedback.tickets ADD COLUMN image_path TEXT;
