CREATE OR REPLACE FUNCTION public.guard_profile_currency_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Direct client updates (PostgREST roles) may only change nickname.
  -- SECURITY DEFINER RPCs run as the function owner and are unaffected.
  IF current_user IN ('authenticated', 'anon') THEN
    IF NEW.gold IS DISTINCT FROM OLD.gold
       OR NEW.worm_affinity IS DISTINCT FROM OLD.worm_affinity
       OR NEW.courage IS DISTINCT FROM OLD.courage
       OR NEW.bonus_story_slots IS DISTINCT FROM OLD.bonus_story_slots
       OR NEW.current_stage IS DISTINCT FROM OLD.current_stage THEN
      RAISE EXCEPTION 'CURRENCY_UPDATE_FORBIDDEN';
    END IF;
    NEW.user_id := OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_currency_columns_trg ON public.profiles;
CREATE TRIGGER guard_profile_currency_columns_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_currency_columns();

REVOKE EXECUTE ON FUNCTION public.guard_profile_currency_columns() FROM PUBLIC, anon, authenticated;