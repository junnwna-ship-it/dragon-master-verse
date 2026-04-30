-- Scanned cards table
CREATE TABLE public.scanned_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  element TEXT NOT NULL CHECK (element IN ('Wood','Water','Fire','Earth','Metal')),
  hp INT NOT NULL DEFAULT 50,
  max_hp INT NOT NULL DEFAULT 50,
  mp INT NOT NULL DEFAULT 50,
  atk INT NOT NULL DEFAULT 40,
  def INT NOT NULL DEFAULT 40,
  image_url TEXT,
  confidence NUMERIC(3,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.scanned_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cards"
  ON public.scanned_cards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cards"
  ON public.scanned_cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own cards"
  ON public.scanned_cards FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_scanned_cards_user ON public.scanned_cards(user_id, created_at DESC);

-- Storage bucket for card images
INSERT INTO storage.buckets (id, name, public)
VALUES ('card-scans', 'card-scans', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view card scans"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'card-scans');

CREATE POLICY "Users upload to own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'card-scans'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users delete own scans"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'card-scans'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );