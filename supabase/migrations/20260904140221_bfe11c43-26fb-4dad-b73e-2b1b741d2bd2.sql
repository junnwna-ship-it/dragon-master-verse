-- 1) Story dragon "Worm" (earth) so the chapter can actually hand it over.
INSERT INTO public.dragons (name, element, max_hp, mp, atk, def, lore, is_seed)
SELECT 'Worm', 'Earth', 1600, 1200, 900, 1400,
       'A legless brown drake that speaks mind to mind. Its earth magic grinds stone to dust.', true
WHERE NOT EXISTS (SELECT 1 FROM public.dragons WHERE name = 'Worm');

-- 2) Allow story rewards to grant dragons (by name), idempotent per node claim.
CREATE OR REPLACE FUNCTION public.claim_story_reward(_chapter_id text, _node_key text, _dragon_uuid uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  node public.story_nodes;
  r jsonb;
  gold_delta int := 0;
  points_delta int := 0;
  items jsonb := '{}'::jsonb;
  dragon_names jsonb := '[]'::jsonb;
  granted_dragons text[] := '{}';
  dname text;
  did uuid;
  item_key text;
  item_qty int;
  new_gold int;
  owned_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO node FROM public.story_nodes
   WHERE chapter_id = _chapter_id AND node_key = _node_key AND is_published = true
   LIMIT 1;

  IF node.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'NODE_NOT_FOUND');
  END IF;

  r := COALESCE(node.rewards, '{}'::jsonb);
  gold_delta := GREATEST(COALESCE((r->>'gold')::int, 0), 0);
  points_delta := GREATEST(COALESCE((r->>'stat_points')::int, 0), 0);
  IF jsonb_typeof(r->'items') = 'object' THEN
    items := r->'items';
  END IF;
  IF jsonb_typeof(r->'dragons') = 'array' THEN
    dragon_names := r->'dragons';
  END IF;

  IF gold_delta = 0 AND points_delta = 0 AND items = '{}'::jsonb AND dragon_names = '[]'::jsonb THEN
    RETURN jsonb_build_object('ok', true, 'granted', false, 'reason', 'NO_REWARD');
  END IF;

  INSERT INTO public.story_reward_claims (user_id, chapter_id, node_key, gold_awarded, stat_points_awarded, items_awarded)
  VALUES (uid, _chapter_id, _node_key, gold_delta, points_delta, items)
  ON CONFLICT (user_id, chapter_id, node_key) DO NOTHING;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'granted', false, 'reason', 'ALREADY_CLAIMED');
  END IF;

  INSERT INTO public.profiles (user_id, gold) VALUES (uid, 0)
  ON CONFLICT (user_id) DO NOTHING;

  IF gold_delta > 0 THEN
    UPDATE public.profiles SET gold = gold + gold_delta WHERE user_id = uid
    RETURNING gold INTO new_gold;
  ELSE
    SELECT gold INTO new_gold FROM public.profiles WHERE user_id = uid;
  END IF;

  IF points_delta > 0 AND _dragon_uuid IS NOT NULL THEN
    owned_id := public.ensure_owned_dragon(uid, _dragon_uuid);
    UPDATE public.owned_dragons SET stat_points = stat_points + points_delta WHERE id = owned_id;
  END IF;

  FOR item_key, item_qty IN
    SELECT key, GREATEST(COALESCE(value::text::int, 0), 0) FROM jsonb_each(items)
  LOOP
    IF item_qty > 0 THEN
      INSERT INTO public.user_inventory (user_id, item_key, quantity)
      VALUES (uid, item_key, item_qty)
      ON CONFLICT (user_id, item_key)
      DO UPDATE SET quantity = public.user_inventory.quantity + item_qty;
    END IF;
  END LOOP;

  FOR dname IN SELECT jsonb_array_elements_text(dragon_names)
  LOOP
    SELECT id INTO did FROM public.dragons WHERE name = dname LIMIT 1;
    IF did IS NOT NULL THEN
      INSERT INTO public.owned_dragons (user_id, dragon_id)
      VALUES (uid, did)
      ON CONFLICT (user_id, dragon_id) DO NOTHING;
      granted_dragons := granted_dragons || dname;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'granted', true,
    'gold', gold_delta,
    'stat_points', points_delta,
    'items', items,
    'dragons', to_jsonb(granted_dragons),
    'total_gold', new_gold
  );
END;
$$;

