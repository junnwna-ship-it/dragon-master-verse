-- Create the dragon and its ownership row in one transaction.
CREATE OR REPLACE FUNCTION public.create_personal_dragon(
  _name text,
  _element text,
  _image_url text,
  _lore text,
  _max_hp integer,
  _mp integer,
  _atk integer,
  _def integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  created_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
  IF length(trim(coalesce(_name, ''))) < 1 OR length(trim(_name)) > 24 THEN
    RAISE EXCEPTION 'INVALID_NAME';
  END IF;
  IF _element NOT IN ('Wood', 'Water', 'Fire', 'Earth', 'Light', 'Dark') THEN
    RAISE EXCEPTION 'INVALID_ELEMENT';
  END IF;

  INSERT INTO public.dragons
    (name, element, max_hp, mp, atk, def, image_url, lore, is_seed, created_by)
  VALUES
    (trim(_name), _element, least(greatest(_max_hp, 1), 5000), least(greatest(_mp, 0), 5000),
     least(greatest(_atk, 1), 5000), least(greatest(_def, 1), 5000), nullif(trim(_image_url), ''),
     left(coalesce(_lore, ''), 500), false, uid)
  RETURNING id INTO created_id;

  INSERT INTO public.owned_dragons (user_id, dragon_id)
  VALUES (uid, created_id)
  ON CONFLICT (user_id, dragon_id) DO NOTHING;

  RETURN created_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_personal_dragon(text, text, text, text, integer, integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_personal_dragon(text, text, text, text, integer, integer, integer, integer) TO authenticated;

-- In book one, the player's selected dragon fills the original Worm role.
-- The client fills {dragon} with that dragon's name in narration and choices.
UPDATE public.story_nodes
SET
  title = replace(replace(title, 'The Worm', '{dragon}'), 'Worm', '{dragon}'),
  description = replace(replace(replace(description, 'the worm', '{dragon}'), 'The worm', '{dragon}'), 'Worm', '{dragon}'),
  body_text = replace(replace(replace(body_text, 'the worm', '{dragon}'), 'The worm', '{dragon}'), 'Worm', '{dragon}'),
  speaker = CASE WHEN speaker = 'Worm' THEN '{dragon}' ELSE speaker END,
  options = replace(replace(replace(options::text, 'the worm', '{dragon}'), 'The worm', '{dragon}'), 'Worm', '{dragon}')::jsonb
WHERE chapter_id = 'dragon_master';

-- Bring the player-authored origin and growth goal into the story itself.
UPDATE public.story_nodes
SET body_text = '{dragon_story}' || E'\n\n' || body_text
WHERE chapter_id IN ('my_dragon', 'dragon_growth')
  AND node_key IN ('arrival', 'check_in')
  AND position('{dragon_story}' in body_text) = 0;
