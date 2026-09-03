-- Seed data for the "dragon_master" visual-novel chapter.
-- Data-only, additive: existing rows and chapters are untouched.
-- Re-running is safe: matching (chapter_id, node_key) rows are refreshed instead of duplicated.

WITH seed(node_key, stage_number, title, description, body_text, speaker, is_start, options) AS (
  VALUES
    ('Node_1', 1, '드래곤 마스터의 부름',
     '양파 밭에서 웜(지렁이)을 발견하고, 롤랜드 왕의 병사에게 차출됩니다.',
     '양파 밭에서 웜(지렁이)을 발견하고, 롤랜드 왕의 병사에게 차출됩니다.',
     '내레이터', true,
     '[{"label":"병사를 순순히 따라간다","next_node":"Node_2","state_changes":{"Courage":0}},{"label":"두려움을 표현하며 반항한다","next_node":"Node_2","state_changes":{"Courage":5}}]'::jsonb),
    ('Node_2', 2, '벌칸과의 조우',
     '성에 도착하여 거대한 붉은 드래곤 벌칸이 불덩이를 뿜는 것을 목격합니다.',
     '성에 도착하여 거대한 붉은 드래곤 벌칸이 불덩이를 뿜는 것을 목격합니다.',
     '내레이터', false,
     '[{"label":"즉시 몸을 숨긴다","next_node":"Node_12","state_changes":{"Courage":-5}},{"label":"놀라서 제자리에 얼어붙는다","next_node":"Node_12","state_changes":{"Courage":0}}]'::jsonb),
    ('Node_12', 12, '웜의 경고',
     '웜의 동굴에 가자, 웜이 텔레파시로 터널에 들어가지 말라고 경고합니다.',
     '웜의 동굴에 가자, 웜이 텔레파시로 터널에 들어가지 말라고 경고합니다.',
     '웜', false,
     '[{"label":"웜을 억지로 데려간다","next_node":"Node_19","state_changes":{"Worm_Affinity":-10,"Courage":5}},{"label":"웜을 두고 혼자만 간다","next_node":"Node_19","state_changes":{"Worm_Affinity":5}}]'::jsonb),
    ('Node_19', 19, '대지의 마법',
     '웜이 대지의 마법(마음의 힘)을 사용해 무너진 바위들을 먼지로 만들어버립니다.',
     '웜이 대지의 마법(마음의 힘)을 사용해 무너진 바위들을 먼지로 만들어버립니다.',
     '내레이터', false,
     '[{"label":"자랑스럽게 웜을 껴안는다","next_node":"Node_20","state_changes":{"Worm_Affinity":20}},{"label":"놀라운 마법에 주저앉는다","next_node":"Node_20","state_changes":{"Courage":-5}}]'::jsonb),
    ('Node_20', 20, '진정한 마스터',
     '그리피스에게 들키지만 웜의 능력을 인정받고, 새로운 위협을 암시합니다.',
     '그리피스에게 들키지만 웜의 능력을 인정받고, 새로운 위협을 암시합니다.',
     '내레이터', false,
     '[{"label":"엔딩 보기","next_node":null,"state_changes":{}}]'::jsonb)
)
INSERT INTO public.story_nodes
  (chapter_id, node_key, stage_number, node_type, title, description, body_text, speaker,
   is_start, options, state_changes, is_published)
SELECT 'dragon_master', s.node_key, s.stage_number, 'story', s.title, s.description, s.body_text,
       s.speaker, s.is_start, s.options, '{}'::jsonb, true
FROM seed s
WHERE NOT EXISTS (
  SELECT 1 FROM public.story_nodes n
   WHERE n.chapter_id = 'dragon_master' AND n.node_key = s.node_key
);