-- 3) Rewrite the dragon_master chapter: sequential path, English text, quiz gates, rewards.
UPDATE public.story_nodes SET
  title = 'The Dragon Master''s Call', speaker = 'Narrator',
  body_text = 'You are knee-deep in the onion field when your hoe strikes something soft and warm. A brown worm the length of your arm coils around the blade and looks straight at you.' || chr(10) || chr(10) || 'Hooves. A soldier of King Roland dismounts, unrolls a scroll and reads your name aloud: chosen for the Dragon Master trial.',
  options = '[{"label":"Follow the soldier without protest","next_node":"Node_2","state_changes":{"Courage":0,"Social":5}},{"label":"Plant your feet and say you are needed here","next_node":"Node_2","state_changes":{"Courage":5,"Independence":5}}]'::jsonb,
  rewards = '{}'::jsonb, quiz_ids = '{}'
WHERE chapter_id = 'dragon_master' AND node_key = 'Node_1';

UPDATE public.story_nodes SET
  title = 'Meeting Vulcan', speaker = 'Narrator',
  body_text = 'The castle gate opens on a courtyard of scorched stone. Vulcan, a red dragon as tall as the wall, breathes a river of fire across the training dummies.' || chr(10) || chr(10) || 'Heat presses your face. Somewhere behind your ribs, something small and calm says: it is only fire.',
  options = '[{"label":"Step behind a pillar and watch","next_node":"Node_3","state_changes":{"Courage":-5}},{"label":"Hold your ground and keep your eyes open","next_node":"Node_3","state_changes":{"Courage":10}}]'::jsonb,
  rewards = '{}'::jsonb, quiz_ids = '{}'
WHERE chapter_id = 'dragon_master' AND node_key = 'Node_2';

UPDATE public.story_nodes SET
  title = 'The Dragon Stone', speaker = 'Griffith',
  body_text = '"Wear this and no dragon will mistake you for prey."' || chr(10) || chr(10) || 'The wizard Griffith drops a green stone into your palm. It is warm, and it pulses like a second heart.',
  options = '[{"label":"Hang it around your neck at once","next_node":"Node_4","state_changes":{"Courage":5}},{"label":"Ask what it costs you to wear it","next_node":"Node_4","state_changes":{"Independence":5}}]'::jsonb,
  rewards = '{}'::jsonb, quiz_ids = '{}'
WHERE chapter_id = 'dragon_master' AND node_key = 'Node_3';

UPDATE public.story_nodes SET
  title = 'New Companions', speaker = 'Narrator',
  body_text = 'Three other apprentices wait in the hall: quiet Bo with Shu, sharp-eyed Ana with Kephri, and Lori, who already talks as if Vulcan belongs to him.' || chr(10) || chr(10) || 'Their dragons watch you the way older students watch a new face.',
  options = '[{"label":"Greet the masters first","next_node":"Node_5","state_changes":{"Social":10}},{"label":"Study the dragons instead of the people","next_node":"Node_5","state_changes":{"Independence":5,"Worm_Affinity":5}}]'::jsonb,
  rewards = '{}'::jsonb, quiz_ids = '{}'
WHERE chapter_id = 'dragon_master' AND node_key = 'Node_4';

UPDATE public.story_nodes SET
  title = 'First Meeting', speaker = 'Narrator',
  body_text = 'They lead you to the last pen. Inside there are no wings, no claws, no fire — only a legless brown drake with dull scales, curled in the straw.' || chr(10) || chr(10) || 'Lori laughs. The drake does not move, but you feel a word press gently against your mind.',
  options = '[{"label":"Kneel and offer your open hand","next_node":"Node_6","state_changes":{"Worm_Affinity":10}},{"label":"Keep your distance and watch it","next_node":"Node_6","state_changes":{"Worm_Affinity":-5,"Independence":5}}]'::jsonb,
  rewards = '{}'::jsonb, quiz_ids = '{}'
WHERE chapter_id = 'dragon_master' AND node_key = 'Node_5';

UPDATE public.story_nodes SET
  title = 'Giving a Name', speaker = 'Griffith',
  body_text = '"A dragon without a name is a dragon without a master. Name it, and the contract of light binds you both."' || chr(10) || chr(10) || 'The brown drake lifts its head. You already know the name. But Griffith will not let you speak it until you prove you understand what you are signing.',
  options = '[{"label":"Answer Griffith and name it Worm","next_node":"Node_7","state_changes":{"Worm_Affinity":15,"Courage":5},"quiz_ids":["11111111-1111-4111-8111-000000000005","11111111-1111-4111-8111-000000000002"],"quiz_fail_node":"Node_5"}]'::jsonb,
  rewards = '{"gold":120,"stat_points":3,"items":{"bond_token":2},"dragons":["Worm"]}'::jsonb,
  quiz_ids = '{}'
