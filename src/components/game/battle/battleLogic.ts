import type { Dragon, Element } from "@/store/dragons";

// 5행 원소: Wood, Soil(=Earth), Water, Fire, Metal
// store의 Light/Dark는 5행으로 정규화: Light→Metal, Dark→Soil
export type BattleElement = "Wood" | "Soil" | "Water" | "Fire" | "Metal";

export function toBattleElement(e: Element | string): BattleElement {
  switch (e) {
    case "Wood": return "Wood";
    case "Water": return "Water";
    case "Fire": return "Fire";
    case "Earth": return "Soil";
    case "Light": return "Metal";
    case "Dark": return "Soil";
    default: return "Wood";
  }
}

export interface Combatant {
  base: Dragon;
  // ===== Engine stats (decoupled from UI) =====
  engineMaxHp: number;
  engineHp: number;
  engineAtk: number; // 영구 변동 가능 (스택/격노)
  engineDef: number; // 영구 변동 가능 (스택)
  // ===== UI 표시용 상태 =====
  mp: number;
  maxMp: number;
  exhausted: boolean;
  // ===== 상성 스택 =====
  atkBuffStacks: number;   // 0..3, 스택당 ATK +5%
  defDebuffStacks: number; // 0..3, 스택당 DEF -10%
  // ===== 패시브 상태 =====
  poisoned: boolean;
  rageUsed: boolean; // Younigon 1회 격노 사용 여부
  // ===== 디버그/로깅 =====
  battleElement: BattleElement;
}

export type LogTone = "info" | "damage" | "penalty" | "system";
export interface LogEntry {
  id: number;
  text: string;
  tone: LogTone;
}

// Wood > Soil > Water > Fire > Metal > Wood
const STRONG_AGAINST: Record<BattleElement, BattleElement> = {
  Wood: "Soil",
  Soil: "Water",
  Water: "Fire",
  Fire: "Metal",
  Metal: "Wood",
};

export function isAdvantage(attacker: BattleElement, defender: BattleElement): boolean {
  return STRONG_AGAINST[attacker] === defender;
}
export function isReverseMatchup(attacker: BattleElement, defender: BattleElement): boolean {
  return STRONG_AGAINST[defender] === attacker;
}

export function makeCombatant(base: Dragon): Combatant {
  // Engine stat 변환: Engine_HP = 5000 + UI_HP*5, Engine_DEF = UI_DEF*2
  const engineMaxHp = 5000 + base.maxHp * 5;
  const engineHp = 5000 + base.hp * 5;
  return {
    base,
    engineMaxHp,
    engineHp,
    engineAtk: base.atk,
    engineDef: base.def * 2,
    mp: base.mp,
    maxMp: base.mp,
    exhausted: false,
    atkBuffStacks: 0,
    defDebuffStacks: 0,
    poisoned: false,
    rageUsed: false,
    battleElement: toBattleElement(base.element),
  };
}

/** 현재 시점 유효 ATK/DEF (스택/탈진 포함). */
export function effectiveStats(c: Combatant) {
  const exMod = c.exhausted ? 0.5 : 1;
  const atkBuff = 1 + c.atkBuffStacks * 0.05;
  const defDebuff = 1 - c.defDebuffStacks * 0.1;
  return {
    atk: Math.max(1, Math.round(c.engineAtk * atkBuff * exMod)),
    def: Math.max(0, Math.round(c.engineDef * defDebuff * exMod)),
  };
}

/** UI HP%: engineHp / engineMaxHp 비율을 그대로 노출. */
export function hpPercent(c: Combatant): number {
  return Math.max(0, Math.min(100, (c.engineHp / Math.max(1, c.engineMaxHp)) * 100));
}

export interface AttackResult {
  attacker: Combatant;
  defender: Combatant;
  logs: Omit<LogEntry, "id">[];
  /** 적이 회피했는지 (Snowy) */
  dodged?: boolean;
}

