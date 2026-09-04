import type { Combatant, LogEntry } from "@/components/game/battle/battleLogic";

/**
 * Battle consumable items.
 *
 * The server (`consume_battle_item` RPC) owns quantity checks and randomness
 * for the "Dice of Chaos"; it returns a resolved effect payload. Everything in
 * this module is a pure state transition over that payload so it can be unit
 * tested without a battle rendered.
 */

export type BattleEffectType =
  | "heal_hp"
  | "heal_mp"
  | "buff_atk"
  | "buff_def"
  | "damage"
  | "debuff_atk"
  | "revive"
  | "shield";

export interface ResolvedItemEffect {
  item_key: string;
  name: string;
  effect_type: string;
  effect_value: number;
  duration_turns: number;
  log_text?: string | null;
  remaining?: number;
}

interface TimedBuff {
  kind: "buff_atk" | "buff_def" | "debuff_atk";
  /** Flat engine-stat delta already applied; reverted on expiry. */
  delta: number;
  turnsLeft: number;
}

export interface ItemBattleState {
  usesLeft: number;
  /** Number of incoming hits that get fully nullified. */
  shieldCharges: number;
  /** Revive charges; value = % of max HP restored. */
  revive: { charges: number; percent: number };
  selfBuffs: TimedBuff[];
  enemyBuffs: TimedBuff[];
}

export const MAX_ITEM_USES_PER_BATTLE = 3;

export function createItemBattleState(maxUses = MAX_ITEM_USES_PER_BATTLE): ItemBattleState {
  return {
    usesLeft: maxUses,
    shieldCharges: 0,
    revive: { charges: 0, percent: 0 },
    selfBuffs: [],
    enemyBuffs: [],
  };
}

export interface ApplyResult {
  state: ItemBattleState;
  self: Combatant;
  enemy: Combatant;
  logs: Omit<LogEntry, "id">[];
  /** False when the effect could not be applied (no uses left). */
  applied: boolean;
}

/** Engine HP is 3x the UI HP scale (see `makeCombatant`). */
const ENGINE_SCALE = 3;

export function applyItemEffect(
  stateIn: ItemBattleState,
  selfIn: Combatant,
  enemyIn: Combatant,
  effect: ResolvedItemEffect,
): ApplyResult {
  const state: ItemBattleState = {
    ...stateIn,
    revive: { ...stateIn.revive },
    selfBuffs: [...stateIn.selfBuffs],
    enemyBuffs: [...stateIn.enemyBuffs],
  };
  let self: Combatant = { ...selfIn };
  let enemy: Combatant = { ...enemyIn };
  const logs: Omit<LogEntry, "id">[] = [];

  if (state.usesLeft <= 0) {
    return { state: stateIn, self: selfIn, enemy: enemyIn, logs, applied: false };
  }

  const value = Math.max(0, Math.round(effect.effect_value));
  const turns = Math.max(0, Math.round(effect.duration_turns));
  const label = effect.name || effect.item_key;

  switch (effect.effect_type as BattleEffectType) {
    case "heal_hp": {
      const heal = Math.round((self.engineMaxHp * value) / 100);
      const before = self.engineHp;
      self.engineHp = Math.min(self.engineMaxHp, self.engineHp + heal);
      logs.push({ text: `${label}: ${self.base.name} +${self.engineHp - before} HP`, tone: "info" });
      break;
    }
    case "heal_mp": {
      const before = self.mp;
      self.mp = Math.min(self.maxMp, self.mp + value);
      self.exhausted = self.mp <= 0;
      logs.push({ text: `${label}: ${self.base.name} +${self.mp - before} MP`, tone: "info" });
      break;
    }
    case "buff_atk": {
      const delta = Math.max(1, Math.round((self.engineAtk * value) / 100));
      self.engineAtk += delta;
      state.selfBuffs.push({ kind: "buff_atk", delta, turnsLeft: Math.max(1, turns) });
      logs.push({ text: `${label}: ${self.base.name} ATK +${delta}`, tone: "info" });
      break;
    }
    case "buff_def": {
      const delta = Math.max(1, Math.round((self.engineDef * value) / 100));
      self.engineDef += delta;
      state.selfBuffs.push({ kind: "buff_def", delta, turnsLeft: Math.max(1, turns) });
      logs.push({ text: `${label}: ${self.base.name} DEF +${delta}`, tone: "info" });
      break;
    }
    case "debuff_atk": {
      const delta = Math.max(1, Math.round((enemy.engineAtk * value) / 100));
      enemy.engineAtk = Math.max(1, enemy.engineAtk - delta);
      state.enemyBuffs.push({ kind: "debuff_atk", delta, turnsLeft: Math.max(1, turns) });
      logs.push({ text: `${label}: ${enemy.base.name} ATK -${delta}`, tone: "damage" });
      break;
    }
    case "damage": {
      const dmg = value * ENGINE_SCALE;
      enemy.engineHp = Math.max(0, enemy.engineHp - dmg);
      logs.push({ text: `${label}: ${enemy.base.name} -${dmg} HP`, tone: "damage" });
      break;
    }
    case "shield": {
      state.shieldCharges += Math.max(1, value);
      logs.push({ text: `${label}: next ${state.shieldCharges} hit(s) nullified`, tone: "info" });
      break;
    }
    case "revive": {
      state.revive = { charges: state.revive.charges + 1, percent: Math.max(10, value) };
      logs.push({ text: `${label}: revives once at ${state.revive.percent}% HP`, tone: "info" });
      break;
    }
    default: {
      return { state: stateIn, self: selfIn, enemy: enemyIn, logs, applied: false };
    }
  }

  state.usesLeft -= 1;
  return { state, self, enemy, logs, applied: true };
}

