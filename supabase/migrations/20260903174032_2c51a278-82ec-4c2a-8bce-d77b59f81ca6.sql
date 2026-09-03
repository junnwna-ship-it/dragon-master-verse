ALTER TABLE public.story_nodes
  ADD COLUMN IF NOT EXISTS rewards jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.story_reward_claims (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_id text NOT NULL,
  node_key text NOT NULL,
  gold_awarded integer NOT NULL DEFAULT 0,
  stat_points_awarded integer NOT NULL DEFAULT 0,
  items_awarded jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, chapter_id, node_key)
);

GRANT SELECT ON public.story_reward_claims TO authenticated;
GRANT ALL ON public.story_reward_claims TO service_role;

ALTER TABLE public.story_reward_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own story reward claims"
  ON public.story_reward_claims FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.claim_story_reward(_chapter_id text, _node_key text, _dragon_uuid uuid DEFAULT NULL)
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
    UPDATE public.dragons SET stat_points = stat_points + points_delta WHERE id = _dragon_uuid;
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

GRANT EXECUTE ON FUNCTION public.claim_story_reward(text, text, uuid) TO authenticated;
