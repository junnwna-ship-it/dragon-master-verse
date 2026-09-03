// Text templates that teach the node → choice → quiz flow used by the
// story player. Users fill in the blanks instead of inventing a format.

import {
  DRAGON_MASTER_CHAPTER,
  chapterTemplateToStudioText,
} from "@/lib/chapterTemplates";

export type StoryTemplate = {
  id: string;
  label: string;
  hint: string;
  title: string;
  summary: string;
  body: string;
};

export const SCENE_BLOCK = `[장면 Node_2]
배경: https://example.com/scene.jpg
대사: (여기에 장면 설명이나 대사를 적어주세요)
`;

export const CHOICE_BLOCK = `선택지1: 앞으로 나아간다 -> Node_3
선택지2: 뒤로 물러난다 -> Node_4
`;

export const QUIZ_BLOCK = `[퀴즈]
질문: 용의 브레스를 막는 가장 좋은 방법은?
보기1: 방패를 든다
보기2: 물속으로 뛰어든다
보기3: 그대로 달려간다
정답: 2
성공 -> Node_5
실패 -> Node_6
`;

export const STORY_TEMPLATES: StoryTemplate[] = [
  {
    id: "basic",
    label: "기본 3장면 흐름",
    hint: "장면 → 선택지 → 장면 구조의 가장 단순한 뼈대",
    title: "새 스토리: 첫 비행",
    summary: "알에서 깨어난 드래곤과 함께 첫 비행에 도전한다.",
    body: `[장면 Node_1]
배경: https://example.com/intro.jpg
대사: 알이 깨어지고, 작은 드래곤이 너를 올려다본다.
선택지1: 손을 내민다 -> Node_2
선택지2: 조용히 지켜본다 -> Node_2

[장면 Node_2]
대사: 드래곤이 날개를 펼친다. 첫 비행의 순간이다.
선택지1: 함께 뛰어오른다 -> Node_3

[장면 Node_3]
대사: 두 사람은 구름을 뚫고 하늘로 올라갔다.
엔딩: true
`,
  },
  {
    id: "quiz",
    label: "퀴즈 관문 포함",
    hint: "퀴즈를 통과해야 다음 장면으로 넘어가는 구조",
    title: "새 스토리: 지혜의 관문",
    summary: "고대 문을 열기 위해 수호자의 퀴즈를 풀어야 한다.",
    body: `[장면 Node_1]
대사: 거대한 석문 앞, 수호자가 너를 시험한다.
선택지1: 시험을 받아들인다 -> Node_2

[장면 Node_2]
대사: "정답을 맞히면 문이 열릴 것이다."
${QUIZ_BLOCK}
[장면 Node_5]
대사: 문이 열렸다. 빛이 쏟아진다.
엔딩: true

[장면 Node_6]
대사: 문은 굳게 닫혔다. 다시 준비해 오자.
선택지1: 다시 도전한다 -> Node_2
`,
  },
  {
    id: "branch",
    label: "분기 엔딩 2종",
    hint: "선택에 따라 결말이 달라지는 구조",
    title: "새 스토리: 갈라지는 길",
    summary: "두 갈래 길에서 내린 선택이 서로 다른 결말로 이어진다.",
    body: `[장면 Node_1]
대사: 길이 두 갈래로 갈라진다.
선택지1: 불길이 이는 왼쪽 길 -> Node_2
선택지2: 안개가 낀 오른쪽 길 -> Node_3

[장면 Node_2]
대사: 화염의 드래곤이 너를 맞이한다.
보상: 골드 100
엔딩: true

[장면 Node_3]
대사: 안개 속에서 물의 드래곤이 속삭인다.
보상: 골드 100
엔딩: true
`,
  },
  {
    id: "dragon_master",
    label: "드래곤 마스터 공식 챕터",
    hint: "20장면 + 퀴즈 관문 2곳으로 구성된 공식 챕터를 그대로 불러와 고쳐 씁니다",
    title: DRAGON_MASTER_CHAPTER.label,
    summary: DRAGON_MASTER_CHAPTER.description,
    body: chapterTemplateToStudioText(DRAGON_MASTER_CHAPTER),
  },
];
