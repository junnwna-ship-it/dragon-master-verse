-- ============================================================
-- 1. QUIZZES — admin-managed question pool for Story Trials
-- ============================================================
CREATE TABLE public.quizzes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question      text NOT NULL,
  choices       jsonb NOT NULL,           -- string[4]
  answer_index  smallint NOT NULL CHECK (answer_index BETWEEN 0 AND 3),
  category      text NOT NULL DEFAULT 'general',
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view quizzes"
  ON public.quizzes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert quizzes"
  ON public.quizzes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update quizzes"
  ON public.quizzes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete quizzes"
  ON public.quizzes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_quizzes_updated_at
BEFORE UPDATE ON public.quizzes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 2. OWNED_DRAGONS — user's recruited dragons
-- ============================================================
CREATE TABLE public.owned_dragons (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL,
  dragon_id           uuid NOT NULL,
  bonus_stat_points   integer NOT NULL DEFAULT 0,
  acquired_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, dragon_id)
);

CREATE INDEX idx_owned_dragons_user ON public.owned_dragons(user_id);

ALTER TABLE public.owned_dragons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dragons"
  ON public.owned_dragons FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own dragons"
  ON public.owned_dragons FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own dragons"
  ON public.owned_dragons FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- 3. USER_INVENTORY — quiz rewards (Bonding Tokens etc.)
-- ============================================================
CREATE TABLE public.user_inventory (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  item_key    text NOT NULL,            -- e.g. 'bonding_token', 'awakening_stone'
  quantity    integer NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_key)
);

CREATE INDEX idx_user_inventory_user ON public.user_inventory(user_id);

ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own inventory"
  ON public.user_inventory FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- writes go through SECURITY DEFINER RPC only (no direct INSERT/UPDATE policy)

CREATE TRIGGER trg_user_inventory_updated_at
BEFORE UPDATE ON public.user_inventory
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 4. RPC: claim_quiz_reward (all 3 correct → +1 bonding_token)
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_quiz_reward(_correct integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  new_qty int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _correct < 3 THEN
    RETURN jsonb_build_object('ok', true, 'rewarded', false);
  END IF;

  INSERT INTO public.user_inventory (user_id, item_key, quantity)
  VALUES (uid, 'bonding_token', 1)
  ON CONFLICT (user_id, item_key)
  DO UPDATE SET quantity = public.user_inventory.quantity + 1
  RETURNING quantity INTO new_qty;

  RETURN jsonb_build_object('ok', true, 'rewarded', true, 'item', 'bonding_token', 'quantity', new_qty);
END;
$$;

-- ============================================================
-- 5. RPC: recruit_dragon — add to owned_dragons OR awaken if duplicate
-- ============================================================
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

  SELECT id INTO exists_row FROM public.owned_dragons
   WHERE user_id = uid AND dragon_id = _dragon_uuid;

  IF exists_row IS NOT NULL THEN
    -- Duplicate → awakening stone effect: +10 bonus stat points
    UPDATE public.owned_dragons
       SET bonus_stat_points = bonus_stat_points + 10
     WHERE id = exists_row
    RETURNING bonus_stat_points INTO new_bonus;
    -- Also bump the dragon's stat_points so the player can spend them
    UPDATE public.dragons SET stat_points = stat_points + 10 WHERE id = _dragon_uuid;
    RETURN jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'bonus_stat_points', new_bonus
    );
  END IF;

  INSERT INTO public.owned_dragons (user_id, dragon_id)
  VALUES (uid, _dragon_uuid);

  RETURN jsonb_build_object('ok', true, 'duplicate', false);
END;
$$;

-- ============================================================
-- 6. RPC: bond_with_dragon — spend 1 bonding_token, +500 EXP
-- ============================================================
CREATE OR REPLACE FUNCTION public.bond_with_dragon(_dragon_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  cur_qty int;
  new_exp int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _dragon_uuid IS NULL THEN RAISE EXCEPTION 'dragon required'; END IF;

  SELECT quantity INTO cur_qty FROM public.user_inventory
   WHERE user_id = uid AND item_key = 'bonding_token' FOR UPDATE;

  IF COALESCE(cur_qty, 0) < 1 THEN
    RAISE EXCEPTION 'no bonding token';
  END IF;

  UPDATE public.user_inventory
     SET quantity = quantity - 1
   WHERE user_id = uid AND item_key = 'bonding_token';

  UPDATE public.dragons SET exp = exp + 500 WHERE id = _dragon_uuid
  RETURNING exp INTO new_exp;

  RETURN jsonb_build_object('ok', true, 'exp', new_exp);
END;
$$;