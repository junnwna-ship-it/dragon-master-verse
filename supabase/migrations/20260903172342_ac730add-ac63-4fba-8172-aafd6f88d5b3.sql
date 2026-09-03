INSERT INTO public.quizzes (id, question, choices, answer_index, category) VALUES
('11111111-1111-4111-8111-000000000001','Which element is strongest against a Fire dragon?','["Fire","Water","Earth","Wind"]'::jsonb,1,'story'),
('11111111-1111-4111-8111-000000000002','What does a dragon hatchling break out of when it is born?','["A cocoon","An egg","A stone","A flower"]'::jsonb,1,'story'),
('11111111-1111-4111-8111-000000000003','Vulcan, the dragon of the castle, is a master of which element?','["Fire","Ice","Wind","Light"]'::jsonb,0,'story'),
('11111111-1111-4111-8111-000000000004','Earth magic is best used to do what in a collapsing tunnel?','["Summon rain","Shape and hold the stone","Freeze the air","Call the wind"]'::jsonb,1,'story'),
('11111111-1111-4111-8111-000000000005','What is the bond between a dragon and its master called in this world?','["A contract of light","A blood oath","A cage","A trade"]'::jsonb,0,'story'),
('11111111-1111-4111-8111-000000000006','A glowing worm in the dark tunnel is most likely warning you of what?','["Treasure ahead","Danger ahead","Rain outside","Nothing"]'::jsonb,1,'story')
ON CONFLICT (id) DO NOTHING;

UPDATE public.story_nodes
SET options = '[
  {"label":"Hide immediately","next_node":"Node_12","state_changes":{"Courage":-5}},
  {"label":"Face Vulcan and answer his riddles","next_node":"Node_12","state_changes":{"Courage":10},"quiz_ids":["11111111-1111-4111-8111-000000000003","11111111-1111-4111-8111-000000000001"],"quiz_required":true,"quiz_fail_node":"Node_12"}
]'::jsonb,
updated_at = now()
WHERE chapter_id = 'dragon_master' AND node_key = 'Node_2';

UPDATE public.story_nodes
SET options = '[
  {"label":"Drag the worm along anyway","next_node":"Node_19","state_changes":{"Courage":5,"Worm_Affinity":-10}},
  {"label":"Listen to the worm and read its warning","next_node":"Node_19","state_changes":{"Worm_Affinity":15},"quiz_ids":["11111111-1111-4111-8111-000000000006","11111111-1111-4111-8111-000000000004"],"quiz_required":true,"quiz_fail_node":"Node_19"}
]'::jsonb,
updated_at = now()
WHERE chapter_id = 'dragon_master' AND node_key = 'Node_12';