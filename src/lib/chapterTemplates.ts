/**
 * Chapter blueprints: full multi-node story chapters shipped as templates.
 *
 * The admin Story Map Editor can build a blueprint into `story_nodes` (as a new
 * or existing chapter id), after which every scene, choice, stat effect and
 * quiz gate is editable in the normal editor forms. The Creator Studio reuses
 * the same blueprint to offer a text starter template.
 */

export type ChapterTemplateOption = {
  label: string;
  next_node: string | null;
  state_changes?: Record<string, number>;
  quiz_ids?: string[];
  quiz_required?: boolean;
  quiz_fail_node?: string | null;
};

export type ChapterTemplateNode = {
  node_key: string;
  stage_number: number;
  node_type: string;
  title: string;
  speaker: string | null;
  body_text: string;
  background_image_url: string | null;
  is_start: boolean;
  state_changes: Record<string, number>;
  rewards: Record<string, unknown>;
  options: ChapterTemplateOption[];
};

export type ChapterTemplate = {
  id: string;
  label: string;
  description: string;
  suggestedChapterId: string;
  nodes: ChapterTemplateNode[];
};

/** The live "Dragon Master" chapter, captured as an editable blueprint. */
export const DRAGON_MASTER_CHAPTER: ChapterTemplate = {
  id: "dragon_master",
  label: "드래곤 마스터 (20장면)",
  description:
    "왕의 부름부터 벌칸과의 마지막 시험까지 이어지는 공식 챕터. 퀴즈 관문 2곳과 스탯 분기를 포함합니다.",
  suggestedChapterId: "dragon_master",
  nodes: [
    {
      "node_key": "Node_1",
      "stage_number": 1,
      "node_type": "story",
      "title": "The Dragon Master's Call",
      "speaker": "Narrator",
      "body_text": "Dawn breaks over the onion field. As you dig, something glows in the soil — a worm, watching you. Before you can speak, a soldier of King Roland rides up and points at you: \"You. The king needs a dragon handler.\"",
      "background_image_url": null,
      "is_start": true,
      "state_changes": {},
      "rewards": {},
      "options": [
        {
          "label": "Follow the soldier without protest",
          "next_node": "Node_2",
          "state_changes": {
            "Courage": 0
          }
        },
        {
          "label": "Show your fear and resist",
          "next_node": "Node_2",
          "state_changes": {
            "Courage": 5
          }
        }
      ]
    },
    {
      "node_key": "Node_2",
      "stage_number": 2,
      "node_type": "story",
      "title": "Meeting Vulcan",
      "speaker": "Narrator",
      "body_text": "The castle gates groan open. Inside the courtyard a colossal red dragon — Vulcan — rears up and unleashes a torrent of flame. Stone blackens. Guards scatter. The air itself burns.",
      "background_image_url": null,
      "is_start": false,
      "state_changes": {},
      "rewards": {},
      "options": [
        {
          "label": "Hide immediately",
          "next_node": "Node_3",
          "state_changes": {
            "Courage": -5
          }
        },
        {
          "label": "Face Vulcan and answer his riddles",
          "next_node": "Node_3",
          "state_changes": {
            "Courage": 10
          },
          "quiz_ids": [
            "11111111-1111-4111-8111-000000000003",
            "11111111-1111-4111-8111-000000000001"
          ],
          "quiz_required": true,
          "quiz_fail_node": "Node_3"
        }
      ]
    },
    {
      "node_key": "Node_3",
      "stage_number": 3,
      "node_type": "story",
      "title": "드래곤 스톤",
      "speaker": null,
      "body_text": "마법사 그리피스가 나타나 드래곤 마스터의 증표인 초록색 '드래곤 스톤'을 줍니다.",
      "background_image_url": null,
      "is_start": false,
      "state_changes": {},
      "rewards": {},
      "options": [
        {
          "label": "스톤을 바로 목에 건다",
          "next_node": "Node_4",
          "state_changes": {
            "Courage": 5
          }
        },
        {
          "label": "의심하며 질문을 던진다",
          "next_node": "Node_4",
          "state_changes": {
            "Independence": 5
          }
        }
      ]
    },
    {
      "node_key": "Node_4",
      "stage_number": 4,
      "node_type": "story",
      "title": "새로운 동료들",
      "speaker": null,
      "body_text": "보(슈), 아나(케프리), 로리(벌칸) 등 다른 마스터들과 드래곤을 만납니다.",
      "background_image_url": null,
      "is_start": false,
      "state_changes": {},
      "rewards": {},
      "options": [
        {
          "label": "마스터들에게 먼저 인사한다",
          "next_node": "Node_5",
          "state_changes": {
            "Social": 5
          }
        },
        {
          "label": "드래곤들을 유심히 관찰한다",
          "next_node": "Node_5",
          "state_changes": {
            "Independence": 5
          }
        }
      ]
    },
    {
      "node_key": "Node_5",
      "stage_number": 5,
      "node_type": "story",
      "title": "첫 만남",
      "speaker": null,
      "body_text": "다리가 없고 갈색 비늘을 가진 자신의 드래곤과 마주칩니다.",
      "background_image_url": null,
      "is_start": false,
      "state_changes": {},
      "rewards": {},
      "options": [
        {
          "label": "조심스럽게 다가간다",
          "next_node": "Node_6",
          "state_changes": {
            "Worm_Affinity": 5
          }
        },
        {
          "label": "멀리서 거리를 둔 채 지켜본다",
          "next_node": "Node_6",
          "state_changes": {
            "Worm_Affinity": -5
          }
        }
      ]
    },
    {
      "node_key": "Node_6",
      "stage_number": 6,
      "node_type": "story",
      "title": "이름 짓기",
      "speaker": null,
      "body_text": "외모를 보고 드래곤의 이름을 '웜(Worm)'이라고 짓습니다.",
      "background_image_url": null,
      "is_start": false,
      "state_changes": {},
      "rewards": {},
      "options": [
        {
          "label": "(필수 해금 이벤트 진행)",
          "next_node": "Node_7",
          "state_changes": {
            "Worm_Affinity": 10
          }
        }
      ]
    },
    {
      "node_key": "Node_7",
      "stage_number": 7,
      "node_type": "story",
      "title": "훈련장의 마법",
      "speaker": null,
      "body_text": "훈련장에서 벌칸, 슈, 케프리가 각자의 마법(불, 물, 무지개 빛)을 뽐냅니다.",
      "background_image_url": null,
      "is_start": false,
      "state_changes": {},
      "rewards": {},
      "options": [
        {
          "label": "웜을 격려한다",
          "next_node": "Node_8",
          "state_changes": {
            "Worm_Affinity": 5
          }
        },
        {
          "label": "다른 드래곤을 부러워한다",
          "next_node": "Node_8",
          "state_changes": {
            "Worm_Affinity": -5
          }
        }
      ]
    },
    {
      "node_key": "Node_8",
      "stage_number": 8,
      "node_type": "story",
      "title": "침묵하는 웜",
      "speaker": null,
      "body_text": "웜에게 능력을 보여달라고 하지만 아무 반응이 없어 로리에게 조롱당합니다.",
      "background_image_url": null,
      "is_start": false,
      "state_changes": {},
      "rewards": {},
      "options": [
        {
          "label": "웜을 감싸주며 화를 낸다",
          "next_node": "Node_9",
          "state_changes": {
            "Courage": 5,
            "Worm_Affinity": 10
          }
        },
        {
          "label": "좌절감을 드러낸다",
          "next_node": "Node_9",
          "state_changes": {
            "Worm_Affinity": -5
          }
        }
      ]
    },
    {
      "node_key": "Node_9",
      "stage_number": 9,
      "node_type": "story",
      "title": "고향으로 보내는 편지",
      "speaker": null,
      "body_text": "저녁 식사 시간에 고향을 그리워하며 보의 도움을 받아 편지를 씁니다.",
      "background_image_url": null,
      "is_start": false,
      "state_changes": {},
      "rewards": {},
      "options": [
        {
          "label": "안심시키기 위해 일상 이야기만 쓴다",
          "next_node": "Node_10",
          "state_changes": {
            "Social": 5
          }
        },
        {
          "label": "성의 화려함을 자랑한다",
          "next_node": "Node_10",
          "state_changes": {
            "Independence": -5
          }
        }
      ]
    },
    {
      "node_key": "Node_10",
      "stage_number": 10,
      "node_type": "story",
      "title": "롤랜드 왕의 방문",
      "speaker": null,
      "body_text": "롤랜드 왕이 방문하여 드래곤 군대를 기대하지만, 드레이크를 보고 실망합니다.",
      "background_image_url": null,
      "is_start": false,
      "state_changes": {},
      "rewards": {},
      "options": [
        {
          "label": "왕의 눈을 피한다",
          "next_node": "Node_11",
          "state_changes": {
            "Courage": -5
          }
        },
        {
          "label": "당당히 마주 보며 의지를 다진다",
          "next_node": "Node_11",
          "state_changes": {
            "Courage": 10
          }
        }
      ]
    },
    {
      "node_key": "Node_11",
      "stage_number": 11,
      "node_type": "story",
      "title": "한밤중의 제안",
      "speaker": null,
      "body_text": "한밤중에 로리와 아나가 찾아와 드래곤을 몰래 밖으로 데려가자고 제안합니다.",
      "background_image_url": null,
      "is_start": false,
      "state_changes": {},
      "rewards": {},
      "options": [
        {
          "label": "위험하다고 강력히 반대한다",
          "next_node": "Node_12",
          "state_changes": {
            "Independence": 10
          }
        },
        {
          "label": "호기심에 마지못해 동참한다",
          "next_node": "Node_12",
          "state_changes": {
            "Social": 5
          }
        }
      ]
    },
    {
      "node_key": "Node_12",
      "stage_number": 12,
      "node_type": "story",
      "title": "The Worm's Warning",
      "speaker": "Worm",
      "body_text": "Blue light pulses in the dark. The worm's voice arrives without sound, straight inside your head: \"Do not enter that tunnel. What waits there does not forgive.\"",
      "background_image_url": null,
      "is_start": false,
      "state_changes": {},
      "rewards": {},
      "options": [
        {
          "label": "Drag the worm along anyway",
          "next_node": "Node_13",
          "state_changes": {
            "Courage": 5,
            "Worm_Affinity": -10
          }
        },
        {
          "label": "Listen to the worm and read its warning",
          "next_node": "Node_13",
          "state_changes": {
            "Worm_Affinity": 15
          },
          "quiz_ids": [
            "11111111-1111-4111-8111-000000000006",
            "11111111-1111-4111-8111-000000000004"
          ],
          "quiz_required": true,
          "quiz_fail_node": "Node_13"
        }
      ]
    },
    {
      "node_key": "Node_13",
      "stage_number": 13,
      "node_type": "story",
      "title": "은밀한 진입",
      "speaker": null,
      "body_text": "그리피스와 경비병 사이먼의 눈을 피해 일행과 함께 어두운 터널로 진입합니다.",
      "background_image_url": null,
      "is_start": false,
      "state_changes": {},
      "rewards": {},
      "options": [
        {
          "label": "조심스럽게 숨어서 이동한다",
          "next_node": "Node_14",
          "state_changes": {
            "Courage": 5
          }
        }
      ]
    },
    {
      "node_key": "Node_14",
      "stage_number": 14,
      "node_type": "story",
      "title": "어둠 속의 위기",
      "speaker": null,
      "body_text": "터널 안에서 정체불명의 붉은 빛 구슬(red orb)이 다가옵니다.",
      "background_image_url": null,
      "is_start": false,
      "state_changes": {},
      "rewards": {},
      "options": [
        {
          "label": "일행을 보호하기 위해 앞장선다",
          "next_node": "Node_15",
          "state_changes": {
            "Courage": 10
          }
        },
        {
          "label": "벽 뒤로 물러선다",
          "next_node": "Node_15",
          "state_changes": {
            "Courage": -5
          }
        }
      ]
    },
    {
      "node_key": "Node_15",
      "stage_number": 15,
      "node_type": "story",
      "title": "벌칸의 패닉",
      "speaker": null,
      "body_text": "붉은 구슬에 놀란 벌칸이 패닉에 빠져 꼬리로 벽을 내리칩니다.",
      "background_image_url": null,
      "is_start": false,
      "state_changes": {},
      "rewards": {},
      "options": [
        {
          "label": "패닉에 빠진 로리를 돕는다",
          "next_node": "Node_16",
          "state_changes": {
            "Social": 5
          }
        },
        {
          "label": "다른 마스터들에게 대피를 외친다",
          "next_node": "Node_16",
          "state_changes": {
            "Courage": 5
          }
        }
      ]
    },
    {
      "node_key": "Node_16",
      "stage_number": 16,
      "node_type": "story",
      "title": "붕괴된 터널",
      "speaker": null,
      "body_text": "터널이 붕괴되어 드래곤 마스터들과 드래곤들이 어둠 속에 갇히게 됩니다.",
      "background_image_url": null,
      "is_start": false,
      "state_changes": {},
      "rewards": {},
      "options": [
        {
          "label": "(어둠 속에 갇힘)",
          "next_node": "Node_17"
        }
      ]
    },
    {
      "node_key": "Node_17",
      "stage_number": 17,
      "node_type": "story",
      "title": "탈출 시도",
      "speaker": null,
      "body_text": "벌칸의 힘이나 슈의 물로 막힌 바위를 부수려 시도하지만 실패합니다.",
      "background_image_url": null,
      "is_start": false,
      "state_changes": {},
      "rewards": {},
      "options": [
        {
          "label": "스스로 다른 길을 찾는다",
          "next_node": "Node_18",
          "state_changes": {
            "Independence": 10
          }
        },
        {
          "label": "웜에게 조용히 도움을 청한다",
          "next_node": "Node_18",
          "state_changes": {
            "Worm_Affinity": 10
          }
        }
      ]
    },
    {
      "node_key": "Node_18",
      "stage_number": 18,
      "node_type": "story",
      "title": "스톤의 공명",
      "speaker": null,
      "body_text": "드레이크의 드래곤 스톤과 웜의 눈이 초록색으로 빛나며 강하게 공명합니다.",
      "background_image_url": null,
      "is_start": false,
      "state_changes": {},
      "rewards": {},
      "options": [
        {
          "label": "웜의 눈을 바라보며 마법에 온전히 집중한다",
          "next_node": "Node_19",
          "state_changes": {
            "Courage": 10,
            "Worm_Affinity": 15
          }
        }
      ]
    },
    {
      "node_key": "Node_19",
      "stage_number": 19,
      "node_type": "story",
      "title": "Earth Magic",
      "speaker": "Narrator",
      "body_text": "The tunnel collapses. Then the worm's eyes flare, and the fallen boulders shudder, crack, and dissolve into drifting dust. Earth magic. The power of a focused mind.",
      "background_image_url": null,
      "is_start": false,
      "state_changes": {},
      "rewards": {},
      "options": [
        {
          "label": "Hug the worm with pride",
          "next_node": "Node_20",
          "state_changes": {
            "Worm_Affinity": 20
          }
        },
        {
          "label": "Sink to your knees at the sight",
          "next_node": "Node_20",
          "state_changes": {
            "Courage": -5
          }
        }
      ]
    },
    {
      "node_key": "Node_20",
      "stage_number": 20,
      "node_type": "story",
      "title": "A True Master",
      "speaker": "Narrator",
      "body_text": "Griffith's torch finds you in the dark. He studies the worm for a long moment, then nods. \"So it is true. You may be a master after all. Good — because something worse than Vulcan is stirring.\"",
      "background_image_url": null,
      "is_start": false,
      "state_changes": {},
      "rewards": {},
      "options": [
        {
          "label": "See the ending",
          "next_node": null
        }
      ]
    }
  ],
};

export const CHAPTER_TEMPLATES: ChapterTemplate[] = [DRAGON_MASTER_CHAPTER];

/** Blueprint → Creator Studio text format (scene / choice / quiz blocks). */
export function chapterTemplateToStudioText(tpl: ChapterTemplate): string {
  const out: string[] = [];
  for (const n of tpl.nodes) {
    out.push(`[장면 ${n.node_key}]`);
    if (n.background_image_url) out.push(`배경: ${n.background_image_url}`);
    if (n.speaker) out.push(`화자: ${n.speaker}`);
    out.push(`대사: ${n.body_text}`);
    n.options.forEach((o, i) => {
      const stats = Object.entries(o.state_changes ?? {})
        .map(([k, v]) => `${k} ${v >= 0 ? "+" : ""}${v}`)
        .join(", ");
      out.push(
        `선택지${i + 1}: ${o.label} -> ${o.next_node ?? "END"}${stats ? ` (${stats})` : ""}` +
          (o.quiz_ids?.length ? " [퀴즈 필요]" : ""),
      );
    });
    if (!n.options.length) out.push("엔딩: true");
    out.push("");
  }
  return out.join("\n");
}
