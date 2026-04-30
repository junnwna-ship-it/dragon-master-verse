import type { Dragon, Element } from "@/store/dragons";

export type BattleElement = Element | "Metal";

export interface Combatant {
  base: Dragon;
  hp: number;
  mp: number;
  exhausted: boolean;
}

export type LogTone = "info" | "damage" | "penalty" | "system";
export interface LogEntry {
  id: number;
  text: string;
  tone: LogTone;
}

// Wood > Earth > Water > Fire > Metal > Wood
const STRONG_AGAINST: Record<string, string> = {
  Wood: "Earth",
  Earth: "Water",
  Water: "Fire",
  Fire: "Metal",
  Metal: "Wood",
};

export function isReverseMatchup(attacker: BattleElement, defender: BattleElement): boolean {
  // Reverse = defender is strong against attacker
  return STRONG_AGAINST[defender] === attacker;
}

export function makeCombatant(base: Dragon): Combatant {
  return { base, hp: base.maxHp, mp: base.mp, exhausted: false };
}

export function effectiveStats(c: Combatant) {
  const mod = c.exhausted ? 0.5 : 1;
  return {
    atk: Math.round(c.base.atk * mod),
    def: Math.round(c.base.def * mod),
  };
}

export interface AttackResult {
  attacker: Combatant;
  defender: Combatant;
  logs: Omit<LogEntry, "id">[];
}

export function performAttack(attackerIn: Combatant, defenderIn: Combatant): AttackResult {
  const attacker = { ...attackerIn };
  const defender = { ...defenderIn };
  const logs: Omit<LogEntry, "id">[] = [];

  const aStats = effectiveStats(attacker);
  const dStats = effectiveStats(defender);

  // Base damage formula
  let damage = Math.max(1, Math.round(aStats.atk - dStats.def * 0.5));

  logs.push({
    text: `${attacker.base.name}의 공격! (기본 데미지 ${damage})`,
    tone: "info",
  });

  // Reverse element penalty
  const reverse = isReverseMatchup(
    attacker.base.element as BattleElement,
    defender.base.element as BattleElement,
  );
  let reflect = 0;
  if (reverse) {
    const halved = Math.floor(damage / 2);
    reflect = damage - halved;
    damage = halved;
    logs.push({
      text: `[상성 반사] 공격이 튕겨나와 피해를 입었습니다 (-${reflect})`,
      tone: "penalty",
    });
  }

  defender.hp = Math.max(0, defender.hp - damage);
  logs.push({
    text: `${defender.base.name}이(가) ${damage} 데미지를 입었습니다`,
    tone: "damage",
  });

  // Reflect damage to attacker
  if (reflect > 0) {
    attacker.hp = Math.max(0, attacker.hp - reflect);
  }

  // Over-stat recoil
  if (attacker.base.atk >= 75) {
    const recoil = Math.round(attacker.base.maxHp * 0.2);
    attacker.hp = Math.max(0, attacker.hp - recoil);
    logs.push({
      text: `[반동] 공격력이 너무 높아 스스로 피해를 입었습니다 (-${recoil})`,
      tone: "penalty",
    });
  }

  return { attacker, defender, logs };
}

export function endTurnDrain(c: Combatant): { next: Combatant; logs: Omit<LogEntry, "id">[] } {
  const logs: Omit<LogEntry, "id">[] = [];
  const next = { ...c, mp: c.mp - 10 };
  logs.push({ text: `${c.base.name}의 MP -10 (현재 ${Math.max(0, next.mp)})`, tone: "system" });
  if (next.mp <= 0 && !next.exhausted) {
    next.exhausted = true;
    logs.push({
      text: `[탈진] ${c.base.name}의 MP가 고갈되어 ATK/DEF가 50% 감소합니다`,
      tone: "penalty",
    });
  }
  return { next, logs };
}