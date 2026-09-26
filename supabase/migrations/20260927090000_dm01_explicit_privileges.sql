-- Supabase default privileges may grant anon/authenticated more than PUBLIC.
-- RLS controls rows, not TRUNCATE; keep writes exclusively behind owner-checked RPCs.
REVOKE ALL ON TABLE public.dragon_drafts, public.dragon_assets,
  public.personal_dragon_profiles FROM anon, authenticated;
GRANT SELECT ON TABLE public.dragon_drafts, public.dragon_assets,
  public.personal_dragon_profiles TO authenticated;

REVOKE ALL ON FUNCTION public.save_dragon_draft(uuid, integer, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.register_dragon_asset(uuid, text, text, text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.abandon_dragon_draft(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.purge_abandoned_dragon_draft(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.create_personal_dragon_v2(uuid, text, text) FROM anon;
