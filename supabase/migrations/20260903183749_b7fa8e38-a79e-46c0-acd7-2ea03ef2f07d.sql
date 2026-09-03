ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS worm_affinity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS courage integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.finalize_story_run(_stats jsonb, _gold integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  k text;
  v jsonb;
  worm int := 0;
  cour int := 0;
  gold_delta int := GREATEST(COALESCE(_gold, 0), 0);
  row_out public.profiles;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  IF jsonb_typeof(_stats) = 'object' THEN
    FOR k, v IN SELECT key, value FROM jsonb_each(_stats) LOOP
      IF jsonb_typeof(v) <> 'number' THEN CONTINUE; END IF;
      IF lower(replace(k, ' ', '_')) IN ('worm_affinity', 'wormaffinity') THEN
        worm := worm + GREATEST((v::text)::int, 0);
      ELSIF lower(replace(k, ' ', '_')) IN ('courage') THEN
        cour := cour + GREATEST((v::text)::int, 0);
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.profiles (user_id, gold) VALUES (uid, 0)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.profiles
     SET gold = gold + gold_delta,
         worm_affinity = worm_affinity + worm,
         courage = courage + cour
   WHERE user_id = uid
  RETURNING * INTO row_out;

  RETURN jsonb_build_object(
    'ok', true,
    'gold', row_out.gold,
    'worm_affinity', row_out.worm_affinity,
    'courage', row_out.courage,
    'gold_delta', gold_delta,
    'worm_delta', worm,
    'courage_delta', cour
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_story_run(jsonb, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_story_run(jsonb, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.train_stat_with_gold(_dragon_uuid uuid, _stat_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  training_open boolean;
  st public.training_stats;
  cur_gold int;
  new_gold int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _dragon_uuid IS NULL THEN RAISE EXCEPTION 'dragon required'; END IF;

  SELECT (value)::text::boolean INTO training_open
    FROM public.app_settings WHERE key = 'isTrainingOpen';
  IF NOT COALESCE(training_open, false) THEN
    RAISE EXCEPTION 'training is closed';
  END IF;

  SELECT * INTO st FROM public.training_stats
   WHERE stat_code = _stat_code AND is_published = true
   LIMIT 1;
  IF st.id IS NULL THEN RAISE EXCEPTION 'unknown stat: %', _stat_code; END IF;

  SELECT gold INTO cur_gold FROM public.profiles WHERE user_id = uid FOR UPDATE;
  IF cur_gold IS NULL THEN
    INSERT INTO public.profiles (user_id, gold) VALUES (uid, 0)
    ON CONFLICT (user_id) DO NOTHING;
    cur_gold := 0;
  END IF;
  IF cur_gold < st.base_cost THEN
    RAISE EXCEPTION 'not enough gold (have %, need %)', cur_gold, st.base_cost;
  END IF;

  UPDATE public.profiles SET gold = gold - st.base_cost WHERE user_id = uid
  RETURNING gold INTO new_gold;

  IF lower(st.stat_code) IN ('atk', 'attack') THEN
    UPDATE public.dragons SET atk = atk + st.stat_increase WHERE id = _dragon_uuid;
  ELSIF lower(st.stat_code) IN ('hp', 'max_hp', 'vitality') THEN
    UPDATE public.dragons SET max_hp = max_hp + st.stat_increase WHERE id = _dragon_uuid;
  ELSIF lower(st.stat_code) IN ('def', 'defense') THEN
    UPDATE public.dragons SET def = def + st.stat_increase WHERE id = _dragon_uuid;
  ELSIF lower(st.stat_code) IN ('mp', 'mana', 'magic') THEN
    UPDATE public.dragons SET mp = mp + st.stat_increase WHERE id = _dragon_uuid;
  ELSE
    RAISE EXCEPTION 'unsupported stat code: %', st.stat_code;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'stat_code', st.stat_code,
    'increase', st.stat_increase,
    'cost', st.base_cost,
    'remaining_gold', new_gold
  );
END;
$$;

REVOKE ALL ON FUNCTION public.train_stat_with_gold(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.train_stat_with_gold(uuid, text) TO authenticated;