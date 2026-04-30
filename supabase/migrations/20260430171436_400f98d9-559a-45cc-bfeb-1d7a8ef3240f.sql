
-- ============= ROLES =============
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============= DRAGONS =============
CREATE TABLE public.dragons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  element TEXT NOT NULL CHECK (element IN ('Wood','Water','Fire','Earth','Light','Dark')),
  max_hp INTEGER NOT NULL DEFAULT 1500,
  mp INTEGER NOT NULL DEFAULT 1000,
  atk INTEGER NOT NULL DEFAULT 1500,
  def INTEGER NOT NULL DEFAULT 1000,
  image_url TEXT,
  lore TEXT,
  is_seed BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dragons_created_at ON public.dragons (created_at DESC);

ALTER TABLE public.dragons ENABLE ROW LEVEL SECURITY;

-- Global read for any authenticated user
CREATE POLICY "Authenticated users can view all dragons"
  ON public.dragons FOR SELECT
  TO authenticated
  USING (true);

-- Any authenticated user can insert; created_by must equal auth.uid() (seeds use NULL via service role)
CREATE POLICY "Authenticated users can insert dragons"
  ON public.dragons FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Only admins can update / delete
CREATE POLICY "Admins can update any dragon"
  ON public.dragons FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete any dragon"
  ON public.dragons FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_dragons_updated_at
BEFORE UPDATE ON public.dragons
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= STORAGE: dragon-images =============
INSERT INTO storage.buckets (id, name, public)
VALUES ('dragon-images', 'dragon-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public can read
CREATE POLICY "Public can view dragon images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'dragon-images');

-- Authenticated can upload to their own folder (path: <uid>/...)
CREATE POLICY "Authenticated can upload to own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'dragon-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update own files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'dragon-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'dragon-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Admins can manage all files
CREATE POLICY "Admins can manage all dragon images"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'dragon-images' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'dragon-images' AND public.has_role(auth.uid(), 'admin'));
