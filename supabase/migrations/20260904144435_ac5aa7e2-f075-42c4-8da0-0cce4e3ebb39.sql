GRANT SELECT ON public.dragon_pool TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.dragon_pool TO authenticated;
GRANT ALL ON public.dragon_pool TO service_role;

GRANT SELECT ON public.combat_items TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.combat_items TO authenticated;
GRANT ALL ON public.combat_items TO service_role;

GRANT SELECT ON public.summon_history TO authenticated;
GRANT ALL ON public.summon_history TO service_role;