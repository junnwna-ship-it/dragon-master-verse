-- ============================================================
-- 1) profiles 테이블 (user_id별 gold 등)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  gold       integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated user can read any profile (gold ranking 등 활용 여지)
CREATE POLICY "Authenticated users can view profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- Insert: 본인 row만 생성 가능 (트리거가 자동 생성하지만 만일을 대비)
CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 의도적으로 UPDATE/DELETE 정책을 만들지 않음 → 클라이언트에서 직접 골드 수정 불가.
--   골드 변경은 SECURITY DEFINER RPC를 통해서만 발생.

-- updated_at 트리거
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 회원가입 시 profile 자동 생성
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, gold)
  VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 기존 사용자도 profile 백필
INSERT INTO public.profiles (user_id, gold)
SELECT id, 0 FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- 2) dragons 테이블 컬럼 추가 (level/exp/stat_points)
-- ============================================================
ALTER TABLE public.dragons
  ADD COLUMN IF NOT EXISTS level       integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS exp         integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stat_points integer NOT NULL DEFAULT 0;

-- 스탯 분배는 SECURITY DEFINER RPC에서 처리. 일반 UPDATE 정책은 admin만 → 그대로 유지.

-- ============================================================
-- 3) app_settings — 전역 피처 플래그
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- 누구나(로그인) 읽기
CREATE POLICY "Authenticated users can view settings"
ON public.app_settings FOR SELECT
TO authenticated
USING (true);

-- admin만 쓰기
CREATE POLICY "Admins can insert settings"
ON public.app_settings FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update settings"
ON public.app_settings FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete settings"
ON public.app_settings FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 기본 플래그 시드
INSERT INTO public.app_settings (key, value) VALUES
  ('isShopOpen',     'false'::jsonb),
  ('isTrainingOpen', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Realtime: 토글 변경을 모든 클라이언트에 즉시 전달
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;

-- ============================================================
-- 4) RPC: award_battle_reward
--    승/패에 따라 gold/exp 지급. 출전(주인 보상) 드래곤이 본인 소유 dragon이
--    아니어도 일단 exp는 지급(시드 드래곤 활용 가능). gold는 호출 유저 본인.
-- ============================================================
CREATE OR REPLACE FUNCTION public.award_battle_reward(
  _outcome text,            -- 'win' | 'lose' | 'draw'
  _dragon_uuid uuid         -- 출전 드래곤 (NULL이면 exp 생략)
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  gold_delta int := 0;
  exp_delta  int := 0;
  new_gold   int;
  new_exp    int;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF _outcome = 'win' THEN
    gold_delta := 100;
    exp_delta  := 50;
  ELSIF _outcome = 'lose' THEN
    gold_delta := 20;
    exp_delta  := 0;
  ELSIF _outcome = 'draw' THEN
    gold_delta := 30;
    exp_delta  := 10;
  ELSE
    RAISE EXCEPTION 'invalid outcome: %', _outcome;
  END IF;

  -- profile 보장
  INSERT INTO public.profiles (user_id, gold) VALUES (uid, 0)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.profiles
     SET gold = gold + gold_delta
   WHERE user_id = uid
  RETURNING gold INTO new_gold;

  IF _dragon_uuid IS NOT NULL AND exp_delta > 0 THEN
    UPDATE public.dragons
       SET exp = exp + exp_delta
     WHERE id = _dragon_uuid
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

REVOKE ALL ON FUNCTION public.award_battle_reward(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_battle_reward(text, uuid) TO authenticated;

-- ============================================================
-- 5) RPC: purchase_shop_item — 골드 차감 + 효과 적용
--    item_key:
--      'exp_potion'      → 500G, 지정 드래곤 exp +100
--      'forget_potion'   → 1000G, 지정 드래곤 stat_points 초기화 (간이 망각)
-- ============================================================
CREATE OR REPLACE FUNCTION public.purchase_shop_item(
  _item_key text,
  _dragon_uuid uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  cost int;
  cur_gold int;
  shop_open boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  -- 피처 플래그 확인 (강제)
  SELECT (value)::text::boolean INTO shop_open
    FROM public.app_settings WHERE key = 'isShopOpen';
  IF NOT COALESCE(shop_open, false) THEN
    RAISE EXCEPTION 'shop is closed';
  END IF;

  IF _item_key = 'exp_potion' THEN
    cost := 500;
  ELSIF _item_key = 'forget_potion' THEN
    cost := 1000;
  ELSE
    RAISE EXCEPTION 'unknown item: %', _item_key;
  END IF;

  SELECT gold INTO cur_gold FROM public.profiles WHERE user_id = uid FOR UPDATE;
  IF cur_gold IS NULL THEN
    INSERT INTO public.profiles (user_id, gold) VALUES (uid, 0);
    cur_gold := 0;
  END IF;
  IF cur_gold < cost THEN
    RAISE EXCEPTION 'not enough gold (have %, need %)', cur_gold, cost;
  END IF;

  UPDATE public.profiles SET gold = gold - cost WHERE user_id = uid;

  IF _item_key = 'exp_potion' THEN
    UPDATE public.dragons SET exp = exp + 100 WHERE id = _dragon_uuid;
  ELSIF _item_key = 'forget_potion' THEN
    UPDATE public.dragons SET stat_points = 0 WHERE id = _dragon_uuid;
  END IF;

  RETURN jsonb_build_object('ok', true, 'remaining_gold', cur_gold - cost);
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_shop_item(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_shop_item(text, uuid) TO authenticated;

-- ============================================================
-- 6) RPC: spend_stat_point — 1점 분배
--    stat: 'atk' | 'hp' | 'def' | 'mp'
-- ============================================================
CREATE OR REPLACE FUNCTION public.spend_stat_point(
  _dragon_uuid uuid,
  _stat text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  pts int;
  training_open boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT (value)::text::boolean INTO training_open
    FROM public.app_settings WHERE key = 'isTrainingOpen';
  IF NOT COALESCE(training_open, false) THEN
    RAISE EXCEPTION 'training is closed';
  END IF;

  SELECT stat_points INTO pts FROM public.dragons WHERE id = _dragon_uuid FOR UPDATE;
  IF pts IS NULL THEN RAISE EXCEPTION 'dragon not found'; END IF;
  IF pts < 1 THEN RAISE EXCEPTION 'no stat points'; END IF;

  IF _stat = 'atk' THEN
    UPDATE public.dragons SET atk = atk + 10, stat_points = stat_points - 1 WHERE id = _dragon_uuid;
  ELSIF _stat = 'hp' THEN
    UPDATE public.dragons SET max_hp = max_hp + 50, stat_points = stat_points - 1 WHERE id = _dragon_uuid;
  ELSIF _stat = 'def' THEN
    UPDATE public.dragons SET def = def + 5, stat_points = stat_points - 1 WHERE id = _dragon_uuid;
  ELSIF _stat = 'mp' THEN
    UPDATE public.dragons SET mp = mp + 20, stat_points = stat_points - 1 WHERE id = _dragon_uuid;
  ELSE
    RAISE EXCEPTION 'invalid stat: %', _stat;
  END IF;

  RETURN jsonb_build_object('ok', true, 'remaining_points', pts - 1);
END;
$$;

REVOKE ALL ON FUNCTION public.spend_stat_point(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spend_stat_point(uuid, text) TO authenticated;