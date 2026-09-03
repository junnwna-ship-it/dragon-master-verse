GRANT SELECT ON public.story_nodes TO anon;
CREATE POLICY "Anyone reads published story_nodes" ON public.story_nodes FOR SELECT TO anon USING (is_published = true);