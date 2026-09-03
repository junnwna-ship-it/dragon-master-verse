-- Visual-novel (foldback) story engine: additive columns on public.story_nodes.
-- All fields are plain text / jsonb so UGC authors can create branches without code changes.

ALTER TABLE public.story_nodes
  ADD COLUMN IF NOT EXISTS chapter_id text NOT NULL DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS node_key text,
  ADD COLUMN IF NOT EXISTS body_text text,
  ADD COLUMN IF NOT EXISTS options jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS state_changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_start boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS speaker text;

CREATE UNIQUE INDEX IF NOT EXISTS story_nodes_chapter_node_key_idx
  ON public.story_nodes (chapter_id, node_key)
  WHERE node_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS story_nodes_chapter_idx ON public.story_nodes (chapter_id);

-- Demo foldback chapter: 2 branch points that converge back to a shared spine.
INSERT INTO public.story_nodes
  (stage_number, node_type, title, description, chapter_id, node_key, body_text, speaker, options, state_changes, is_start, is_published)
VALUES
  (1, 'story', '알에서 깨어난 소리', '프롤로그', 'prologue', 'start',
   '동굴 깊은 곳에서 작은 울음소리가 들려온다. 알 껍질이 흔들리고, 따뜻한 빛이 새어 나온다.',
   '내레이터',
   '[{"label":"조심스럽게 다가간다","next_node":"approach","state_changes":{"Worm_Affinity":2}},{"label":"횃불을 들고 크게 외친다","next_node":"shout","state_changes":{"Courage":2}}]'::jsonb,
   '{}'::jsonb, true, true),
  (2, 'story', '작은 온기', '분기 A', 'prologue', 'approach',
   '손을 내밀자 갓 태어난 새끼 드래곤이 네 손가락을 살며시 문다. 아프지는 않다.',
   '내레이터',
   '[{"label":"이름을 지어준다","next_node":"bond","state_changes":{"Worm_Affinity":3}}]'::jsonb,
   '{}'::jsonb, false, true),
  (2, 'story', '메아리치는 용기', '분기 B', 'prologue', 'shout',
   '네 목소리가 동굴을 울린다. 새끼 드래곤은 놀라지 않고 오히려 고개를 들어 너를 바라본다.',
   '내레이터',
   '[{"label":"손을 내밀어 화해한다","next_node":"bond","state_changes":{"Worm_Affinity":1,"Courage":1}}]'::jsonb,
   '{}'::jsonb, false, true),
  (3, 'story', '계약', '폴드백 합류점', 'prologue', 'bond',
   '너와 드래곤 사이에 옅은 빛의 실이 이어진다. 오늘부터 너희는 함께 걷는다.',
   '내레이터',
   '[]'::jsonb, '{"Worm_Affinity":1}'::jsonb, false, true)
ON CONFLICT DO NOTHING;