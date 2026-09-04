# Branching Story Arcs for the Dragon Master Chapter

## What's wrong today

The 15+ playing scenes run as a straight line: at nearly every scene both choices point to the *same* next node, so choices only nudge stats (Courage / Social / Independence / Worm_Affinity). Real branching exists only at the very last scene (three endings gated by stats). So the story reads as one fixed path — choices feel cosmetic.

## Goal

Make choices actually change *where* the story goes, while keeping the chapter finishable and safe (no dead ends, saves still resume correctly).

## The new shape

Three "hub → branch → rejoin" forks inside the existing chapter, each 2 new scenes per side, so a replay feels different but the spine stays intact:

```text
Node_1 .. Node_4          (shared setup)
        |
  FORK A: Court vs. Field
   A1a -> A2a  (trust the king's court: Social/Courage)
   A1b -> A2b  (stay with Worm and the fields: Worm_Affinity/Independence)
        \--> rejoin Node_8
        |
  FORK B: The Midnight Cave (existing Node_11..)
   B1a -> B2a  (go in with Lori's group: Social)
   B1b -> B2b  (go in alone with Worm: Independence/Worm_Affinity)
        \--> rejoin Node_16 (collapse happens either way, told differently)
        |
  FORK C: The Escape
   C1a  quiz-gated earth-magic route  (Worm_Affinity)
   C1b  brute-force / Vulcan route    (Courage, costs Worm_Affinity)
        \--> rejoin Node_19
        |
  Endings: 4 total, chosen by dominant stat + which forks you took
```

Fork memory: each branch writes a marker stat (e.g. `Path_Court`, `Path_Alone`, `Path_Earth`). Later scenes use the existing `requires` mechanism to show callback lines and to unlock a 4th ending ("The Two Masters") only for players who kept both Worm and their friends.

## Making it feel like a story, not a quiz

- Each fork scene gets its own stakes and a consequence the player sees named ("Vulcan will not forget this", "Worm keeps its distance for a while").
- Body text lengthened to 3-5 sentences with a concrete image and a line of dialogue, consistent English voice throughout.
- Quiz gates stay only at the two places they earn their keep (Red Orb, Escape) and failure now routes to a *different* scene with a small setback rather than looping back to the same node.
- Rewards spread out so progress is felt: small gold/bond tokens per fork, stat points at fork rejoins, dragon reward at the ending.
- Ending screen lists which forks the player took, so replays are visibly different.

## Technical notes

- Data only in `story_nodes` (chapter `dragon_master`): new rows for fork scenes, updated `options.next_node`, `requires`, `state_changes`, `rewards`, `quiz_fail_node`. Applied through a migration so it is reproducible.
- Reuse existing `src/lib/storyChoices.ts` gating (`requires`) — no engine rewrite. `VisualNovelPlayer` already handles gated choices, rewards, and saves.
- New scenes get background art entries in `src/data/storyArt.ts`, falling back to their fork's parent art when no dedicated image exists.
- Every new node published (`is_published = true`) so saved resumes are never blocked; existing resume tests in `src/lib/storyResume.ts` re-run plus new cases for fork nodes.
- Reachability check after the migration: walk from `Node_1` and assert every node is reachable and every `next_node` exists.

## Out of scope

No changes to PvP, shop, training, or the studio/UGC player.