/** Called at the end of each full turn: expire timed buffs and revert deltas. */
export function tickItemBuffs(
  stateIn: ItemBattleState,
  selfIn: Combatant,
  enemyIn: Combatant,
): { state: ItemBattleState; self: Combatant; enemy: Combatant; logs: Omit<LogEntry, "id">[] } {
  const self: Combatant = { ...selfIn };
  const enemy: Combatant = { ...enemyIn };
  const logs: Omit<LogEntry, "id">[] = [];

  const nextSelf: TimedBuff[] = [];
  for (const b of stateIn.selfBuffs) {
    const turnsLeft = b.turnsLeft - 1;
    if (turnsLeft > 0) {
      nextSelf.push({ ...b, turnsLeft });
      continue;
    }
    if (b.kind === "buff_atk") self.engineAtk = Math.max(1, self.engineAtk - b.delta);
    if (b.kind === "buff_def") self.engineDef = Math.max(0, self.engineDef - b.delta);
    logs.push({ text: `${self.base.name}: item effect wore off`, tone: "system" });
  }

  const nextEnemy: TimedBuff[] = [];
  for (const b of stateIn.enemyBuffs) {
    const turnsLeft = b.turnsLeft - 1;
    if (turnsLeft > 0) {
      nextEnemy.push({ ...b, turnsLeft });
      continue;
    }
    if (b.kind === "debuff_atk") enemy.engineAtk += b.delta;
    logs.push({ text: `${enemy.base.name}: item effect wore off`, tone: "system" });
  }

  return {
    state: { ...stateIn, selfBuffs: nextSelf, enemyBuffs: nextEnemy },
    self,
    enemy,
    logs,
  };
}

/** Consumes one shield charge; returns whether the incoming hit is nullified. */
export function consumeShield(stateIn: ItemBattleState): { state: ItemBattleState; blocked: boolean } {
  if (stateIn.shieldCharges <= 0) return { state: stateIn, blocked: false };
  return { state: { ...stateIn, shieldCharges: stateIn.shieldCharges - 1 }, blocked: true };
}

/** Uses a revive charge when the combatant is down. */
export function tryRevive(
  stateIn: ItemBattleState,
  selfIn: Combatant,
): { state: ItemBattleState; self: Combatant; revived: boolean } {
  if (selfIn.engineHp > 0 || stateIn.revive.charges <= 0) {
    return { state: stateIn, self: selfIn, revived: false };
  }
  const hp = Math.max(1, Math.round((selfIn.engineMaxHp * stateIn.revive.percent) / 100));
  return {
    state: { ...stateIn, revive: { ...stateIn.revive, charges: stateIn.revive.charges - 1 } },
    self: { ...selfIn, engineHp: hp, exhausted: selfIn.mp <= 0 },
    revived: true,
  };
}
