CREATE OR REPLACE FUNCTION public.summon_dragon(_count integer DEFAULT 1, _pay text DEFAULT 'gold'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  n int := COALESCE(_count, 1);
  gold_cost int;
  ticket_cost int;
  cur_gold int;
  cur_tickets int;
  results jsonb := '[]'::jsonb;
  i int;
  r record;
  picked_id uuid;
  picked_name text;
  picked_rarity text;
  total_weight numeric;
  roll numeric;
  acc numeric;
  is_dup boolean;
  shards int;
  guarantee_needed boolean;
  got_rare boolean := false;
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

  SELECT SUM(p.weight) INTO total_weight FROM public.dragon_pool p
    JOIN public.dragons d ON d.id = p.dragon_id WHERE p.is_active = true;
  IF COALESCE(total_weight, 0) <= 0 THEN RAISE EXCEPTION 'EMPTY_POOL'; END IF;

  FOR i IN 1..n LOOP
    picked_id := NULL;
    picked_name := NULL;
    picked_rarity := NULL;

    -- On the final pull of a 10-draw, force rare-or-better if none appeared yet.
    guarantee_needed := (n = 10 AND i = n AND NOT got_rare);

    IF guarantee_needed THEN
      SELECT p.dragon_id, p.rarity, d.name
        INTO picked_id, picked_rarity, picked_name
        FROM public.dragon_pool p JOIN public.dragons d ON d.id = p.dragon_id
       WHERE p.is_active = true AND p.rarity <> 'common'
       ORDER BY random() / GREATEST(p.weight, 1) ASC
       LIMIT 1;
    END IF;

    IF picked_id IS NULL THEN
      roll := random() * total_weight;
      acc := 0;
      FOR r IN
        SELECT p.dragon_id, p.rarity, d.name
          FROM public.dragon_pool p JOIN public.dragons d ON d.id = p.dragon_id
         WHERE p.is_active = true
         ORDER BY p.rarity, d.name
      LOOP
        picked_id := r.dragon_id;
        picked_rarity := r.rarity;
        picked_name := r.name;
        SELECT acc + p.weight INTO acc FROM public.dragon_pool p WHERE p.dragon_id = r.dragon_id AND p.is_active = true LIMIT 1;
        EXIT WHEN acc >= roll;
      END LOOP;
    END IF;

    IF picked_id IS NULL THEN RAISE EXCEPTION 'EMPTY_POOL'; END IF;
    IF picked_rarity <> 'common' THEN got_rare := true; END IF;

    SELECT EXISTS (SELECT 1 FROM public.owned_dragons o
                    WHERE o.user_id = uid AND o.dragon_id = picked_id)
      INTO is_dup;

    shards := 0;
    IF is_dup THEN
      shards := CASE picked_rarity
        WHEN 'legendary' THEN 40
        WHEN 'epic' THEN 20
        WHEN 'rare' THEN 10
        ELSE 5 END;
      INSERT INTO public.user_inventory (user_id, item_key, quantity)
      VALUES (uid, 'dragon_shard', shards)
      ON CONFLICT (user_id, item_key) DO UPDATE SET quantity = public.user_inventory.quantity + shards
      RETURNING quantity INTO new_shards;
    ELSE
      INSERT INTO public.owned_dragons (user_id, dragon_id) VALUES (uid, picked_id)
      ON CONFLICT (user_id, dragon_id) DO NOTHING;
    END IF;

    INSERT INTO public.summon_history (user_id, dragon_id, dragon_name, rarity, duplicate, shards_awarded, paid_with)
    VALUES (uid, picked_id, picked_name, picked_rarity, is_dup, shards, _pay);

    results := results || jsonb_build_array(jsonb_build_object(
      'dragon_id', picked_id,
      'name', picked_name,
      'rarity', picked_rarity,
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
$function$;

REVOKE ALL ON FUNCTION public.summon_dragon(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.summon_dragon(integer, text) TO authenticated, service_role;