WHERE chapter_id = 'dragon_master' AND node_key = 'Node_6';

UPDATE public.story_nodes SET
  title = 'Magic on the Training Field', speaker = 'Narrator',
  body_text = 'Vulcan writes fire in the air. Shu turns a bucket of water into a spinning wheel. Kephri splits the light into a rainbow bridge.' || chr(10) || chr(10) || 'Worm lies in the dust beside you and does absolutely nothing.',
  options = '[{"label":"Crouch down and encourage Worm","next_node":"Node_8","state_changes":{"Worm_Affinity":10}},{"label":"Stare at the other dragons and wish","next_node":"Node_8","state_changes":{"Worm_Affinity":-10,"Social":5}}]'::jsonb,
  rewards = '{}'::jsonb, quiz_ids = '{}'
WHERE chapter_id = 'dragon_master' AND node_key = 'Node_7';

UPDATE public.story_nodes SET
  title = 'The Silent Worm', speaker = 'Lori',
  body_text = '"Show us something! Anything!" Lori claps for an audience. "A dragon that cannot even glow. They gave the onion boy an onion."' || chr(10) || chr(10) || 'Worm does not answer him. It answers you — a small, tired warmth behind your eyes.',
  options = '[{"label":"Stand in front of Worm and answer Lori","next_node":"Node_9","state_changes":{"Courage":10,"Worm_Affinity":10}},{"label":"Say nothing and let the laughter pass","next_node":"Node_9","state_changes":{"Worm_Affinity":-5,"Independence":5}}]'::jsonb,
  rewards = '{}'::jsonb, quiz_ids = '{}'
WHERE chapter_id = 'dragon_master' AND node_key = 'Node_8';

UPDATE public.story_nodes SET
  title = 'A Letter Home', speaker = 'Bo',
  body_text = 'At supper Bo pushes ink and paper across the table. "Write to them. It gets easier after the first one."' || chr(10) || chr(10) || 'You think of the onion field, and of the worm you found there.',
  options = '[{"label":"Write about small ordinary days","next_node":"Node_10","state_changes":{"Social":10}},{"label":"Write about the castle and the dragons","next_node":"Node_10","state_changes":{"Independence":-5,"Courage":5}}]'::jsonb,
  rewards = '{}'::jsonb, quiz_ids = '{}'
WHERE chapter_id = 'dragon_master' AND node_key = 'Node_9';

UPDATE public.story_nodes SET
  title = 'King Roland''s Visit', speaker = 'King Roland',
  body_text = '"An army of dragons," the king says, walking the line. "Fire. Water. Light." He stops in front of you. "And a worm."' || chr(10) || chr(10) || 'The hall waits for you to apologise for what you were given.',
  options = '[{"label":"Meet the king''s eyes and say Worm is enough","next_node":"Node_11","state_changes":{"Courage":15,"Worm_Affinity":10}},{"label":"Bow your head and stay silent","next_node":"Node_11","state_changes":{"Courage":-5,"Social":5}}]'::jsonb,
  rewards = '{"gold":100,"items":{"bond_token":1}}'::jsonb, quiz_ids = '{}'
WHERE chapter_id = 'dragon_master' AND node_key = 'Node_10';

UPDATE public.story_nodes SET
  title = 'A Midnight Proposal', speaker = 'Ana',
  body_text = 'Long after the torches are out, Lori and Ana shake you awake. "The tunnel under the east wall. We take the dragons out. Just once."' || chr(10) || chr(10) || 'Worm''s warmth in your mind goes very still.',
  options = '[{"label":"Refuse and tell them it is a mistake","next_node":"Node_12","state_changes":{"Independence":15}},{"label":"Go with them out of curiosity","next_node":"Node_12","state_changes":{"Social":10,"Courage":5}}]'::jsonb,
  rewards = '{}'::jsonb, quiz_ids = '{}'
WHERE chapter_id = 'dragon_master' AND node_key = 'Node_11';

