/**
 * Seed data for the visual-novel story engine.
 *
 * Pure data — no UI, no branching logic. The player renders entirely from these
 * rows once they live in `story_nodes`, so UGC authors can add chapters the same
 * way (chapter_id + node_key + options JSON).
 */

export type SeedOption = {
  label: string;
  next_node: string | null;
  state_changes: Record<string, number>;
};

export type SeedNode = {
  chapter_id: string;
  node_key: string;
  stage_number: number;
  title: string;
  description: string;
  body_text: string;
  speaker: string;
  is_start: boolean;
  options: SeedOption[];
  state_changes: Record<string, number>;
  node_type: string;
  is_published: boolean;
};

export const DRAGON_MASTER_CHAPTER_ID = "dragon_master";

export const DRAGON_MASTER_SEED: SeedNode[] = [
  {
    chapter_id: DRAGON_MASTER_CHAPTER_ID,
    node_key: "Node_1",
    stage_number: 1,
    title: "드래곤 마스터의 부름",
    description: "양파 밭에서 웜(지렁이)을 발견하고, 롤랜드 왕의 병사에게 차출됩니다.",
    body_text: "양파 밭에서 웜(지렁이)을 발견하고, 롤랜드 왕의 병사에게 차출됩니다.",
    speaker: "내레이터",
    is_start: true,
    options: [
      { label: "병사를 순순히 따라간다", next_node: "Node_2", state_changes: { Courage: 0 } },
      { label: "두려움을 표현하며 반항한다", next_node: "Node_2", state_changes: { Courage: 5 } },
    ],
    state_changes: {},
    node_type: "story",
    is_published: true,
  },
  {
    chapter_id: DRAGON_MASTER_CHAPTER_ID,
    node_key: "Node_2",
    stage_number: 2,
    title: "벌칸과의 조우",
    description: "성에 도착하여 거대한 붉은 드래곤 벌칸이 불덩이를 뿜는 것을 목격합니다.",
    body_text: "성에 도착하여 거대한 붉은 드래곤 벌칸이 불덩이를 뿜는 것을 목격합니다.",
    speaker: "내레이터",
    is_start: false,
    options: [
      { label: "즉시 몸을 숨긴다", next_node: "Node_12", state_changes: { Courage: -5 } },
      { label: "놀라서 제자리에 얼어붙는다", next_node: "Node_12", state_changes: { Courage: 0 } },
    ],
    state_changes: {},
    node_type: "story",
    is_published: true,
  },
  {
    chapter_id: DRAGON_MASTER_CHAPTER_ID,
    node_key: "Node_12",
    stage_number: 12,
    title: "웜의 경고",
    description: "웜의 동굴에 가자, 웜이 텔레파시로 터널에 들어가지 말라고 경고합니다.",
    body_text: "웜의 동굴에 가자, 웜이 텔레파시로 터널에 들어가지 말라고 경고합니다.",
    speaker: "웜",
    is_start: false,
    options: [
      {
        label: "웜을 억지로 데려간다",
        next_node: "Node_19",
        state_changes: { Worm_Affinity: -10, Courage: 5 },
      },
      { label: "웜을 두고 혼자만 간다", next_node: "Node_19", state_changes: { Worm_Affinity: 5 } },
    ],
    state_changes: {},
    node_type: "story",
    is_published: true,
  },
  {
    chapter_id: DRAGON_MASTER_CHAPTER_ID,
    node_key: "Node_19",
    stage_number: 19,
    title: "대지의 마법",
    description: "웜이 대지의 마법(마음의 힘)을 사용해 무너진 바위들을 먼지로 만들어버립니다.",
    body_text: "웜이 대지의 마법(마음의 힘)을 사용해 무너진 바위들을 먼지로 만들어버립니다.",
    speaker: "내레이터",
    is_start: false,
    options: [
      { label: "자랑스럽게 웜을 껴안는다", next_node: "Node_20", state_changes: { Worm_Affinity: 20 } },
      { label: "놀라운 마법에 주저앉는다", next_node: "Node_20", state_changes: { Courage: -5 } },
    ],
    state_changes: {},
    node_type: "story",
    is_published: true,
  },
  {
    chapter_id: DRAGON_MASTER_CHAPTER_ID,
    node_key: "Node_20",
    stage_number: 20,
    title: "진정한 마스터",
    description: "그리피스에게 들키지만 웜의 능력을 인정받고, 새로운 위협을 암시합니다.",
    body_text: "그리피스에게 들키지만 웜의 능력을 인정받고, 새로운 위협을 암시합니다.",
    speaker: "내레이터",
    is_start: false,
    options: [{ label: "엔딩 보기", next_node: null, state_changes: {} }],
    state_changes: {},
    node_type: "story",
    is_published: true,
  },
];
