-- Run as a DB administrator. Synthetic fixtures are always rolled back.
-- No real credentials, Storage objects, paid AI calls, or existing player writes.
BEGIN;
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('7b902700-0000-4000-8000-000000000001', 'dm01-owner@example.invalid', '{"display_name":"DM01 smoke owner"}'),
  ('7b902700-0000-4000-8000-000000000002', 'dm01-other@example.invalid', '{"display_name":"DM01 smoke other"}');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '7b902700-0000-4000-8000-000000000001', true);
DO $test$
DECLARE
  draft uuid := '7b902700-0000-4000-8000-000000000003';
  metadata jsonb := '{"step":1,"element":"Fire","name":"Smoke test","selectedImage":"original"}';
  revision integer;
BEGIN
  IF has_table_privilege(current_user, 'public.dragon_drafts', 'TRUNCATE')
     OR has_table_privilege(current_user, 'public.dragon_drafts', 'INSERT') THEN
    RAISE EXCEPTION 'FAIL: direct write privilege';
  END IF;
  revision := public.save_dragon_draft(draft, 0, metadata);
  IF revision <> 1 THEN RAISE EXCEPTION 'FAIL: initial revision'; END IF;
  revision := public.save_dragon_draft(draft, 1, metadata || '{"name":"Updated"}');
  IF revision <> 2 THEN RAISE EXCEPTION 'FAIL: update revision'; END IF;
  BEGIN
    PERFORM public.save_dragon_draft(draft, 1, metadata);
    RAISE EXCEPTION 'FAIL: stale revision accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'DRAFT_CONFLICT' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM public.dragon_drafts WHERE draft_id=draft) <> 1 THEN
    RAISE EXCEPTION 'FAIL: owner cannot read';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', '7b902700-0000-4000-8000-000000000002', true);
  IF EXISTS (SELECT 1 FROM public.dragon_drafts WHERE draft_id=draft) THEN
    RAISE EXCEPTION 'FAIL: another owner can read';
  END IF;
  BEGIN
    PERFORM public.save_dragon_draft(draft, 2, metadata);
    RAISE EXCEPTION 'FAIL: another owner can update';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'DRAFT_CONFLICT' THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claim.sub', '7b902700-0000-4000-8000-000000000001', true);
  PERFORM public.abandon_dragon_draft(draft);
  PERFORM public.purge_abandoned_dragon_draft(draft);
  IF EXISTS (SELECT 1 FROM public.dragon_drafts WHERE draft_id=draft) THEN
    RAISE EXCEPTION 'FAIL: draft not purged';
  END IF;
END;
$test$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: revision CAS, owner read, cross-owner read/write denial, abandon/purge, direct-write restriction; fixtures rolled back' AS result;
