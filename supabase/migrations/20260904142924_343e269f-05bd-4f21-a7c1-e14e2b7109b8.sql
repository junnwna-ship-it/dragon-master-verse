-- 1) dragon_pool
CREATE TABLE public.dragon_pool (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dragon_id uuid NOT NULL REFERENCES public.dragons(id) ON DELETE CASCADE,
  rarity text NOT NULL CHECK (rarity IN ('common','rare','epic','legendary')),
  weight integer NOT NULL DEFAULT 100 CHECK (weight > 0),
  shard_cost integer NOT NULL DEFAULT 20 CHECK (shard_cost > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dragon_id)
);
GRANT SELECT ON public.dragon_pool TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dragon_pool TO authenticated;
GRANT ALL ON public.dragon_pool TO service_role;
ALTER TABLE public.dragon_pool ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dragon_pool active readable" ON public.dragon_pool
  FOR SELECT USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "dragon_pool admin manage" ON public.dragon_pool
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER set_dragon_pool_updated_at BEFORE UPDATE ON public.dragon_pool
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) summon_history
CREATE TABLE public.summon_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dragon_id uuid REFERENCES public.dragons(id) ON DELETE SET NULL,
  dragon_name text NOT NULL,
  rarity text NOT NULL,
  duplicate boolean NOT NULL DEFAULT false,
  shards_awarded integer NOT NULL DEFAULT 0,
  paid_with text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.summon_history TO authenticated;
GRANT ALL ON public.summon_history TO service_role;
ALTER TABLE public.summon_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "summon_history own read" ON public.summon_history
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 3) combat_items
CREATE TABLE public.combat_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_key text NOT NULL UNIQUE,
  name text NOT NULL,
  effect_type text NOT NULL,
  effect_value integer NOT NULL DEFAULT 0,
  duration_turns integer NOT NULL DEFAULT 0,
  price_gold integer NOT NULL DEFAULT 0,
  icon_url text,
  description text,
  log_text text,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.combat_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.combat_items TO authenticated;
GRANT ALL ON public.combat_items TO service_role;
ALTER TABLE public.combat_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "combat_items published readable" ON public.combat_items
  FOR SELECT USING (is_published = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "combat_items admin manage" ON public.combat_items
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER set_combat_items_updated_at BEFORE UPDATE ON public.combat_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Seed the pool from existing dragons
INSERT INTO public.dragon_pool (dragon_id, rarity, weight, shard_cost)
SELECT d.id,
       CASE
         WHEN d.atk >= 130 THEN 'legendary'
         WHEN d.atk >= 110 THEN 'epic'
         WHEN d.atk >= 95  THEN 'rare'
         ELSE 'common'
       END,
       CASE
         WHEN d.atk >= 130 THEN 20
         WHEN d.atk >= 110 THEN 80
         WHEN d.atk >= 95  THEN 300
         ELSE 600
       END,
       CASE
         WHEN d.atk >= 130 THEN 120
         WHEN d.atk >= 110 THEN 80
         WHEN d.atk >= 95  THEN 40
         ELSE 20
       END
FROM public.dragons d
WHERE d.is_seed = true
ON CONFLICT (dragon_id) DO NOTHING;

-- 5) Seed combat items + summon ticket
INSERT INTO public.combat_items (item_key, name, effect_type, effect_value, duration_turns, price_gold, description, log_text, sort_order, is_published) VALUES
  ('life_potion',    'Potion of Life',    'heal_hp',       40, 0, 300,  'Restores 40% of max HP instantly.', 'drinks the Potion of Life and recovers vitality!', 1, true),
  ('mana_potion',    'Potion of Mana',    'heal_mp',       30, 0, 250,  'Restores 30 MP instantly.', 'drinks the Potion of Mana and feels magic surge!', 2, true),
  ('valor_horn',     'Horn of Valor',     'buff_atk',      50, 1, 400,  'Attack +50% for 1 turn.', 'blows the Horn of Valor — attack rises!', 3, true),
  ('guardian_seal',  'Guardian Seal',     'buff_def',      50, 2, 400,  'Defense +50% for 2 turns.', 'raises the Guardian Seal — defense hardens!', 4, true),
  ('flame_bomb',     'Flame Bomb',        'damage',        80, 0, 350,  'Deals 80 fixed damage to the enemy.', 'hurls a Flame Bomb!', 5, true),
  ('curse_charm',    'Curse Charm',       'debuff_atk',    30, 2, 350,  'Enemy attack -30% for 2 turns.', 'invokes the Curse Charm — the enemy weakens!', 6, true),
  ('phoenix_feather','Immortal Feather',  'revive',        30, 0, 900,  'Revives once with 30% HP when defeated.', 'is wrapped in the Immortal Feather!', 7, true),
  ('sanctuary_shield','Sanctuary Shield', 'shield',        1,  1, 500,  'Nullifies the next incoming hit.', 'summons the Sanctuary Shield!', 8, true),
  ('chaos_dice',     'Dice of Chaos',     'random',        0,  0, 450,  'Triggers one random special effect.', 'rolls the Dice of Chaos...', 9, true),
  ('summon_ticket',  'Summon Ticket',     'summon_ticket', 0,  0, 500,  'Used at the Summoning Altar for one summon.', NULL, 10, true)
