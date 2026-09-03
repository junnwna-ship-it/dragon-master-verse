CREATE TABLE IF NOT EXISTS public.user_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  summary text,
  cover_image_url text,
  body text,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_stories_user_id_idx ON public.user_stories(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_stories TO authenticated;
GRANT SELECT ON public.user_stories TO anon;
GRANT ALL ON public.user_stories TO service_role;

ALTER TABLE public.user_stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_stories_owner_all" ON public.user_stories;
CREATE POLICY "user_stories_owner_all" ON public.user_stories
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_stories_public_read_published" ON public.user_stories;
CREATE POLICY "user_stories_public_read_published" ON public.user_stories
  FOR SELECT TO anon, authenticated
  USING (is_published = true);

CREATE OR REPLACE FUNCTION public.enforce_user_story_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM public.user_stories WHERE user_id = NEW.user_id) >= 5 THEN
    RAISE EXCEPTION 'STORY_LIMIT_REACHED';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_user_story_limit_trg ON public.user_stories;
CREATE TRIGGER enforce_user_story_limit_trg
  BEFORE INSERT ON public.user_stories
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_story_limit();

CREATE OR REPLACE FUNCTION public.touch_user_stories_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_user_stories_updated_at_trg ON public.user_stories;
CREATE TRIGGER touch_user_stories_updated_at_trg
  BEFORE UPDATE ON public.user_stories
  FOR EACH ROW EXECUTE FUNCTION public.touch_user_stories_updated_at();