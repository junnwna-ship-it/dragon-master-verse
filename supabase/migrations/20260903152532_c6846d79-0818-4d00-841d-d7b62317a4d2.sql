CREATE TABLE public.story_saves (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  dragon_uuid uuid,
  dragon_name text,
  current_node_id integer NOT NULL DEFAULT 1,
  player_hp integer NOT NULL DEFAULT 0,
  player_mp integer NOT NULL DEFAULT 0,
  visited integer[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_saves TO authenticated;
GRANT ALL ON public.story_saves TO service_role;

ALTER TABLE public.story_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own story save" ON public.story_saves
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own story save" ON public.story_saves
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own story save" ON public.story_saves
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own story save" ON public.story_saves
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_story_saves_updated_at BEFORE UPDATE ON public.story_saves
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();