CREATE TABLE IF NOT EXISTS public.characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL DEFAULT 'npc',
  description text,
  dialogue_sample text,
  portrait_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bgm_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  scene_code text NOT NULL DEFAULT 'lobby',
  audio_url text,
  cover_image_url text,
  credit text,
  loop_enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.battle_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  skill_code text NOT NULL,
  element text NOT NULL DEFAULT 'neutral',
  mp_cost integer NOT NULL DEFAULT 0,
  power integer NOT NULL DEFAULT 0,
  description text,
  log_text text,
  icon_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.characters TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bgm_tracks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.battle_skills TO authenticated;
GRANT ALL ON public.characters TO service_role;
GRANT ALL ON public.bgm_tracks TO service_role;
GRANT ALL ON public.battle_skills TO service_role;

ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bgm_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.battle_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access to characters" ON public.characters
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users read published characters" ON public.characters
  FOR SELECT TO authenticated USING (is_published = true);

CREATE POLICY "Admins full access to bgm_tracks" ON public.bgm_tracks
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users read published bgm_tracks" ON public.bgm_tracks
  FOR SELECT TO authenticated USING (is_published = true);

CREATE POLICY "Admins full access to battle_skills" ON public.battle_skills
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users read published battle_skills" ON public.battle_skills
  FOR SELECT TO authenticated USING (is_published = true);

CREATE TRIGGER set_characters_updated_at BEFORE UPDATE ON public.characters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_bgm_tracks_updated_at BEFORE UPDATE ON public.bgm_tracks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_battle_skills_updated_at BEFORE UPDATE ON public.battle_skills
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();