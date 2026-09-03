ALTER TABLE public.user_stories ADD COLUMN IF NOT EXISTS is_hall_of_fame boolean NOT NULL DEFAULT false;
ALTER TABLE public.story_nodes ADD COLUMN IF NOT EXISTS is_hall_of_fame boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bonus_story_slots integer NOT NULL DEFAULT 0;

DROP POLICY IF EXISTS "Admins full access to user_stories" ON public.user_stories;
CREATE POLICY "Admins full access to user_stories" ON public.user_stories
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.enforce_user_story_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _bonus integer;
  _used integer;
BEGIN
  SELECT COALESCE(bonus_story_slots, 0) INTO _bonus FROM public.profiles WHERE user_id = NEW.user_id;
  SELECT count(*) INTO _used FROM public.user_stories WHERE user_id = NEW.user_id;
  IF _used >= 5 + COALESCE(_bonus, 0) THEN
    RAISE EXCEPTION 'STORY_LIMIT_REACHED';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.promote_story_to_hall_of_fame(_story_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _author uuid;
  _already boolean;
  _slots integer;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'NOT_ADMIN';
  END IF;

  SELECT user_id, is_hall_of_fame INTO _author, _already
  FROM public.user_stories WHERE id = _story_id;

  IF _author IS NULL THEN
    RAISE EXCEPTION 'STORY_NOT_FOUND';
  END IF;

  IF _already THEN
    SELECT COALESCE(bonus_story_slots, 0) INTO _slots FROM public.profiles WHERE user_id = _author;
    RETURN jsonb_build_object('promoted', false, 'reason', 'ALREADY_PROMOTED', 'bonus_story_slots', COALESCE(_slots, 0));
  END IF;

  UPDATE public.user_stories
  SET is_hall_of_fame = true, is_published = true
  WHERE id = _story_id;

  UPDATE public.profiles
  SET bonus_story_slots = COALESCE(bonus_story_slots, 0) + 1
  WHERE user_id = _author
  RETURNING bonus_story_slots INTO _slots;

  RETURN jsonb_build_object('promoted', true, 'author_id', _author, 'bonus_story_slots', COALESCE(_slots, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.promote_story_to_hall_of_fame(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.promote_story_to_hall_of_fame(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.demote_story_from_hall_of_fame(_story_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _author uuid;
  _was boolean;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'NOT_ADMIN';
  END IF;

  SELECT user_id, is_hall_of_fame INTO _author, _was
  FROM public.user_stories WHERE id = _story_id;

  IF _author IS NULL THEN
    RAISE EXCEPTION 'STORY_NOT_FOUND';
  END IF;

  IF NOT _was THEN
    RETURN jsonb_build_object('demoted', false, 'reason', 'NOT_PROMOTED');
  END IF;

  UPDATE public.user_stories SET is_hall_of_fame = false WHERE id = _story_id;

  UPDATE public.profiles
  SET bonus_story_slots = GREATEST(COALESCE(bonus_story_slots, 0) - 1, 0)
  WHERE user_id = _author;

  RETURN jsonb_build_object('demoted', true, 'author_id', _author);
END;
$$;

REVOKE ALL ON FUNCTION public.demote_story_from_hall_of_fame(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.demote_story_from_hall_of_fame(uuid) TO authenticated;