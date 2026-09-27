-- DM-02: retain each owned dragon's chapter run independently.
-- This is additive; the legacy story_saves row remains for the old story map
-- and for clients that have not yet switched to this table.
CREATE TABLE public.dragon_story_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dragon_id uuid NOT NULL,
  chapter_id text NOT NULL CHECK (length(chapter_id) BETWEEN 1 AND 100),
  story_version text NOT NULL CHECK (length(story_version) BETWEEN 1 AND 50),
  node_key text NOT NULL CHECK (length(node_key) BETWEEN 1 AND 100),
  stats jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(stats) = 'object'),
  visited text[] NOT NULL DEFAULT '{}'::text[],
  applied text[] NOT NULL DEFAULT '{}'::text[],
  finished boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, dragon_id, chapter_id, story_version),
  FOREIGN KEY (user_id, dragon_id) REFERENCES public.owned_dragons(user_id, dragon_id) ON DELETE CASCADE
);

CREATE INDEX dragon_story_progress_dragon_idx
  ON public.dragon_story_progress(user_id, dragon_id, updated_at DESC);

ALTER TABLE public.dragon_story_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads dragon story progress" ON public.dragon_story_progress
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Owner inserts dragon story progress" ON public.dragon_story_progress
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Owner updates dragon story progress" ON public.dragon_story_progress
  FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Owner deletes dragon story progress" ON public.dragon_story_progress
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dragon_story_progress TO authenticated;
GRANT ALL ON public.dragon_story_progress TO service_role;

CREATE TRIGGER trg_dragon_story_progress_updated_at
  BEFORE UPDATE ON public.dragon_story_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
