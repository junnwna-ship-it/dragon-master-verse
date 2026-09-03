-- Visual-novel run progress on the existing single-slot save row.
-- Additive only: the legacy numeric story-map fields keep working untouched.

ALTER TABLE public.story_saves
  ADD COLUMN IF NOT EXISTS vn_chapter_id text,
  ADD COLUMN IF NOT EXISTS vn_node_key text,
  ADD COLUMN IF NOT EXISTS vn_stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS vn_visited text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS vn_applied text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS vn_finished boolean NOT NULL DEFAULT false;