UPDATE storage.buckets SET public = false WHERE id = 'card-scans';

DROP POLICY IF EXISTS "Public can view card scans" ON storage.objects;

CREATE POLICY "Users view own scans"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'card-scans'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );