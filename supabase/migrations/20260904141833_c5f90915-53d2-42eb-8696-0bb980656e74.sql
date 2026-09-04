-- ============ New branch scenes for the dragon_master chapter ============

INSERT INTO public.story_nodes
  (chapter_id, node_key, stage_number, node_type, title, speaker, body_text, description,
   quiz_ids, options, state_changes, rewards, is_start, is_published)
VALUES
-- ---------- FORK A: the court path ----------
('dragon_master', 'Node_A1_court', 9, 'scene', 'Invited to the Great Hall', 'Ana',
 E'Ana catches your sleeve after supper. "Griffith reads the king''s letters in the great hall tonight. Apprentices who are seen there get chosen for things."\n\nWorm presses one word behind your eyes: *stay*. You leave it curled in the straw anyway, and the hall doors are warmer than the pens.',
 'Court branch, scene 1', '{}',
 '[{"label":"Speak up when the masters ask a question","next_node":"Node_A2_court","state_changes":{"Social":10,"Courage":10}},
   {"label":"Listen from the back and memorise every name","next_node":"Node_A2_court","state_changes":{"Social":5,"Independence":5}}]'::jsonb,
 '{}'::jsonb, '{"gold":40}'::jsonb, false, true),

('dragon_master', 'Node_A2_court', 9, 'scene', 'What the Court Costs', 'Griffith',
 E'Lori walks you back with his arm around your shoulders, delighted to have an ally. It feels good. It feels like belonging.\n\nGriffith stops you at the stair. "You were bright in there. And your dragon has not eaten since noon." The pens are dark when you reach them, and Worm does not lift its head.',
 'Court branch, scene 2', '{}',
 '[{"label":"Sit with Worm in the dark until it answers","next_node":"Node_10","state_changes":{"Worm_Affinity":10,"Courage":5}},
   {"label":"Promise yourself you will make it up tomorrow","next_node":"Node_10","state_changes":{"Social":10,"Worm_Affinity":-10}}]'::jsonb,
 '{}'::jsonb, '{"stat_points":1}'::jsonb, false, true),

-- ---------- FORK A: the field path ----------
('dragon_master', 'Node_A1_field', 9, 'scene', 'Out Past the Onion Rows', 'Worm',
 E'You carry Worm out past the walls to a field that smells like home. It burrows a slow circle around your feet and, for the first time, the word it gives you is not a warning but a question.\n\n*Why did you come back for me?* You do not have an answer yet. You dig with your hands until moonrise and let it feel the soil through you.',
 'Field branch, scene 1', '{}',
 '[{"label":"Tell it the truth: you were nobody too","next_node":"Node_A2_field","state_changes":{"Worm_Affinity":15}},
   {"label":"Work in silence and let it read you","next_node":"Node_A2_field","state_changes":{"Worm_Affinity":10,"Independence":10}}]'::jsonb,
 '{}'::jsonb, '{"items":{"bond_token":1}}'::jsonb, false, true),

('dragon_master', 'Node_A2_field', 9, 'scene', 'The Weight You Moved', 'Narrator',
 E'Near dawn the earth shivers. A stone the size of a cart shifts one hand''s width — not by Worm''s strength, and not by yours, but by the two of you leaning on the same thought.\n\nYou come back covered in mud and miss the hall entirely. Lori will make a joke of it for a week. You barely hear him.',
 'Field branch, scene 2', '{}',
 '[{"label":"Say nothing about the stone to anyone","next_node":"Node_10","state_changes":{"Independence":10,"Worm_Affinity":10}},
   {"label":"Tell Griffith what the two of you did","next_node":"Node_10","state_changes":{"Social":5,"Courage":10}}]'::jsonb,
 '{}'::jsonb, '{"gold":40,"stat_points":1}'::jsonb, false, true),

-- ---------- FORK B: going in alone ----------
('dragon_master', 'Node_B1_alone', 11, 'scene', 'You Go In Alone', 'Narrator',
 E'You let Lori''s group vanish up the tunnel and wait until their light is gone. Then you pick Worm up yourself.\n\nNo torches. No arguing. Only your breath, the drip of the ceiling, and a drake in your arms that has stopped telling you to turn back — because you asked, and it agreed.',
 'Alone branch, scene 1', '{}',
 '[{"label":"Follow their voices at a distance","next_node":"Node_B2_alone","state_changes":{"Independence":10,"Courage":10}},
   {"label":"Trust Worm to choose the passage","next_node":"Node_B2_alone","state_changes":{"Worm_Affinity":20}}]'::jsonb,
 '{}'::jsonb, '{}'::jsonb, false, true),

('dragon_master', 'Node_B2_alone', 11, 'scene', 'The Red Orb Answers First', 'Worm',
 E'The red orb finds you before it finds them — a slow lantern of light, and behind it something that breathes like a bellows.\n\n*Down*, Worm says, and you drop flat as heat rolls over your back. Ahead, Vulcan screams. Stone answers. The whole tunnel comes down between you and the others.',
 'Alone branch, scene 2', '{}',
 '[{"label":"Dig toward their shouting","next_node":"Node_16","state_changes":{"Courage":15,"Social":10}},
   {"label":"Find your own way through with Worm","next_node":"Node_16","state_changes":{"Independence":15,"Worm_Affinity":10}}]'::jsonb,
 '{}'::jsonb, '{"gold":60}'::jsonb, false, true),