UPDATE public.story_nodes SET
  title = 'The Worm''s Warning', speaker = 'Worm',
  body_text = 'In the mouth of the cave Worm plants itself across your path. The word it presses into you is not a sound but a certainty: *do not go into the tunnel*.' || chr(10) || chr(10) || 'Behind you, the others are already lighting a lamp.',
  options = '[{"label":"Carry Worm along despite the warning","next_node":"Node_13","state_changes":{"Courage":5,"Worm_Affinity":-15}},{"label":"Kneel, promise to be careful, and ask it to come","next_node":"Node_13","state_changes":{"Worm_Affinity":15}}]'::jsonb,
  rewards = '{}'::jsonb, quiz_ids = '{}'
WHERE chapter_id = 'dragon_master' AND node_key = 'Node_12';

UPDATE public.story_nodes SET
  title = 'Slipping Inside', speaker = 'Narrator',
  body_text = 'You pass under Simon''s watchpost with your breath held and Griffith''s window dark above you. The tunnel swallows the lamplight after ten paces.' || chr(10) || chr(10) || 'The air tastes of old iron.',
  options = '[{"label":"Move slowly, hugging the wall","next_node":"Node_14","state_changes":{"Courage":5,"Independence":5}},{"label":"Keep up with Lori at the front","next_node":"Node_14","state_changes":{"Social":5,"Courage":5}}]'::jsonb,
  rewards = '{}'::jsonb, quiz_ids = '{}'
WHERE chapter_id = 'dragon_master' AND node_key = 'Node_13';

UPDATE public.story_nodes SET
  title = 'The Red Orb', speaker = 'Narrator',
  body_text = 'A red orb drifts out of the dark ahead, slow as a lantern on water. Worm''s scales go cold against your leg.' || chr(10) || chr(10) || 'You have one moment to understand what you are looking at.',
  options = '[{"label":"Read the warning and call the others back","next_node":"Node_15","state_changes":{"Courage":10,"Worm_Affinity":10},"quiz_ids":["11111111-1111-4111-8111-000000000006","11111111-1111-4111-8111-000000000003"],"quiz_fail_node":"Node_13"}]'::jsonb,
  rewards = '{}'::jsonb, quiz_ids = '{}'
WHERE chapter_id = 'dragon_master' AND node_key = 'Node_14';

UPDATE public.story_nodes SET
  title = 'Vulcan Panics', speaker = 'Narrator',
  body_text = 'Vulcan screams. Fire hits the ceiling instead of the orb, and his tail comes around like a falling tree into the tunnel wall.' || chr(10) || chr(10) || 'Dust. Then the sound of stone deciding to move.',
  options = '[{"label":"Grab Lori and pull him clear","next_node":"Node_16","state_changes":{"Social":10,"Courage":10}},{"label":"Shout for everyone to run for the entrance","next_node":"Node_16","state_changes":{"Courage":10,"Independence":5}}]'::jsonb,
  rewards = '{}'::jsonb, quiz_ids = '{}'
WHERE chapter_id = 'dragon_master' AND node_key = 'Node_15';

UPDATE public.story_nodes SET
  title = 'The Collapsed Tunnel', speaker = 'Narrator',
  body_text = 'When the noise stops, there is no entrance. Four apprentices, four dragons, and a wall of fallen rock in absolute dark.' || chr(10) || chr(10) || 'Somebody is crying. The lamp is out.',
  options = '[{"label":"Count everyone and keep them calm","next_node":"Node_17","state_changes":{"Social":10}},{"label":"Feel along the rockfall for a gap","next_node":"Node_17","state_changes":{"Independence":10}}]'::jsonb,
  rewards = '{}'::jsonb, quiz_ids = '{}'
WHERE chapter_id = 'dragon_master' AND node_key = 'Node_16';

UPDATE public.story_nodes SET
  title = 'The Escape Attempt', speaker = 'Lori',
  body_text = 'Vulcan''s fire only fills the tunnel with smoke. Shu''s water runs away between the stones. Kephri''s light shows exactly how much rock there is.' || chr(10) || chr(10) || '"You," Lori says at last, in a completely different voice. "Ask the worm."',
  options = '[{"label":"Decide what earth magic is actually for","next_node":"Node_18","state_changes":{"Worm_Affinity":15,"Independence":10},"quiz_ids":["11111111-1111-4111-8111-000000000004","11111111-1111-4111-8111-000000000001"],"quiz_fail_node":"Node_16"}]'::jsonb,
  rewards = '{"gold":150,"stat_points":3}'::jsonb, quiz_ids = '{}'
WHERE chapter_id = 'dragon_master' AND node_key = 'Node_17';

