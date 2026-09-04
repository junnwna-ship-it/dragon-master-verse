import { describe, expect, it } from "vitest";
import {
  applyItemEffect,
  consumeShield,
  createItemBattleState,
  tickItemBuffs,
  tryRevive,
  type ResolvedItemEffect,
} from "./battleItems";
import { makeCombatant, type Combatant } from "@/components/game/battle/battleLogic";
import type { Dragon } from "@/store/dragons";

const dragon = (name: string, over: Partial<Dragon> = {}): Dragon => ({
  id: 1,
  name,
  element: "Fire",
  hp: 300,
  maxHp: 300,
  mp: 100,
  atk: 100,
  def: 40,
  ...over,
});

function pair(): [Combatant, Combatant] {
  return [makeCombatant(dragon("Ally")), makeCombatant(dragon("Foe"))];
}

const eff = (over: Partial<ResolvedItemEffect>): ResolvedItemEffect => ({
  item_key: "x",
  name: "Item",
  effect_type: "heal_hp",
  effect_value: 0,
  duration_turns: 0,
  ...over,
});

describe("battle items", () => {
  it("heals HP as a percentage of max HP", () => {
    let [self, foe] = pair();
    self = { ...self, engineHp: 100 };
    const r = applyItemEffect(createItemBattleState(), self, foe, eff({ effect_type: "heal_hp", effect_value: 40 }));
    expect(r.applied).toBe(true);
    expect(r.self.engineHp).toBe(100 + Math.round(self.engineMaxHp * 0.4));
    expect(r.state.usesLeft).toBe(2);
  });

  it("caps MP restore at max MP", () => {
    let [self, foe] = pair();
    self = { ...self, mp: 90 };
    const r = applyItemEffect(createItemBattleState(), self, foe, eff({ effect_type: "heal_mp", effect_value: 30 }));
    expect(r.self.mp).toBe(100);
  });

  it("applies then reverts a timed attack buff", () => {
    const [self, foe] = pair();
    const up = applyItemEffect(createItemBattleState(), self, foe, eff({ effect_type: "buff_atk", effect_value: 50, duration_turns: 1 }));
    expect(up.self.engineAtk).toBe(150);
    const down = tickItemBuffs(up.state, up.self, up.enemy);
    expect(down.self.engineAtk).toBe(100);
    expect(down.state.selfBuffs).toHaveLength(0);
  });

  it("keeps a 2-turn defense buff for one extra turn", () => {
    const [self, foe] = pair();
    const up = applyItemEffect(createItemBattleState(), self, foe, eff({ effect_type: "buff_def", effect_value: 50, duration_turns: 2 }));
    expect(up.self.engineDef).toBe(60);
    const t1 = tickItemBuffs(up.state, up.self, up.enemy);
    expect(t1.self.engineDef).toBe(60);
    const t2 = tickItemBuffs(t1.state, t1.self, t1.enemy);
    expect(t2.self.engineDef).toBe(40);
  });

  it("weakens the enemy and restores its attack on expiry", () => {
    const [self, foe] = pair();
    const up = applyItemEffect(createItemBattleState(), self, foe, eff({ effect_type: "debuff_atk", effect_value: 30, duration_turns: 1 }));
    expect(up.enemy.engineAtk).toBe(70);
    const t1 = tickItemBuffs(up.state, up.self, up.enemy);
    expect(t1.enemy.engineAtk).toBe(100);
  });

  it("deals fixed damage in engine scale", () => {
    const [self, foe] = pair();
    const r = applyItemEffect(createItemBattleState(), self, foe, eff({ effect_type: "damage", effect_value: 80 }));
    expect(foe.engineHp - r.enemy.engineHp).toBe(240);
  });

  it("blocks exactly one hit per shield charge", () => {
    const [self, foe] = pair();
    const r = applyItemEffect(createItemBattleState(), self, foe, eff({ effect_type: "shield", effect_value: 1 }));
    const first = consumeShield(r.state);
    expect(first.blocked).toBe(true);
    expect(consumeShield(first.state).blocked).toBe(false);
  });

  it("revives once at the configured percentage", () => {
    let [self, foe] = pair();
    const r = applyItemEffect(createItemBattleState(), self, foe, eff({ effect_type: "revive", effect_value: 30 }));
    self = { ...r.self, engineHp: 0 };
    const rev = tryRevive(r.state, self);
    expect(rev.revived).toBe(true);
    expect(rev.self.engineHp).toBe(Math.round(self.engineMaxHp * 0.3));
    const again = tryRevive(rev.state, { ...rev.self, engineHp: 0 });
    expect(again.revived).toBe(false);
  });

  it("refuses to apply when no uses are left", () => {
    const [self, foe] = pair();
    const state = { ...createItemBattleState(), usesLeft: 0 };
    const r = applyItemEffect(state, self, foe, eff({ effect_type: "heal_hp", effect_value: 40 }));
    expect(r.applied).toBe(false);
    expect(r.self.engineHp).toBe(self.engineHp);
  });
});
