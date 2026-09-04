-- 1) Per-user growth columns
ALTER TABLE public.owned_dragons
  ADD COLUMN IF NOT EXISTS level integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS exp integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stat_points integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_atk integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_max_hp integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_def integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_mp integer NOT NULL DEFAULT 0;

-- 2) Ownership helpers
CREATE OR REPLACE FUNCTION public.can_use_dragon(_user_id uuid, _dragon_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dragons d
    WHERE d.id = _dragon_uuid
      AND (
        d.is_seed
        OR d.created_by = _user_id
        OR EXISTS (
          SELECT 1 FROM public.owned_dragons o
          WHERE o.dragon_id = d.id AND o.user_id = _user_id
        )
      )
  )
$$;

REVOKE ALL ON FUNCTION public.can_use_dragon(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_use_dragon(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ensure_owned_dragon(_user_id uuid, _dragon_uuid uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owned_id uuid;
BEGIN
  IF _user_id IS NULL OR _dragon_uuid IS NULL THEN
    RAISE EXCEPTION 'DRAGON_REQUIRED';
  END IF;
  IF NOT public.can_use_dragon(_user_id, _dragon_uuid) THEN
    RAISE EXCEPTION 'DRAGON_NOT_OWNED';
  END IF;

  SELECT id INTO owned_id FROM public.owned_dragons
   WHERE user_id = _user_id AND dragon_id = _dragon_uuid;

  IF owned_id IS NULL THEN
    INSERT INTO public.owned_dragons (user_id, dragon_id)
    VALUES (_user_id, _dragon_uuid)
    RETURNING id INTO owned_id;
  END IF;

  RETURN owned_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_owned_dragon(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_owned_dragon(uuid, uuid) TO authenticated, service_role;

-- 3) Migrate existing global growth values into each owner's row
UPDATE public.owned_dragons o
   SET level = GREATEST(d.level, o.level),
       exp = GREATEST(d.exp, o.exp),
       stat_points = GREATEST(d.stat_points, o.stat_points)
  FROM public.dragons d
 WHERE d.id = o.dragon_id;

-- 4) Rewrite growth RPCs with ownership verification + per-user storage
CREATE OR REPLACE FUNCTION public.spend_stat_point(_dragon_uuid uuid, _stat text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  owned_id uuid;
  pts int;
  training_open boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT (value)::text::boolean INTO training_open
    FROM public.app_settings WHERE key = 'isTrainingOpen';
  IF NOT COALESCE(training_open, false) THEN
    RAISE EXCEPTION 'training is closed';
  END IF;

  owned_id := public.ensure_owned_dragon(uid, _dragon_uuid);

  SELECT stat_points INTO pts FROM public.owned_dragons WHERE id = owned_id FOR UPDATE;
  IF COALESCE(pts, 0) < 1 THEN RAISE EXCEPTION 'no stat points'; END IF;

  IF _stat = 'atk' THEN
    UPDATE public.owned_dragons SET bonus_atk = bonus_atk + 10, stat_points = stat_points - 1 WHERE id = owned_id;
  ELSIF _stat = 'hp' THEN
    UPDATE public.owned_dragons SET bonus_max_hp = bonus_max_hp + 50, stat_points = stat_points - 1 WHERE id = owned_id;
  ELSIF _stat = 'def' THEN
    UPDATE public.owned_dragons SET bonus_def = bonus_def + 5, stat_points = stat_points - 1 WHERE id = owned_id;
  ELSIF _stat = 'mp' THEN
    UPDATE public.owned_dragons SET bonus_mp = bonus_mp + 20, stat_points = stat_points - 1 WHERE id = owned_id;
  ELSE
    RAISE EXCEPTION 'invalid stat: %', _stat;
  END IF;

  RETURN jsonb_build_object('ok', true, 'remaining_points', pts - 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.train_stat_with_gold(_dragon_uuid uuid, _stat_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  owned_id uuid;
  training_open boolean;
  st public.training_stats;
  cur_gold int;
  new_gold int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT (value)::text::boolean INTO training_open
    FROM public.app_settings WHERE key = 'isTrainingOpen';
  IF NOT COALESCE(training_open, false) THEN
    RAISE EXCEPTION 'training is closed';
  END IF;

  owned_id := public.ensure_owned_dragon(uid, _dragon_uuid);

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
    UPDATE public.owned_dragons SET bonus_atk = bonus_atk + st.stat_increase WHERE id = owned_id;
  ELSIF lower(st.stat_code) IN ('hp', 'max_hp', 'vitality') THEN
    UPDATE public.owned_dragons SET bonus_max_hp = bonus_max_hp + st.stat_increase WHERE id = owned_id;
  ELSIF lower(st.stat_code) IN ('def', 'defense') THEN
    UPDATE public.owned_dragons SET bonus_def = bonus_def + st.stat_increase WHERE id = owned_id;
  ELSIF lower(st.stat_code) IN ('mp', 'mana', 'magic') THEN
    UPDATE public.owned_dragons SET bonus_mp = bonus_mp + st.stat_increase WHERE id = owned_id;
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

CREATE OR REPLACE FUNCTION public.purchase_shop_item(_item_key text, _dragon_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  owned_id uuid;
  cost int;
  cur_gold int;
  shop_open boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT (value)::text::boolean INTO shop_open
    FROM public.app_settings WHERE key = 'isShopOpen';
  IF NOT COALESCE(shop_open, false) THEN
    RAISE EXCEPTION 'shop is closed';
  END IF;

  owned_id := public.ensure_owned_dragon(uid, _dragon_uuid);

  IF _item_key = 'exp_potion' THEN
    cost := 500;
  ELSIF _item_key = 'forget_potion' THEN
    cost := 1000;
  ELSE
    RAISE EXCEPTION 'unknown item: %', _item_key;
  END IF;

  SELECT gold INTO cur_gold FROM public.profiles WHERE user_id = uid FOR UPDATE;
  IF cur_gold IS NULL THEN
    INSERT INTO public.profiles (user_id, gold) VALUES (uid, 0)
    ON CONFLICT (user_id) DO NOTHING;
    cur_gold := 0;
  END IF;
  IF cur_gold < cost THEN
    RAISE EXCEPTION 'not enough gold (have %, need %)', cur_gold, cost;
  END IF;

  UPDATE public.profiles SET gold = gold - cost WHERE user_id = uid;

  IF _item_key = 'exp_potion' THEN
    UPDATE public.owned_dragons SET exp = exp + 100 WHERE id = owned_id;
  ELSIF _item_key = 'forget_potion' THEN
    UPDATE public.owned_dragons SET stat_points = 0 WHERE id = owned_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'remaining_gold', cur_gold - cost);
END;
$$;

CREATE OR REPLACE FUNCTION public.bond_with_dragon(_dragon_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  owned_id uuid;
  cur_qty int;
  new_exp int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  owned_id := public.ensure_owned_dragon(uid, _dragon_uuid);

  SELECT quantity INTO cur_qty FROM public.user_inventory
   WHERE user_id = uid AND item_key = 'bonding_token' FOR UPDATE;

  IF COALESCE(cur_qty, 0) < 1 THEN
    RAISE EXCEPTION 'no bonding token';
  END IF;

  UPDATE public.user_inventory
     SET quantity = quantity - 1
   WHERE user_id = uid AND item_key = 'bonding_token';

  UPDATE public.owned_dragons SET exp = exp + 500 WHERE id = owned_id
  RETURNING exp INTO new_exp;

  RETURN jsonb_build_object('ok', true, 'exp', new_exp);
END;
$$;

CREATE OR REPLACE FUNCTION public.award_battle_reward(_outcome text, _dragon_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  owned_id uuid;
  gold_delta int := 0;
  exp_delta  int := 0;
  new_gold   int;
  new_exp    int;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF _outcome = 'win' THEN
    gold_delta := 100; exp_delta := 50;
  ELSIF _outcome = 'lose' THEN
    gold_delta := 20; exp_delta := 0;
  ELSIF _outcome = 'draw' THEN
    gold_delta := 30; exp_delta := 10;
  ELSE
    RAISE EXCEPTION 'invalid outcome: %', _outcome;
  END IF;

  INSERT INTO public.profiles (user_id, gold) VALUES (uid, 0)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.profiles
     SET gold = gold + gold_delta
   WHERE user_id = uid
  RETURNING gold INTO new_gold;

  IF _dragon_uuid IS NOT NULL AND exp_delta > 0 THEN
    owned_id := public.ensure_owned_dragon(uid, _dragon_uuid);
    UPDATE public.owned_dragons SET exp = exp + exp_delta WHERE id = owned_id
    RETURNING exp INTO new_exp;
  END IF;

  RETURN jsonb_build_object(
    'gold_delta', gold_delta,
    'exp_delta',  exp_delta,
    'gold',       new_gold,
    'exp',        new_exp
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_story_reward(_chapter_id text, _node_key text, _dragon_uuid uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  node public.story_nodes;
  r jsonb;
  gold_delta int := 0;
  points_delta int := 0;
  items jsonb := '{}'::jsonb;
  item_key text;
  item_qty int;
  new_gold int;
  owned_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO node FROM public.story_nodes
   WHERE chapter_id = _chapter_id AND node_key = _node_key AND is_published = true
   LIMIT 1;

  IF node.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'NODE_NOT_FOUND');
  END IF;

  r := COALESCE(node.rewards, '{}'::jsonb);
  gold_delta := GREATEST(COALESCE((r->>'gold')::int, 0), 0);
  points_delta := GREATEST(COALESCE((r->>'stat_points')::int, 0), 0);
  IF jsonb_typeof(r->'items') = 'object' THEN
    items := r->'items';
  END IF;

  IF gold_delta = 0 AND points_delta = 0 AND items = '{}'::jsonb THEN
    RETURN jsonb_build_object('ok', true, 'granted', false, 'reason', 'NO_REWARD');
  END IF;

  INSERT INTO public.story_reward_claims (user_id, chapter_id, node_key, gold_awarded, stat_points_awarded, items_awarded)
  VALUES (uid, _chapter_id, _node_key, gold_delta, points_delta, items)
  ON CONFLICT (user_id, chapter_id, node_key) DO NOTHING;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'granted', false, 'reason', 'ALREADY_CLAIMED');
  END IF;

  INSERT INTO public.profiles (user_id, gold) VALUES (uid, 0)
  ON CONFLICT (user_id) DO NOTHING;

  IF gold_delta > 0 THEN
    UPDATE public.profiles SET gold = gold + gold_delta WHERE user_id = uid
    RETURNING gold INTO new_gold;
  ELSE
    SELECT gold INTO new_gold FROM public.profiles WHERE user_id = uid;
  END IF;

  IF points_delta > 0 AND _dragon_uuid IS NOT NULL THEN
    owned_id := public.ensure_owned_dragon(uid, _dragon_uuid);
    UPDATE public.owned_dragons SET stat_points = stat_points + points_delta WHERE id = owned_id;
  END IF;

  FOR item_key, item_qty IN
    SELECT key, GREATEST(COALESCE(value::text::int, 0), 0) FROM jsonb_each(items)
  LOOP
    IF item_qty > 0 THEN
      INSERT INTO public.user_inventory (user_id, item_key, quantity)
      VALUES (uid, item_key, item_qty)
      ON CONFLICT (user_id, item_key)
      DO UPDATE SET quantity = public.user_inventory.quantity + item_qty;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'granted', true,
    'gold', gold_delta,
    'stat_points', points_delta,
    'items', items,
    'total_gold', new_gold
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.recruit_dragon(_dragon_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  exists_row uuid;
  new_bonus int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _dragon_uuid IS NULL THEN RAISE EXCEPTION 'dragon required'; END IF;
  IF NOT public.can_use_dragon(uid, _dragon_uuid) THEN
    RAISE EXCEPTION 'DRAGON_NOT_AVAILABLE';
  END IF;

  SELECT id INTO exists_row FROM public.owned_dragons
   WHERE user_id = uid AND dragon_id = _dragon_uuid;

  IF exists_row IS NOT NULL THEN
    UPDATE public.owned_dragons
       SET bonus_stat_points = bonus_stat_points + 10,
           stat_points = stat_points + 10
     WHERE id = exists_row
    RETURNING bonus_stat_points INTO new_bonus;
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'bonus_stat_points', new_bonus);
  END IF;

  INSERT INTO public.owned_dragons (user_id, dragon_id)
  VALUES (uid, _dragon_uuid);

  RETURN jsonb_build_object('ok', true, 'duplicate', false);
END;
$$;

-- 5) Tighten EXECUTE grants on the growth RPCs
REVOKE ALL ON FUNCTION public.spend_stat_point(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.train_stat_with_gold(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.purchase_shop_item(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bond_with_dragon(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.award_battle_reward(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_story_reward(text, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.recruit_dragon(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.spend_stat_point(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.train_stat_with_gold(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.purchase_shop_item(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.bond_with_dragon(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.award_battle_reward(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_story_reward(text, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recruit_dragon(uuid) TO authenticated, service_role;