/**
 * 통합 마스터 전투 엔진의 단일 공격 처리.
 * - RawDamage = atk*atkBuff - def*defDebuff
 * - 최소 데미지 = engineAtk * 10%
 * - 하드캡 = defender.engineMaxHp * 18%
 * - 5행 상성 우위/열위 처리 (스택/반사)
 * - 패시브 분기 (Comi 피격 경감, Snowy 회피·데미지감, Caminont 독)
 */
export function performAttack(
  attackerIn: Combatant,
  defenderIn: Combatant,
  ctx: { turnNumber: number },
): AttackResult {
  let attacker: Combatant = { ...attackerIn };
  let defender: Combatant = { ...defenderIn };
  const logs: Omit<LogEntry, "id">[] = [];

  // ----- Snowy: 짝수 턴 회피율 30% 부여 (방어자가 Snowy일 때) -----
  if (defender.base.name === "Snowy" && ctx.turnNumber % 2 === 0) {
    if (Math.random() < 0.3) {
      logs.push({ text: `[회피] ${defender.base.name}이(가) 공격을 회피했습니다!`, tone: "system" });
      return { attacker, defender, logs, dodged: true };
    }
  }

  const aStats = effectiveStats(attacker);
  const dStats = effectiveStats(defender);

  // RawDamage
  let raw = aStats.atk - dStats.def;
  // 최소 데미지 보장: engineAtk의 10%
  const minDmg = Math.max(1, Math.round(attacker.engineAtk * 0.1));
  if (raw < minDmg) raw = minDmg;

  // Snowy: 짝수 턴 자신이 가하는 데미지 20% 감소
  if (attacker.base.name === "Snowy" && ctx.turnNumber % 2 === 0) {
    raw = Math.round(raw * 0.8);
    logs.push({ text: `[빙결의 신중함] Snowy의 공격이 20% 약화되었습니다`, tone: "system" });
  }

  // Hard cap: defender.engineMaxHp * 22% (체감 데미지 상향, 5턴 보장 유지)
  const cap = Math.floor(defender.engineMaxHp * 0.22);
  let dmg = Math.min(raw, cap);

  logs.push({
    text: `${attacker.base.name}의 공격! (raw ${raw}, cap ${cap} → ${dmg})`,
    tone: "info",
  });

  // ----- 상성 처리 -----
  const adv = isAdvantage(attacker.battleElement, defender.battleElement);
  const rev = isReverseMatchup(attacker.battleElement, defender.battleElement);
  let reflect = 0;

  if (rev) {
    const halved = Math.floor(dmg / 2);
    reflect = dmg - halved;
    dmg = halved;
    logs.push({
      text: `[상성 반사] 데미지 50% 삭감, 공격자에게 ${reflect} 반사`,
      tone: "penalty",
    });
    if (attacker.defDebuffStacks < 3) {
      attacker = { ...attacker, defDebuffStacks: attacker.defDebuffStacks + 1 };
      logs.push({
        text: `[원소 공포] ${attacker.base.name}의 방어력이 하락했습니다! (스택 ${attacker.defDebuffStacks}/3)`,
        tone: "penalty",
      });
      attacker.engineDef = Math.max(0, Math.round(attacker.base.def * 2 * (1 - attacker.defDebuffStacks * 0.1)));
    }
  } else if (adv) {
    if (attacker.atkBuffStacks < 3) {
      attacker = { ...attacker, atkBuffStacks: attacker.atkBuffStacks + 1 };
      logs.push({
        text: `[원소 각성] ${attacker.base.name}의 공격력이 상승했습니다! (스택 ${attacker.atkBuffStacks}/3)`,
        tone: "info",
      });
      // 영구 ATK 상승 (격노 적용된 base 유지 위해 engineAtk에 5% 가산)
      attacker.engineAtk = Math.round(attacker.engineAtk * 1.05);
    }
  }

  // ----- Comi (금) 피격 경감: 현재 MP 500 이상이면 -10% -----
  if (defender.base.name === "Comi" && defender.mp >= 500) {
    const before = dmg;
    dmg = Math.round(dmg * 0.9);
    logs.push({
      text: `[금속 보호막] Comi가 피해를 10% 경감 (${before}→${dmg})`,
      tone: "system",
    });
  }

  defender.engineHp = Math.max(0, defender.engineHp - dmg);
  logs.push({
    text: `${defender.base.name} -${dmg} HP (${defender.engineHp}/${defender.engineMaxHp})`,
    tone: "damage",
  });

  if (reflect > 0) {
    attacker.engineHp = Math.max(0, attacker.engineHp - reflect);
  }

  // ----- Caminont 독 부여 (50%) -----
  if (attacker.base.name === "Caminont" && !defender.poisoned) {
    if (Math.random() < 0.5) {
      defender = { ...defender, poisoned: true };
      logs.push({ text: `[중독] ${defender.base.name}이(가) 독에 걸렸습니다`, tone: "penalty" });
    }
  }

  return { attacker, defender, logs };
}

