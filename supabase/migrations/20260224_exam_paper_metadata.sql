-- Add metadata column to exam_papers
ALTER TABLE "public"."exam_papers" ADD COLUMN "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb;
