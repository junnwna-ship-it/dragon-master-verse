REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;

DROP POLICY IF EXISTS "dragon_pool active readable" ON public.dragon_pool;

CREATE POLICY "dragon_pool active readable by anyone"
ON public.dragon_pool FOR SELECT TO anon
USING (is_active = true);

CREATE POLICY "dragon_pool readable by users and admins"
ON public.dragon_pool FOR SELECT TO authenticated
USING (is_active = true OR public.has_role(auth.uid(), 'admin'));