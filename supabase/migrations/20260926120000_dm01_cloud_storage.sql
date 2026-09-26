-- DM-01-C: private authoring assets, revisioned drafts, and idempotent creation.
-- Apply only after reviewing this migration against the target project.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('dragon-originals', 'dragon-originals', false, 8388608,
        ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 8388608,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp'];

CREATE POLICY "Owner reads private dragon drawings" ON storage.objects
FOR SELECT TO authenticated USING (
  bucket_id = 'dragon-originals' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);
CREATE POLICY "Owner uploads private dragon drawings" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'dragon-originals' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  AND (storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$'
  AND (storage.foldername(name))[3] IN ('original', 'prepared', 'cleaned')
);
CREATE POLICY "Owner deletes private dragon drawings" ON storage.objects
FOR DELETE TO authenticated USING (
  bucket_id = 'dragon-originals' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

CREATE TABLE public.dragon_drafts (
  draft_id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  metadata jsonb NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  dragon_id uuid UNIQUE REFERENCES public.dragons(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dragon_drafts_owner_active_idx ON public.dragon_drafts(owner_id, updated_at DESC)
WHERE status = 'active';
ALTER TABLE public.dragon_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads dragon drafts" ON public.dragon_drafts
FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));

CREATE TABLE public.dragon_assets (
  path text PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  draft_id uuid NOT NULL REFERENCES public.dragon_drafts(draft_id) ON DELETE CASCADE,
  dragon_id uuid REFERENCES public.dragons(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('original', 'prepared', 'cleaned')),
  mime_type text NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
  byte_size integer NOT NULL CHECK (byte_size BETWEEN 1 AND 8388608),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (path LIKE owner_id::text || '/' || draft_id::text || '/' || kind || '/%')
);
CREATE INDEX dragon_assets_dragon_idx ON public.dragon_assets(dragon_id);
ALTER TABLE public.dragon_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads dragon assets" ON public.dragon_assets
FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));

CREATE TABLE public.personal_dragon_profiles (
  dragon_id uuid PRIMARY KEY REFERENCES public.dragons(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  draft_id uuid NOT NULL UNIQUE REFERENCES public.dragon_drafts(draft_id),
  personality text NOT NULL,
  growth_goal text NOT NULL,
  first_meeting text NOT NULL,
  appearance_id text NOT NULL,
  distinctive_features text NOT NULL,
  selected_asset_path text REFERENCES public.dragon_assets(path),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.personal_dragon_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads personal dragon profiles" ON public.personal_dragon_profiles
FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));

GRANT SELECT ON public.dragon_drafts, public.dragon_assets,
  public.personal_dragon_profiles TO authenticated;

-- A single RPC is the only route for metadata writes. The expected revision
-- prevents another tab/device from silently overwriting more recent work.
CREATE FUNCTION public.save_dragon_draft(
  _draft_id uuid, _expected_revision integer, _metadata jsonb
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := (SELECT auth.uid());
  next_revision integer;
  field_name text;
  asset_path text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF _metadata IS NULL OR jsonb_typeof(_metadata) <> 'object'
     OR pg_catalog.length(_metadata::text) > 12000
     OR _expected_revision < 0
     OR _metadata->>'step' IS NULL
     OR (_metadata->>'step')::integer NOT BETWEEN 1 AND 3
     OR coalesce(_metadata->>'element','') NOT IN ('Wood','Water','Fire','Earth','Light','Dark')
     OR pg_catalog.length(coalesce(_metadata->>'name','')) > 40
     OR pg_catalog.length(coalesce(_metadata->>'origin','')) > 2000
     OR coalesce(_metadata->>'selectedImage','') NOT IN ('original','prepared','cleaned')
     OR (_metadata->>'selectedImage' = 'prepared' AND _metadata->>'preparedPath' IS NULL)
     OR (_metadata->>'selectedImage' = 'cleaned' AND _metadata->>'cleanedPath' IS NULL)
  THEN RAISE EXCEPTION 'INVALID_DRAFT'; END IF;

  FOREACH field_name IN ARRAY ARRAY['originalPath','preparedPath','cleanedPath'] LOOP
    asset_path := nullif(_metadata->>field_name, '');
    IF asset_path IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.dragon_assets a
      WHERE a.path = asset_path AND a.owner_id = uid AND a.draft_id = _draft_id
    ) THEN RAISE EXCEPTION 'INVALID_ASSET'; END IF;
  END LOOP;

  INSERT INTO public.dragon_drafts (draft_id, owner_id, revision, metadata)
  SELECT _draft_id, uid, 1, _metadata WHERE _expected_revision = 0
  ON CONFLICT (draft_id) DO UPDATE SET
    metadata = EXCLUDED.metadata,
    revision = public.dragon_drafts.revision + 1,
    updated_at = now()
  WHERE public.dragon_drafts.owner_id = uid
    AND public.dragon_drafts.status = 'active'
    AND public.dragon_drafts.revision = _expected_revision
  RETURNING revision INTO next_revision;

  IF next_revision IS NULL THEN
    -- Existing rows also need a path when expected_revision is nonzero.
    UPDATE public.dragon_drafts SET metadata = _metadata,
      revision = revision + 1, updated_at = now()
    WHERE draft_id = _draft_id AND owner_id = uid AND status = 'active'
      AND revision = _expected_revision
    RETURNING revision INTO next_revision;
  END IF;
  IF next_revision IS NULL THEN RAISE EXCEPTION 'DRAFT_CONFLICT'; END IF;
  RETURN next_revision;
