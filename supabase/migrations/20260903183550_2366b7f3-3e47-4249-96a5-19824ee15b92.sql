ALTER TABLE public.user_stories
  ADD COLUMN IF NOT EXISTS is_lobby_visible boolean NOT NULL DEFAULT false;

-- Only admins may change lobby visibility; authors' attempts are silently ignored.
CREATE OR REPLACE FUNCTION public.guard_user_story_lobby_visibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_lobby_visible IS DISTINCT FROM OLD.is_lobby_visible
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.is_lobby_visible := OLD.is_lobby_visible;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_user_story_lobby_visibility_trg ON public.user_stories;
CREATE TRIGGER guard_user_story_lobby_visibility_trg
BEFORE UPDATE ON public.user_stories
FOR EACH ROW EXECUTE FUNCTION public.guard_user_story_lobby_visibility();

-- Hall of Fame promotion/demotion also toggles lobby exposure.
CREATE OR REPLACE FUNCTION public.promote_story_to_hall_of_fame(_story_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  SET is_hall_of_fame = true, is_published = true, is_lobby_visible = true
  WHERE id = _story_id;

  UPDATE public.profiles
  SET bonus_story_slots = COALESCE(bonus_story_slots, 0) + 1
  WHERE user_id = _author
  RETURNING bonus_story_slots INTO _slots;

  RETURN jsonb_build_object('promoted', true, 'author_id', _author, 'bonus_story_slots', COALESCE(_slots, 0));
END;
$function$;

CREATE OR REPLACE FUNCTION public.demote_story_from_hall_of_fame(_story_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  UPDATE public.user_stories SET is_hall_of_fame = false, is_lobby_visible = false WHERE id = _story_id;

  UPDATE public.profiles
  SET bonus_story_slots = GREATEST(COALESCE(bonus_story_slots, 0) - 1, 0)
  WHERE user_id = _author;

  RETURN jsonb_build_object('demoted', true, 'author_id', _author);
END;
$function$;

-- Admin-only helper to flip lobby exposure directly.
CREATE OR REPLACE FUNCTION public.set_story_lobby_visibility(_story_id uuid, _visible boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.user_stories;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'NOT_ADMIN';
  END IF;

  UPDATE public.user_stories
     SET is_lobby_visible = _visible
   WHERE id = _story_id
  RETURNING * INTO _row;

  IF _row.id IS NULL THEN
    RAISE EXCEPTION 'STORY_NOT_FOUND';
  END IF;

  RETURN jsonb_build_object('ok', true, 'is_lobby_visible', _row.is_lobby_visible);
END;
$$;

REVOKE ALL ON FUNCTION public.set_story_lobby_visibility(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_story_lobby_visibility(uuid, boolean) TO authenticated;