/**
 * 턴 시작 시 발동: Bella 자가회복.
 */
export function onTurnStart(c: Combatant): { next: Combatant; logs: Omit<LogEntry, "id">[] } {
  const logs: Omit<LogEntry, "id">[] = [];
  let next = { ...c };
  if (next.base.name === "Bella" && next.engineHp > 0 && next.engineHp < next.engineMaxHp * 0.5) {
    const heal = Math.round(next.engineMaxHp * 0.05);
    next.engineHp = Math.min(next.engineMaxHp, next.engineHp + heal);
    logs.push({ text: `[가호의 물결] Bella가 ${heal} HP 회복`, tone: "system" });
  }
  return { next, logs };
}

/**
 * 턴 종료 시: MP -10, 탈진 체크, 독 데미지(하드캡 무시),
 * Elia 3턴 주기 MP 흡수, Younigon 격노 트리거.
 */
export function endTurnDrain(
  selfIn: Combatant,
  opponentIn: Combatant,
  ctx: { turnNumber: number },
): { self: Combatant; opponent: Combatant; logs: Omit<LogEntry, "id">[] } {
  const logs: Omit<LogEntry, "id">[] = [];
  let self: Combatant = { ...selfIn, mp: selfIn.mp - 10 };
  let opponent: Combatant = { ...opponentIn };

  logs.push({ text: `${self.base.name}의 MP -10 (${Math.max(0, self.mp)})`, tone: "system" });
  if (self.mp <= 0 && !self.exhausted) {
    self.exhausted = true;
    logs.push({
      text: `[탈진] ${self.base.name}의 MP 고갈 — ATK/DEF 50% 감소`,
      tone: "penalty",
    });
  }

  // 독 데미지 (자기 턴 종료 시 자신이 독 상태면 적용, 하드캡 무시)
  if (self.poisoned && self.engineHp > 0) {
    const poisonDmg = Math.round(self.engineMaxHp * 0.03);
    self.engineHp = Math.max(0, self.engineHp - poisonDmg);
    logs.push({ text: `[독] ${self.base.name}이(가) ${poisonDmg} 피해 (하드캡 무시)`, tone: "penalty" });
  }

  // Elia: 매 3턴째 턴 종료 시 적 MP 15% 흡수
  if (self.base.name === "Elia" && ctx.turnNumber % 3 === 0 && opponent.engineHp > 0) {
    const drained = Math.round(opponent.mp * 0.15);
    if (drained > 0) {
      opponent = { ...opponent, mp: Math.max(0, opponent.mp - drained) };
      self.mp = Math.min(self.maxMp, self.mp + drained);
      logs.push({
        text: `[수류 흡수] Elia가 ${opponent.base.name}의 MP ${drained}을 흡수`,
        tone: "system",
      });
    }
  }

  // Younigon: 격노 트리거 (HP가 30% 이하 최초 진입)
  if (self.base.name === "Younigon" && !self.rageUsed && self.engineHp > 0 && self.engineHp <= self.engineMaxHp * 0.3) {
    self.rageUsed = true;
    self.engineAtk = Math.round(self.engineAtk * 1.5);
    logs.push({ text: `[화염 격노] Younigon의 공격력이 1.5배로 증폭!`, tone: "penalty" });
  }

  return { self, opponent, logs };
}