ON CONFLICT (item_key) DO NOTHING;

-- 6) summon_dragon RPC
CREATE OR REPLACE FUNCTION public.summon_dragon(_count integer DEFAULT 1, _pay text DEFAULT 'gold')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  n int := COALESCE(_count, 1);
  gold_cost int;
  ticket_cost int;
  cur_gold int;
  cur_tickets int;
  results jsonb := '[]'::jsonb;
  i int;
  pick record;
  total_weight numeric;
  roll numeric;
  acc numeric;
  is_dup boolean;
  shards int;
  guarantee_needed boolean;
  new_gold int;
  new_shards int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF n <> 1 AND n <> 10 THEN RAISE EXCEPTION 'INVALID_COUNT'; END IF;
  IF _pay NOT IN ('gold','ticket') THEN RAISE EXCEPTION 'INVALID_PAYMENT'; END IF;

  gold_cost := CASE WHEN n = 10 THEN 4500 ELSE 500 END;
  ticket_cost := n;

  INSERT INTO public.profiles (user_id, gold) VALUES (uid, 0) ON CONFLICT (user_id) DO NOTHING;

  IF _pay = 'gold' THEN
    SELECT gold INTO cur_gold FROM public.profiles WHERE user_id = uid FOR UPDATE;
    IF COALESCE(cur_gold, 0) < gold_cost THEN RAISE EXCEPTION 'NOT_ENOUGH_GOLD'; END IF;
    UPDATE public.profiles SET gold = gold - gold_cost WHERE user_id = uid RETURNING gold INTO new_gold;
  ELSE
    SELECT quantity INTO cur_tickets FROM public.user_inventory
     WHERE user_id = uid AND item_key = 'summon_ticket' FOR UPDATE;
    IF COALESCE(cur_tickets, 0) < ticket_cost THEN RAISE EXCEPTION 'NOT_ENOUGH_TICKETS'; END IF;
    UPDATE public.user_inventory SET quantity = quantity - ticket_cost
     WHERE user_id = uid AND item_key = 'summon_ticket';
    SELECT gold INTO new_gold FROM public.profiles WHERE user_id = uid;
  END IF;

  SELECT SUM(weight) INTO total_weight FROM public.dragon_pool p
    JOIN public.dragons d ON d.id = p.dragon_id WHERE p.is_active = true;
  IF COALESCE(total_weight, 0) <= 0 THEN RAISE EXCEPTION 'EMPTY_POOL'; END IF;

  guarantee_needed := (n = 10);

  FOR i IN 1..n LOOP
    IF guarantee_needed AND i = n THEN
      -- last pull of a 10-draw guarantees rare or better
      SELECT p.dragon_id, p.rarity, p.weight, p.shard_cost, d.name
        INTO pick
        FROM public.dragon_pool p JOIN public.dragons d ON d.id = p.dragon_id
       WHERE p.is_active = true AND p.rarity <> 'common'
       ORDER BY random() * p.weight DESC
       LIMIT 1;
      IF pick.dragon_id IS NULL THEN
        guarantee_needed := false;
      END IF;
    END IF;

    IF pick.dragon_id IS NULL OR NOT (guarantee_needed AND i = n) THEN
      roll := random() * total_weight;
      acc := 0;
      FOR pick IN
        SELECT p.dragon_id, p.rarity, p.weight, p.shard_cost, d.name
          FROM public.dragon_pool p JOIN public.dragons d ON d.id = p.dragon_id
         WHERE p.is_active = true
         ORDER BY p.rarity, d.name
      LOOP
        acc := acc + pick.weight;
        EXIT WHEN acc >= roll;
      END LOOP;
    END IF;

    SELECT EXISTS (SELECT 1 FROM public.owned_dragons o
                    WHERE o.user_id = uid AND o.dragon_id = pick.dragon_id)
      INTO is_dup;

    shards := 0;
    IF is_dup THEN
      shards := CASE pick.rarity
        WHEN 'legendary' THEN 40
        WHEN 'epic' THEN 20
        WHEN 'rare' THEN 10
        ELSE 5 END;
      INSERT INTO public.user_inventory (user_id, item_key, quantity)
      VALUES (uid, 'dragon_shard', shards)
      ON CONFLICT (user_id, item_key) DO UPDATE SET quantity = public.user_inventory.quantity + shards
      RETURNING quantity INTO new_shards;
    ELSE
      INSERT INTO public.owned_dragons (user_id, dragon_id) VALUES (uid, pick.dragon_id)
      ON CONFLICT (user_id, dragon_id) DO NOTHING;
    END IF;

    INSERT INTO public.summon_history (user_id, dragon_id, dragon_name, rarity, duplicate, shards_awarded, paid_with)
    VALUES (uid, pick.dragon_id, pick.name, pick.rarity, is_dup, shards, _pay);

    results := results || jsonb_build_array(jsonb_build_object(
      'dragon_id', pick.dragon_id,
      'name', pick.name,
      'rarity', pick.rarity,
      'duplicate', is_dup,
      'shards', shards
    ));
  END LOOP;

  IF new_shards IS NULL THEN
    SELECT quantity INTO new_shards FROM public.user_inventory
     WHERE user_id = uid AND item_key = 'dragon_shard';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'results', results,
    'gold', new_gold,
    'shards', COALESCE(new_shards, 0)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.summon_dragon(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.summon_dragon(integer, text) TO authenticated, service_role;

-- 7) exchange_shards RPC
CREATE OR REPLACE FUNCTION public.exchange_shards(_dragon_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  cost int;
  cur int;
  already boolean;
  remaining int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT shard_cost INTO cost FROM public.dragon_pool
   WHERE dragon_id = _dragon_uuid AND is_active = true;
  IF cost IS NULL THEN RAISE EXCEPTION 'DRAGON_NOT_IN_POOL'; END IF;

  SELECT EXISTS (SELECT 1 FROM public.owned_dragons WHERE user_id = uid AND dragon_id = _dragon_uuid)
    INTO already;
  IF already THEN RAISE EXCEPTION 'ALREADY_OWNED'; END IF;

  SELECT quantity INTO cur FROM public.user_inventory
   WHERE user_id = uid AND item_key = 'dragon_shard' FOR UPDATE;
  IF COALESCE(cur, 0) < cost THEN RAISE EXCEPTION 'NOT_ENOUGH_SHARDS'; END IF;

  UPDATE public.user_inventory SET quantity = quantity - cost
   WHERE user_id = uid AND item_key = 'dragon_shard'
  RETURNING quantity INTO remaining;

  INSERT INTO public.owned_dragons (user_id, dragon_id) VALUES (uid, _dragon_uuid)
  ON CONFLICT (user_id, dragon_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'shards', remaining, 'cost', cost);
END;
$$;
REVOKE ALL ON FUNCTION public.exchange_shards(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.exchange_shards(uuid) TO authenticated, service_role;

-- 8) buy_combat_item RPC
CREATE OR REPLACE FUNCTION public.buy_combat_item(_item_key text, _quantity integer DEFAULT 1)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  qty int := COALESCE(_quantity, 1);
  it public.combat_items;
  cost int;
  cur_gold int;
  new_gold int;
  new_qty int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF qty < 1 OR qty > 99 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;

  SELECT * INTO it FROM public.combat_items WHERE item_key = _item_key AND is_published = true;
  IF it.id IS NULL THEN RAISE EXCEPTION 'UNKNOWN_ITEM'; END IF;
  IF it.price_gold <= 0 THEN RAISE EXCEPTION 'ITEM_NOT_FOR_SALE'; END IF;

  cost := it.price_gold * qty;

  INSERT INTO public.profiles (user_id, gold) VALUES (uid, 0) ON CONFLICT (user_id) DO NOTHING;
  SELECT gold INTO cur_gold FROM public.profiles WHERE user_id = uid FOR UPDATE;
  IF COALESCE(cur_gold, 0) < cost THEN RAISE EXCEPTION 'NOT_ENOUGH_GOLD'; END IF;

  UPDATE public.profiles SET gold = gold - cost WHERE user_id = uid RETURNING gold INTO new_gold;

  INSERT INTO public.user_inventory (user_id, item_key, quantity)
  VALUES (uid, _item_key, qty)
  ON CONFLICT (user_id, item_key) DO UPDATE SET quantity = public.user_inventory.quantity + qty
  RETURNING quantity INTO new_qty;

  RETURN jsonb_build_object('ok', true, 'item_key', _item_key, 'quantity', new_qty, 'remaining_gold', new_gold, 'cost', cost);
END;
$$;
REVOKE ALL ON FUNCTION public.buy_combat_item(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buy_combat_item(text, integer) TO authenticated, service_role;

-- 9) consume_battle_item RPC
CREATE OR REPLACE FUNCTION public.consume_battle_item(_item_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  it public.combat_items;
  cur int;
  remaining int;
  eff text;
  val int;
  dur int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT * INTO it FROM public.combat_items WHERE item_key = _item_key AND is_published = true;
  IF it.id IS NULL THEN RAISE EXCEPTION 'UNKNOWN_ITEM'; END IF;
  IF it.effect_type = 'summon_ticket' THEN RAISE EXCEPTION 'NOT_A_BATTLE_ITEM'; END IF;

  SELECT quantity INTO cur FROM public.user_inventory
   WHERE user_id = uid AND item_key = _item_key FOR UPDATE;
  IF COALESCE(cur, 0) < 1 THEN RAISE EXCEPTION 'OUT_OF_STOCK'; END IF;

  UPDATE public.user_inventory SET quantity = quantity - 1
   WHERE user_id = uid AND item_key = _item_key
  RETURNING quantity INTO remaining;

  eff := it.effect_type;
  val := it.effect_value;
  dur := it.duration_turns;

  IF eff = 'random' THEN
    SELECT c.effect_type, c.effect_value, c.duration_turns
      INTO eff, val, dur
      FROM public.combat_items c
     WHERE c.is_published = true
       AND c.effect_type NOT IN ('random','summon_ticket')
     ORDER BY random() LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'item_key', it.item_key,
    'name', it.name,
    'effect_type', eff,
    'effect_value', val,
    'duration_turns', dur,
    'log_text', it.log_text,
    'remaining', remaining
  );
END;
$$;
REVOKE ALL ON FUNCTION public.consume_battle_item(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_battle_item(text) TO authenticated, service_role;