END;
$$;

-- Register only objects already uploaded into the caller's private prefix.
CREATE FUNCTION public.register_dragon_asset(
  _draft_id uuid, _path text, _kind text, _mime_type text, _byte_size integer
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := (SELECT auth.uid());
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF coalesce(_kind,'') NOT IN ('original','prepared','cleaned')
     OR coalesce(_mime_type,'') NOT IN ('image/png','image/jpeg','image/webp')
     OR _byte_size NOT BETWEEN 1 AND 8388608
     OR _path !~ ('^' || uid::text || '/' || _draft_id::text || '/' || _kind || '/[0-9a-f]{64}[.](png|jpg|webp)$')
     OR NOT EXISTS (SELECT 1 FROM public.dragon_drafts d
       WHERE d.draft_id = _draft_id AND d.owner_id = uid AND d.status = 'active')
     OR NOT EXISTS (SELECT 1 FROM storage.objects o
       WHERE o.bucket_id = 'dragon-originals' AND o.name = _path)
  THEN RAISE EXCEPTION 'INVALID_ASSET'; END IF;
  INSERT INTO public.dragon_assets(path, owner_id, draft_id, kind, mime_type, byte_size)
  VALUES (_path, uid, _draft_id, _kind, _mime_type, _byte_size)
  ON CONFLICT (path) DO NOTHING;
END;
$$;

CREATE FUNCTION public.abandon_dragon_draft(_draft_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.dragon_drafts SET status = 'abandoned', updated_at = now()
  WHERE draft_id = _draft_id AND owner_id = (SELECT auth.uid()) AND status = 'active'
    AND dragon_id IS NULL AND metadata->>'creationAttemptedAt' IS NULL;
  IF NOT FOUND AND NOT EXISTS (
    SELECT 1 FROM public.dragon_drafts WHERE draft_id = _draft_id
      AND owner_id = (SELECT auth.uid()) AND status = 'abandoned' AND dragon_id IS NULL
  ) THEN RAISE EXCEPTION 'DRAFT_NOT_DISCARDABLE'; END IF;
END;
$$;

CREATE FUNCTION public.purge_abandoned_dragon_draft(_draft_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := (SELECT auth.uid());
BEGIN
  IF uid IS NULL OR EXISTS (
    SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'dragon-originals'
      AND o.name LIKE uid::text || '/' || _draft_id::text || '/%'
  ) THEN RAISE EXCEPTION 'ASSET_CLEANUP_INCOMPLETE'; END IF;
  DELETE FROM public.dragon_drafts WHERE draft_id = _draft_id AND owner_id = uid
    AND status = 'abandoned' AND dragon_id IS NULL;
END;
$$;

-- The draft row is locked before creating a dragon. Repeating the same draft ID
-- returns its first dragon UUID, even when the original network response was lost.
CREATE FUNCTION public.create_personal_dragon_v2(
  _draft_id uuid, _card_path text, _image_url text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := (SELECT auth.uid());
  saved public.dragon_drafts%ROWTYPE;
  created_id uuid;
  m jsonb;
  element_name text;
  hp integer; mana integer; attack integer; defense integer;
  selected_path text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO saved FROM public.dragon_drafts
  WHERE draft_id = _draft_id AND owner_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DRAFT_NOT_FOUND'; END IF;
  IF saved.dragon_id IS NOT NULL THEN RETURN saved.dragon_id; END IF;
  IF saved.status <> 'active' THEN RAISE EXCEPTION 'DRAFT_NOT_ACTIVE'; END IF;
  m := saved.metadata;
  IF m->>'creationBackend' IS DISTINCT FROM 'cloud' OR m->>'creationAttemptedAt' IS NULL
     OR pg_catalog.length(pg_catalog.btrim(coalesce(m->>'name',''))) NOT BETWEEN 1 AND 24
  THEN RAISE EXCEPTION 'INVALID_CREATION_DRAFT'; END IF;
  IF _card_path IS DISTINCT FROM (uid::text || '/personal-' || _draft_id::text || '.jpg')
     OR coalesce(_image_url,'') NOT LIKE 'https://%/storage/v1/object/public/dragon-images/' || _card_path
     OR NOT EXISTS (SELECT 1 FROM storage.objects o
       WHERE o.bucket_id = 'dragon-images' AND o.name = _card_path)
  THEN RAISE EXCEPTION 'INVALID_CARD'; END IF;
  element_name := m->>'element';
  IF coalesce(element_name,'') NOT IN ('Wood','Water','Fire','Earth','Light','Dark') THEN
    RAISE EXCEPTION 'INVALID_ELEMENT'; END IF;
  hp := CASE element_name WHEN 'Earth' THEN 1750 WHEN 'Water' THEN 1450
    WHEN 'Fire' THEN 1400 WHEN 'Wood' THEN 1550 WHEN 'Light' THEN 1450 ELSE 1350 END;
  mana := CASE element_name WHEN 'Earth' THEN 900 WHEN 'Water' THEN 1450
    WHEN 'Fire' THEN 1050 WHEN 'Wood' THEN 1250 WHEN 'Light' THEN 1550 ELSE 1400 END;
  attack := CASE element_name WHEN 'Earth' THEN 1200 WHEN 'Water' THEN 1250
    WHEN 'Fire' THEN 1650 WHEN 'Wood' THEN 1300 WHEN 'Light' THEN 1350 ELSE 1550 END;
  defense := CASE element_name WHEN 'Earth' THEN 1550 WHEN 'Water' THEN 1200
    WHEN 'Fire' THEN 1050 WHEN 'Wood' THEN 1300 WHEN 'Light' THEN 1100 ELSE 1000 END;
  selected_path := m->>(m->>'selectedImage' || 'Path');
  IF selected_path IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.dragon_assets a WHERE a.path = selected_path
      AND a.owner_id = uid AND a.draft_id = _draft_id
  ) THEN RAISE EXCEPTION 'INVALID_SELECTED_ASSET'; END IF;

  INSERT INTO public.dragons(name, element, max_hp, mp, atk, def, image_url, lore, is_seed, created_by)
  VALUES (pg_catalog.btrim(m->>'name'), element_name, hp, mana, attack, defense,
    _image_url, pg_catalog.left(coalesce(m->>'origin',''), 500), false, uid)
  RETURNING id INTO created_id;
  INSERT INTO public.owned_dragons(user_id, dragon_id) VALUES (uid, created_id);
  INSERT INTO public.personal_dragon_profiles
    (dragon_id, owner_id, draft_id, personality, growth_goal, first_meeting,
     appearance_id, distinctive_features, selected_asset_path)
  VALUES (created_id, uid, _draft_id, coalesce(m->>'personality',''),
    coalesce(m->>'goal',''), coalesce(m->>'origin',''),
    coalesce(m->>'appearanceId','pearl'), coalesce(m->>'distinctiveFeatures',''), selected_path);
  UPDATE public.dragon_assets SET dragon_id = created_id
    WHERE draft_id = _draft_id AND owner_id = uid;
  UPDATE public.dragon_drafts SET dragon_id = created_id, status = 'completed', updated_at = now()
    WHERE draft_id = _draft_id;
  RETURN created_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_dragon_draft(uuid, integer, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_dragon_asset(uuid, text, text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.abandon_dragon_draft(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_abandoned_dragon_draft(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_personal_dragon_v2(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_dragon_draft(uuid, integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_dragon_asset(uuid, text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.abandon_dragon_draft(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_abandoned_dragon_draft(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_personal_dragon_v2(uuid, text, text) TO authenticated;
