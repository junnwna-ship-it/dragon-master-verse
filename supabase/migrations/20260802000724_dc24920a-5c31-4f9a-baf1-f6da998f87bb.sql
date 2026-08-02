-- store_items
CREATE TABLE public.store_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price_usd numeric(10,2) NOT NULL DEFAULT 0,
  gold_reward integer NOT NULL DEFAULT 0,
  item_type text NOT NULL DEFAULT 'gold',
  image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_items TO authenticated;
GRANT ALL ON public.store_items TO service_role;
ALTER TABLE public.store_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access to store_items" ON public.store_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users read published store_items" ON public.store_items FOR SELECT TO authenticated
  USING (is_published = true);

-- story_nodes
CREATE TABLE public.story_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_number integer NOT NULL DEFAULT 1,
  node_type text NOT NULL DEFAULT 'battle',
  title text NOT NULL,
  description text,
  quiz_ids uuid[] NOT NULL DEFAULT '{}',
  background_image_url text,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_nodes TO authenticated;
GRANT ALL ON public.story_nodes TO service_role;
ALTER TABLE public.story_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access to story_nodes" ON public.story_nodes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users read published story_nodes" ON public.story_nodes FOR SELECT TO authenticated
  USING (is_published = true);

-- training_stats
CREATE TABLE public.training_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stat_name text NOT NULL,
  stat_code text NOT NULL,
  base_cost integer NOT NULL DEFAULT 100,
  stat_increase integer NOT NULL DEFAULT 10,
  icon_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_stats TO authenticated;
GRANT ALL ON public.training_stats TO service_role;
ALTER TABLE public.training_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access to training_stats" ON public.training_stats FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users read published training_stats" ON public.training_stats FOR SELECT TO authenticated
  USING (is_published = true);

-- game_settings
CREATE TABLE public.game_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text,
  description text,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_settings TO authenticated;
GRANT ALL ON public.game_settings TO service_role;
ALTER TABLE public.game_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access to game_settings" ON public.game_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users read published game_settings" ON public.game_settings FOR SELECT TO authenticated
  USING (is_published = true);

-- updated_at triggers
CREATE TRIGGER set_store_items_updated_at BEFORE UPDATE ON public.store_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_story_nodes_updated_at BEFORE UPDATE ON public.story_nodes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_training_stats_updated_at BEFORE UPDATE ON public.training_stats
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_game_settings_updated_at BEFORE UPDATE ON public.game_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();