-- ---------- FORK C: force instead of earth magic ----------
('dragon_master', 'Node_C_force', 17, 'scene', 'Break It Open', 'Lori',
 E'"Enough thinking!" Lori throws Vulcan at the rockfall. Fire, then Kephri''s light, then Shu''s water turning the dust to sludge — and you, hauling stone with raw hands until your nails split.\n\nIt works. Barely. Worm is pushed aside in the scramble, and when you finally see daylight you realise you have not spoken to it once.',
 'Force escape route', '{}',
 '[{"label":"Climb out with the others","next_node":"Node_19","state_changes":{"Courage":20,"Social":10,"Worm_Affinity":-20,"Path_Force":1}}]'::jsonb,
 '{}'::jsonb, '{"gold":80}'::jsonb, false, true),

('dragon_master', 'Node_C_setback', 17, 'scene', 'The Wrong Answer', 'Griffith',
 E'You reach for the earth and the earth does not reach back. Dust, a cracked rib of stone, and the ceiling settling a finger lower over five apprentices.\n\nGriffith''s lesson comes back to you in the dark: *earth magic is the power of the mind, and it does not answer strangers.* Breathe. Think again. Worm is still here.',
 'Quiz failure setback', '{}',
 '[{"label":"Steady your breathing and try once more","next_node":"Node_17","state_changes":{"Courage":5,"Worm_Affinity":-5}}]'::jsonb,
 '{}'::jsonb, '{}'::jsonb, false, true),

-- ---------- New ending ----------
('dragon_master', 'Node_20_two', 20, 'scene', 'The Two Masters', 'Griffith',
 E'You come out last, because you went back twice — once for Lori, once for Worm — and you refused to choose between them.\n\nGriffith looks at the drake at your heel and at the apprentices behind you. "Every master here owns a dragon," he says. "You brought a friend out of a mountain, and you brought your people out with it. That is the older kind of contract." Worm''s warmth settles behind your eyes like a hand on a shoulder.',
 'Ending: The Two Masters', '{}',
 '[{"label":"See your ending","next_node":null,"state_changes":{}}]'::jsonb,
 '{}'::jsonb, '{"gold":250,"stat_points":4,"items":{"bond_token":3}}'::jsonb, false, true);

-- ============ Rewire the existing spine into real forks ============

-- Node_9: the letter home now opens FORK A (court vs field)
UPDATE public.story_nodes SET options = '[
  {"label":"Go where the masters are and be seen","next_node":"Node_A1_court","state_changes":{"Social":10,"Path_Court":1}},
  {"label":"Take Worm out to the fields instead","next_node":"Node_A1_field","state_changes":{"Worm_Affinity":10,"Path_Field":1}}
]'::jsonb
WHERE chapter_id = 'dragon_master' AND node_key = 'Node_9';

-- Node_11: the midnight proposal now opens FORK B (with the group vs alone)
UPDATE public.story_nodes SET options = '[
  {"label":"Go with Lori and Ana as a group","next_node":"Node_12","state_changes":{"Social":15,"Courage":5,"Path_Group":1}},
  {"label":"Refuse them, then slip in alone with Worm","next_node":"Node_B1_alone","state_changes":{"Independence":15,"Worm_Affinity":5,"Path_Alone":1}}
]'::jsonb
WHERE chapter_id = 'dragon_master' AND node_key = 'Node_11';

-- Node_14: failing the red-orb quiz costs you ground instead of looping
UPDATE public.story_nodes SET options = '[
  {"label":"Read the warning and call the others back",
   "next_node":"Node_15",
   "quiz_ids":["11111111-1111-4111-8111-000000000006","11111111-1111-4111-8111-000000000003"],
   "quiz_fail_node":"Node_C_setback",
   "state_changes":{"Courage":10,"Worm_Affinity":10}}
]'::jsonb
WHERE chapter_id = 'dragon_master' AND node_key = 'Node_14';

-- Node_17: FORK C — earth magic (quiz) or brute force
UPDATE public.story_nodes SET options = '[
  {"label":"Decide what earth magic is actually for",
   "next_node":"Node_18",
   "quiz_ids":["11111111-1111-4111-8111-000000000004","11111111-1111-4111-8111-000000000001"],
   "quiz_fail_node":"Node_C_setback",
   "state_changes":{"Independence":10,"Worm_Affinity":15,"Path_Earth":1}},
  {"label":"Let the others blast the rockfall apart","next_node":"Node_C_force","state_changes":{"Courage":10}}
]'::jsonb
WHERE chapter_id = 'dragon_master' AND node_key = 'Node_17';

-- Node_19: four endings, gated by the paths you actually walked
UPDATE public.story_nodes SET options = '[
  {"label":"Ending: The Two Masters","next_node":"Node_20_two","requires":{"Path_Group":1,"Worm_Affinity":55},"state_changes":{}},
  {"label":"Ending: A True Master","next_node":"Node_20","requires":{"Worm_Affinity":60},"state_changes":{}},
  {"label":"Ending: The One Who Stands Alone","next_node":"Node_20_alone","requires":{"Independence":35},"state_changes":{}},
  {"label":"Ending: The Worm You Almost Lost","next_node":"Node_20_lost","state_changes":{}}
]'::jsonb
WHERE chapter_id = 'dragon_master' AND node_key = 'Node_19';
