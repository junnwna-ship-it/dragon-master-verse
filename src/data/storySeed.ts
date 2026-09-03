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
    title: "The Dragon Master's Call",
    description: "You unearth a strange worm in the onion field, and King Roland's soldier drafts you on the spot.",
    body_text: "You unearth a strange worm in the onion field, and King Roland's soldier drafts you on the spot.",
    speaker: "Narrator",
    is_start: true,
    options: [
      { label: "Follow the soldier without protest", next_node: "Node_2", state_changes: { Courage: 0 } },
      { label: "Show your fear and resist", next_node: "Node_2", state_changes: { Courage: 5 } },
    ],
    state_changes: {},
    node_type: "story",
    is_published: true,
  },
  {
    chapter_id: DRAGON_MASTER_CHAPTER_ID,
    node_key: "Node_2",
    stage_number: 2,
    title: "Meeting Vulcan",
    description: "You arrive at the castle and witness the giant red dragon Vulcan unleash a torrent of flame.",
    body_text: "You arrive at the castle and witness the giant red dragon Vulcan unleash a torrent of flame.",
    speaker: "Narrator",
    is_start: false,
    options: [
      { label: "Hide immediately", next_node: "Node_12", state_changes: { Courage: -5 } },
      { label: "Freeze in place, stunned", next_node: "Node_12", state_changes: { Courage: 0 } },
    ],
    state_changes: {},
    node_type: "story",
    is_published: true,
  },
  {
    chapter_id: DRAGON_MASTER_CHAPTER_ID,
    node_key: "Node_12",
    stage_number: 12,
    title: "The Worm's Warning",
    description: "In the worm's cave, it warns you telepathically not to enter the tunnel.",
    body_text: "In the worm's cave, it warns you telepathically not to enter the tunnel.",
    speaker: "Worm",
    is_start: false,
    options: [
      {
        label: "Drag the worm along anyway",
        next_node: "Node_19",
        state_changes: { Worm_Affinity: -10, Courage: 5 },
      },
      { label: "Leave the worm behind and go alone", next_node: "Node_19", state_changes: { Worm_Affinity: 5 } },
    ],
    state_changes: {},
    node_type: "story",
    is_published: true,
  },
  {
    chapter_id: DRAGON_MASTER_CHAPTER_ID,
    node_key: "Node_19",
    stage_number: 19,
    title: "Earth Magic",
    description: "The worm uses earth magic — the power of mind — to grind the fallen boulders into dust.",
    body_text: "The worm uses earth magic — the power of mind — to grind the fallen boulders into dust.",
    speaker: "Narrator",
    is_start: false,
    options: [
      { label: "Hug the worm with pride", next_node: "Node_20", state_changes: { Worm_Affinity: 20 } },
      { label: "Sink to your knees at the sight", next_node: "Node_20", state_changes: { Courage: -5 } },
    ],
    state_changes: {},
    node_type: "story",
    is_published: true,
  },
  {
    chapter_id: DRAGON_MASTER_CHAPTER_ID,
    node_key: "Node_20",
    stage_number: 20,
    title: "A True Master",
    description: "Griffith catches you, but acknowledges the worm's power — and hints at a new threat.",
    body_text: "Griffith catches you, but acknowledges the worm's power — and hints at a new threat.",
    speaker: "Narrator",
    is_start: false,
    options: [{ label: "See the ending", next_node: null, state_changes: {} }],
    state_changes: {},
    node_type: "story",
    is_published: true,
  },
];
