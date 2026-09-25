-- Make the game player the protagonist while keeping the original young
-- Dragon Masters as companions. Also correct two recurring character-name
-- spellings in the currently published chapter data.

UPDATE public.story_nodes
SET
  body_text = replace(replace(body_text, 'Lori', 'Rori'), 'Kephri', 'Kepri'),
  description = replace(replace(description, 'Lori', 'Rori'), 'Kephri', 'Kepri'),
  speaker = CASE
    WHEN speaker = 'Lori' THEN 'Rori'
    ELSE speaker
  END,
  options = replace(replace(options::text, 'Lori', 'Rori'), 'Kephri', 'Kepri')::jsonb
WHERE chapter_id = 'dragon_master';

UPDATE public.story_nodes
SET body_text = replace(body_text, 'talks as if Vulcan belongs to him', 'talks as if Vulcan belongs to her')
WHERE chapter_id = 'dragon_master';

-- Restore the first book's core order of events: the player is taken from the
-- onion farm first, and only meets Worm after reaching the castle.
UPDATE public.story_nodes
SET
  title = 'The Dragon Stone Chooses You',
  description = 'A soldier takes you from your family''s onion farm to King Roland''s castle after the Dragon Stone chooses you.',
  body_text = 'You are working in your family''s onion field when hooves stop at the edge of the rows.' || chr(10) || chr(10) ||
    'A soldier of King Roland dismounts, reads your name from a scroll, and announces that the Dragon Stone has chosen you. You must leave for the castle to train as a Dragon Master.'
WHERE chapter_id = 'dragon_master' AND node_key = 'Node_1';

UPDATE public.story_nodes
SET body_text = 'The castle gate opens on a courtyard of scorched stone. Rori''s red dragon, Vulcan, breathes fire across the training yard while Bo, Ana, and their dragons watch.' || chr(10) || chr(10) ||
    'You have never stood this close to a dragon before. Your new companions make room for you beside them.'
WHERE chapter_id = 'dragon_master' AND node_key = 'Node_2';

UPDATE public.story_nodes
SET body_text = 'At supper Bo pushes ink and paper across the table. "Write to them. It gets easier after the first one."' || chr(10) || chr(10) ||
    'You think of your family in the onion field, then of Worm waiting in the dragon cave.'
WHERE chapter_id = 'dragon_master' AND node_key = 'Node_9';

UPDATE public.characters
SET
  name = 'Rori',
  role = 'Companion Dragon Master',
  description = 'Vulcan''s Dragon Master and the player''s bold, competitive companion.'
WHERE name = 'Lori';

UPDATE public.characters
SET
  role = 'Companion Dragon Master',
  description = 'Shu''s Dragon Master and the player''s thoughtful, dependable companion.'
WHERE name = 'Bo';

UPDATE public.characters
SET
  role = 'Companion Dragon Master',
  description = 'Kepri''s Dragon Master and the player''s curious, adventurous companion.'
WHERE name = 'Ana';

UPDATE public.characters
SET role = 'Mentor'
WHERE name = 'Griffith';

UPDATE public.characters
SET role = 'King and quest giver'
WHERE name = 'King Roland';

-- The book-one rescue does not award unrelated collectible dragons.
UPDATE public.story_nodes
SET rewards = rewards - 'dragons'
WHERE chapter_id = 'dragon_master'
  AND node_key IN ('Node_20', 'Node_20_alone');
