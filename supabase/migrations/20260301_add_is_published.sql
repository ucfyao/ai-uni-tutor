-- Add is_published flag to universities and courses
-- Default false: existing records must be manually published by admin
ALTER TABLE universities ADD COLUMN is_published BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE courses ADD COLUMN is_published BOOLEAN NOT NULL DEFAULT false;