UPDATE public.story_nodes SET
  title = 'The Stone Resonates', speaker = 'Narrator',
  body_text = 'The green stone at your throat answers Worm''s eyes, and the two lights become one. The dark stops being empty.' || chr(10) || chr(10) || 'Worm asks you, without words, to hold absolutely still and to trust it.',
  options = '[{"label":"Hold still. Give it everything you have","next_node":"Node_19","state_changes":{"Courage":10,"Worm_Affinity":20}}]'::jsonb,
  rewards = '{"items":{"bond_token":2}}'::jsonb, quiz_ids = '{}'
WHERE chapter_id = 'dragon_master' AND node_key = 'Node_18';

UPDATE public.story_nodes SET
  title = 'Earth Magic', speaker = 'Narrator',
  body_text = 'Worm does not roar. The boulders simply lose the argument — they grind, sag, and pour away as dust until cold night air reaches your face.' || chr(10) || chr(10) || 'Four apprentices walk out of the mountain because of the dragon nobody wanted.',
  options = '[{"label":"Ending: A True Master","next_node":"Node_20","state_changes":{},"requires":{"Worm_Affinity":60}},{"label":"Ending: The One Who Stands Alone","next_node":"Node_20_alone","state_changes":{},"requires":{"Independence":30}},{"label":"Ending: The Worm You Almost Lost","next_node":"Node_20_lost","state_changes":{}}]'::jsonb,
  rewards = '{}'::jsonb, quiz_ids = '{}'
WHERE chapter_id = 'dragon_master' AND node_key = 'Node_19';

UPDATE public.story_nodes SET
  title = 'A True Master', speaker = 'Griffith', stage_number = 20,
  body_text = 'Griffith is waiting at the tunnel mouth, furious — until he sees the dust and understands what ground it.' || chr(10) || chr(10) || '"Earth magic is the power of the mind, and it does not answer strangers," he says. "It answered you." Then, quieter: "Something moved in the deep tonight, and it was not your worm. Rest. We begin properly tomorrow."',
  options = '[{"label":"See your ending","next_node":null,"state_changes":{}}]'::jsonb,
  rewards = '{"gold":400,"stat_points":6,"items":{"bond_token":3},"dragons":["Spike","Puri"]}'::jsonb,
  quiz_ids = '{}'
WHERE chapter_id = 'dragon_master' AND node_key = 'Node_20';

INSERT INTO public.story_nodes
  (chapter_id, node_key, stage_number, node_type, title, speaker, body_text, options, state_changes, rewards, is_published, is_start)
SELECT 'dragon_master', 'Node_20_alone', 21, 'scene', 'The One Who Stands Alone', 'Griffith',
  'You walk out first, alone, ahead of the others, and you do not look back to see who followed.' || chr(10) || chr(10) || 'Griffith reads your face and says nothing about the rescue. "You trust your own hands. Good. One day that will save you." He looks at Worm, then at you. "And one day it will cost you the only friend you had."',
  '[{"label":"See your ending","next_node":null,"state_changes":{}}]'::jsonb,
  '{}'::jsonb,
  '{"gold":250,"stat_points":4,"items":{"bond_token":1},"dragons":["Spike"]}'::jsonb,
  true, false
WHERE NOT EXISTS (SELECT 1 FROM public.story_nodes WHERE chapter_id='dragon_master' AND node_key='Node_20_alone');

INSERT INTO public.story_nodes
  (chapter_id, node_key, stage_number, node_type, title, speaker, body_text, options, state_changes, rewards, is_published, is_start)
SELECT 'dragon_master', 'Node_20_lost', 22, 'scene', 'The Worm You Almost Lost', 'Worm',
  'Worm saves you all and then lies down in the dust, further from your hand than it has ever been.' || chr(10) || chr(10) || 'The word it presses into your mind is not anger. It is patience. *I warned you. I came anyway.* Griffith sees the distance between you and says only: "Earn it back."',
  '[{"label":"See your ending","next_node":null,"state_changes":{}}]'::jsonb,
  '{}'::jsonb,
  '{"gold":150,"stat_points":2,"items":{"bond_token":1}}'::jsonb,
  true, false
WHERE NOT EXISTS (SELECT 1 FROM public.story_nodes WHERE chapter_id='dragon_master' AND node_key='Node_20_lost');

