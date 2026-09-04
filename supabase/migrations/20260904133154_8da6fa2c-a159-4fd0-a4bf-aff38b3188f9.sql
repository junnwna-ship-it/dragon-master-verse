CREATE TABLE public.ugc_story_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  story_id text NOT NULL,
  node_key text,
  finished boolean NOT NULL DEFAULT false,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  picked integer,
  quiz_result text CHECK (quiz_result IN ('correct', 'wrong')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, story_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ugc_story_progress TO authenticated;
GRANT ALL ON public.ugc_story_progress TO service_role;

ALTER TABLE public.ugc_story_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own ugc progress" ON public.ugc_story_progress
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own ugc progress" ON public.ugc_story_progress
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own ugc progress" ON public.ugc_story_progress
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own ugc progress" ON public.ugc_story_progress
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_ugc_story_progress_updated_at
  BEFORE UPDATE ON public.ugc_story_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();