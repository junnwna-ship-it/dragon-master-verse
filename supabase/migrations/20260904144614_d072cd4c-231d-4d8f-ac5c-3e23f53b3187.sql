DROP POLICY IF EXISTS "combat_items published readable" ON public.combat_items;
DROP POLICY IF EXISTS "combat_items readable" ON public.combat_items;

CREATE POLICY "combat_items published readable by anyone"
ON public.combat_items FOR SELECT TO anon
USING (is_published = true);

CREATE POLICY "combat_items readable by users and admins"
ON public.combat_items FOR SELECT TO authenticated
USING (is_published = true OR public.has_role(auth.uid(), 'admin'));