import type { VnNode, VnOption } from "@/store/storyEngine";

type Scene = {
  key: string;
  title: string;
  speaker: string;
  body: string;
  options: VnOption[];
};

const FIRST_MEETING: Scene[] = [
  {
    key: "arrival",
    title: "우리 이야기의 첫 장",
    speaker: "이야기",
    body: "당신은 드래곤을 처음 만난 순간을 떠올립니다. {dragon_story} 오늘은 누구의 명령도 아닌, 당신과 {dragon}, 둘이 함께 고르는 첫걸음입니다.",
    options: [{ label: "이름을 불러 본다", next_node: "meeting" }],
  },
  {
    key: "meeting",
    title: "서로를 알아가는 시간",
    speaker: "{dragon}",
    body: "드래곤 {dragon}, 고개를 들고 당신을 바라봅니다. 낯선 뜰 앞에서 잠시 걸음을 멈췄습니다. 먼저 어떤 방식으로 마음을 전할까요?",
    options: [
      { label: "손을 내밀고 기다린다", next_node: "trust" },
      { label: "함께 작은 걸음을 떼어 본다", next_node: "training" },
    ],
  },
  {
    key: "trust",
    title: "기다려 주는 용기",
    speaker: "이야기",
    body: "당신이 기다리자 {dragon} 쪽에서 한 걸음 다가옵니다. 먼저 움직일 시간을 주자 긴장이 조금 풀립니다.",
    options: [{ label: "뜰을 함께 둘러본다", next_node: "discovery" }],
  },
  {
    key: "training",
    title: "첫걸음을 나란히",
    speaker: "이야기",
    body: "당신은 먼저 한 걸음 내딛고 멈춥니다. {dragon} 역시 조금씩 움직입니다. 속도가 달라도 보폭을 다시 맞출 수 있습니다.",
    options: [{ label: "뜰을 함께 둘러본다", next_node: "discovery" }],
  },
  {
    key: "discovery",
    title: "작은 어려움",
    speaker: "이야기",
    body: "뜰의 낮은 돌턱 앞에서 {dragon}의 걸음이 다시 멎습니다. 당신은 재촉하지 않고 옆에 섭니다. 서로의 속도를 살피며 돌턱을 돌아가자 길이 열립니다. 오늘 찾은 힘은 혼자 앞서 가는 힘이 아닙니다.",
    options: [{ label: "우리의 약속을 정한다", next_node: "promise" }],
  },
  {
    key: "promise",
    title: "함께하는 약속",
    speaker: "이야기",
    body: "당신과 {dragon}, 서로를 지켜보며 배우기로 약속합니다. 이제 첫 모험으로 향할 준비가 되었습니다.",
    options: [{ label: "첫 모험으로 떠난다", next_node: null }],
  },
];

const FIRST_GROWTH: Scene[] = [
  {
    key: "check_in",
    title: "오늘의 모습",
    speaker: "이야기",
    body: "첫 모험을 지나온 당신은 {dragon}에게 오늘 어떤 기분인지 묻습니다. 성장은 강해지는 것만이 아니라 서로를 이해하는 시간이기도 합니다.",
    options: [
      { label: "짧게 함께 연습한다", next_node: "practice" },
      { label: "힘든 순간을 먼저 돌아본다", next_node: "setback" },
    ],
  },
  {
    key: "practice",
    title: "작은 반복",
    speaker: "이야기",
    body: "드래곤 {dragon}, 작은 동작을 여러 번 시도합니다. 당신은 잘한 순간을 알아보고, 쉬어야 할 때는 함께 멈춥니다.",
    options: [{ label: "달라진 점을 찾아본다", next_node: "breakthrough" }],
  },
  {
    key: "setback",
    title: "괜찮다고 말하기",
    speaker: "이야기",
    body: "뜻대로 되지 않았던 순간도 이야기합니다. 곁에 선 당신을 보고 {dragon} 쪽에서 다시 시도할 마음을 냅니다.",
    options: [{ label: "달라진 점을 찾아본다", next_node: "breakthrough" }],
  },
  {
    key: "breakthrough",
    title: "우리만 아는 변화",
    speaker: "이야기",
    body: "어제보다 조금 더 오래 눈을 맞추고, 조금 더 편안하게 함께 움직입니다. 당신은 {dragon}의 변화를 기억하기로 합니다.",
    options: [{ label: "오늘을 함께 기록한다", next_node: "celebration" }],
  },
  {
    key: "celebration",
    title: "첫 성장의 기록",
    speaker: "이야기",
    body: "오늘의 성장은 끝이 아닌 시작입니다. 당신과 {dragon}, 다음 모험에서도 서로에게 배운 것을 가져가기로 합니다.",
    options: [{ label: "성장 이야기를 마친다", next_node: null }],
  },
];

export function personalJourneyFallback(chapterId: string): VnNode[] {
  const scenes =
    chapterId === "my_dragon" ? FIRST_MEETING : chapterId === "dragon_growth" ? FIRST_GROWTH : null;
  if (!scenes) return [];
  return scenes.map((scene, index) => ({
    id: `builtin:${chapterId}:${scene.key}`,
    chapter_id: chapterId,
    node_key: scene.key,
    title: scene.title,
    speaker: scene.speaker,
    body_text: scene.body,
    description: null,
    background_image_url: null,
    options: scene.options,
    state_changes: null,
    is_start: index === 0,
    stage_number: index + 1,
    rewards: null,
  }));
}

export function withPersonalJourneyFallback(chapterId: string, publishedNodes: VnNode[]): VnNode[] {
  return publishedNodes.length > 0 ? publishedNodes : personalJourneyFallback(chapterId);
}