-- 4) Seed the empty gameplay surfaces.
INSERT INTO public.store_items (name, price_usd, gold_reward, item_type, sort_order, is_published)
SELECT v.name, v.price, v.gold, v.itype, v.ord, true
FROM (VALUES
  ('Bond Token', 0, 0, 'bond_token', 1),
  ('Dragon Feed', 0, 0, 'feed', 2),
  ('Attack Whetstone', 0, 0, 'atk_stone', 3),
  ('Scale Polish', 0, 0, 'def_stone', 4),
  ('Vital Herb', 0, 0, 'hp_herb', 5),
  ('Mana Dew', 0, 0, 'mp_dew', 6),
  ('Revival Ember', 0, 0, 'revive', 7)
) AS v(name, price, gold, itype, ord)
WHERE NOT EXISTS (SELECT 1 FROM public.store_items s WHERE s.item_type = v.itype);

INSERT INTO public.training_stats (stat_name, stat_code, base_cost, stat_increase, sort_order, is_published)
SELECT v.n, v.c, v.cost, v.inc, v.ord, true
FROM (VALUES
  ('Attack', 'atk', 150, 40, 1),
  ('Defense', 'def', 150, 40, 2),
  ('Vitality', 'max_hp', 200, 60, 3),
  ('Mana', 'mp', 200, 60, 4)
) AS v(n, c, cost, inc, ord)
WHERE NOT EXISTS (SELECT 1 FROM public.training_stats t WHERE t.stat_code = v.c);

INSERT INTO public.battle_skills (name, skill_code, element, mp_cost, power, description, log_text, sort_order, is_published)
SELECT v.n, v.c, v.e, v.mp, v.p, v.d, v.l, v.ord, true
FROM (VALUES
  ('Stone Grind', 'stone_grind', 'Earth', 120, 180, 'Turns rock into dust with the power of the mind.', '{attacker} grinds the ground into dust — {damage} damage!', 1),
  ('Ember Lash', 'ember_lash', 'Fire', 100, 200, 'A whip of fire across the front line.', '{attacker} lashes out with fire — {damage} damage!', 2),
  ('Tide Coil', 'tide_coil', 'Water', 100, 170, 'Coils water around the enemy and squeezes.', '{attacker} coils a tide around the foe — {damage} damage!', 3),
  ('Prism Ray', 'prism_ray', 'Light', 130, 190, 'Splits light into a piercing beam.', '{attacker} fires a prism ray — {damage} damage!', 4),
  ('Guard Scale', 'guard_scale', 'Earth', 80, 0, 'Hardens scales, reducing incoming damage.', '{attacker} hardens its scales and braces.', 5),
  ('Mind Whisper', 'mind_whisper', 'Dark', 90, 140, 'Speaks straight into the enemy''s mind.', '{attacker} whispers into the mind — {damage} damage!', 6)
) AS v(n, c, e, mp, p, d, l, ord)
WHERE NOT EXISTS (SELECT 1 FROM public.battle_skills b WHERE b.skill_code = v.c);

INSERT INTO public.characters (name, role, description, dialogue_sample, sort_order, is_published)
SELECT v.n, v.r, v.d, v.s, v.ord, true
FROM (VALUES
  ('Griffith', 'Wizard', 'Keeper of the dragon stones and master of the trial.', 'A dragon without a name is a dragon without a master.', 1),
  ('King Roland', 'King', 'Wants an army of dragons, and counts them like coins.', 'Fire. Water. Light. And a worm.', 2),
  ('Lori', 'Rival apprentice', 'Vulcan''s master. Loud, gifted, and afraid of the dark.', 'They gave the onion boy an onion.', 3),
  ('Bo', 'Apprentice', 'Shu''s master. Quiet, and the first to hand you ink.', 'Write to them. It gets easier after the first one.', 4),
  ('Ana', 'Apprentice', 'Kephri''s master. Curious enough to open a forbidden tunnel.', 'Just once. Nobody will know.', 5)
) AS v(n, r, d, s, ord)
WHERE NOT EXISTS (SELECT 1 FROM public.characters c WHERE c.name = v.n);

INSERT INTO public.bgm_tracks (title, scene_code, credit, loop_enabled, sort_order, is_published)
SELECT v.t, v.c, v.cr, true, v.ord, true
FROM (VALUES
  ('Onion Field Morning', 'story_intro', 'placeholder — set audio_url in CMS', 1),
  ('Castle of Dragons', 'story_castle', 'placeholder — set audio_url in CMS', 2),
  ('Under the Mountain', 'story_tunnel', 'placeholder — set audio_url in CMS', 3)
) AS v(t, c, cr, ord)
WHERE NOT EXISTS (SELECT 1 FROM public.bgm_tracks b WHERE b.scene_code = v.c);
