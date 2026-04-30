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

/** 정률 MP 경제 상수 */
export const MP_TURN_END_PCT = 0.05;   // 턴 종료 시 MaxMp의 5% 차감 (완화)
export const MP_PASSIVE_PCT = 0.05;    // 패시브/상성 발동 시 MaxMp의 5% 추가 차감
export const MP_SKILL_COST_PCT = 0.20; // 특수 스킬 발동 비용 MaxMp의 20%
export const MP_SKILL_THRESHOLD_PCT = 0.20; // 스킬 사용 가능 최소 MP 비율
export const MP_BENCH_RECOVER_PCT = 0.15;   // 벤치 턴 종료 시 MaxMp의 15% 회복
export const SKILL_RAW_MULT = 1.5;          // 특수 스킬 RawDamage 배수

/** 자신의 MaxMp의 N% 만큼 정수 차감하고 새 Combatant + 설명 텍스트 반환 */
function spendPctMp(c: Combatant, pct: number): { next: Combatant; spent: number } {
  const spent = Math.floor(c.maxMp * pct);
  if (spent <= 0) return { next: c, spent: 0 };
  const nextMp = c.mp - spent;
  let next: Combatant = { ...c, mp: nextMp };
  if (nextMp <= 0 && !next.exhausted) next.exhausted = true;
  return { next, spent };
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
  // Engine stat 변환: Engine_HP = UI_HP * 3, Engine_DEF = UI_DEF
  const engineMaxHp = base.maxHp * 3;
  const engineHp = base.hp * 3;
  return {
    base,
    engineMaxHp,
    engineHp,
    engineAtk: base.atk,
    engineDef: base.def,
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

/**
 * 현재 시점 유효 ATK/DEF.
 * 주의: engineAtk/engineDef는 스택 변동 시 이미 영구 누적된 상태로 저장된다.
 * 따라서 여기서는 스택 배율을 다시 곱하지 않고, 탈진(50%)만 적용한다.
 */
export function effectiveStats(c: Combatant) {
  const exMod = c.exhausted ? 0.5 : 1;
  return {
    atk: Math.max(1, Math.round(c.engineAtk * exMod)),
    def: Math.max(0, Math.round(c.engineDef * exMod)),
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
 * - 하드캡 = defender.engineMaxHp * 22%
 * - 5행 상성 우위/열위 처리 (스택/반사)
 * - 패시브 분기 (Comi 피격 경감, Snowy 회피·데미지감, Caminont 독)
 */
export function performAttack(
  attackerIn: Combatant,
  defenderIn: Combatant,
  ctx: { turnNumber: number; skill?: boolean },
): AttackResult {
  let attacker: Combatant = { ...attackerIn };
  let defender: Combatant = { ...defenderIn };
  const logs: Omit<LogEntry, "id">[] = [];

  // ----- 특수 스킬 비용 선차감 (MaxMp 20%) -----
  if (ctx.skill) {
    const { next, spent } = spendPctMp(attacker, MP_SKILL_COST_PCT);
    attacker = next;
    logs.push({
      text: `[특수 스킬] ${attacker.base.name}이(가) MP ${spent} 소모하여 스킬 발동! (MaxMp 20%)`,
      tone: "info",
    });
    if (attacker.exhausted) {
      logs.push({
        text: `[탈진] ${attacker.base.name}의 MP 고갈 — ATK/DEF 50% 감소`,
        tone: "penalty",
      });
    }
  }

  // ----- Snowy: 짝수 턴 회피율 30% 부여 (방어자가 Snowy일 때) -----
  if (defender.base.name === "Snowy" && ctx.turnNumber % 2 === 0) {
    if (Math.random() < 0.3) {
      logs.push({ text: `[회피] ${defender.base.name}이(가) 공격을 회피했습니다!`, tone: "system" });
      return { attacker, defender, logs, dodged: true };
    }
  }

  const aStats = effectiveStats(attacker);
  const dStats = effectiveStats(defender);

  // RawDamage = ATK * 1.5 - DEF
  let raw = Math.round(aStats.atk * 1.5 - dStats.def);
  // 최소 데미지 보장: engineAtk의 20%
  const minDmg = Math.max(1, Math.round(attacker.engineAtk * 0.2));
  if (raw < minDmg) raw = minDmg;

  // 특수 스킬: RawDamage 1.5배 증폭 (하드캡은 이후 적용)
  if (ctx.skill) {
    const before = raw;
    raw = Math.round(raw * SKILL_RAW_MULT);
    logs.push({ text: `[스킬 증폭] RawDamage ${before} → ${raw} (x1.5)`, tone: "info" });
  }

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
    // 패시브 발동 비용 (MaxMp 5%)
    {
      const { next, spent } = spendPctMp(attacker, MP_PASSIVE_PCT);
      attacker = next;
      if (spent > 0) {
        logs.push({
          text: `[패시브 소모] ${attacker.base.name} MP -${spent} (MaxMp 5%)`,
          tone: "system",
        });
      }
    }
    if (attacker.defDebuffStacks < 3) {
      const prevDef = attacker.engineDef;
      const newStacks = attacker.defDebuffStacks + 1;
      const newDef = Math.max(0, Math.round(attacker.base.def * (1 - newStacks * 0.1)));
      attacker = { ...attacker, defDebuffStacks: newStacks, engineDef: newDef };
      const remaining = 3 - newStacks;
      logs.push({
        text: `[원소 공포] ${attacker.base.name} DEF ${prevDef} → ${newDef} (-${prevDef - newDef}, -${newStacks * 10}%) | 스택 ${newStacks}/3 (남은 ${remaining}회)`,
        tone: "penalty",
      });
    } else {
      logs.push({
        text: `[원소 공포] ${attacker.base.name}의 방어 디버프 최대치 도달 (3/3) — 추가 적용 없음`,
        tone: "system",
      });
    }
  } else if (adv) {
    // 원소 각성 발동 비용 (MaxMp 5%)
    {
      const { next, spent } = spendPctMp(attacker, MP_PASSIVE_PCT);
      attacker = next;
      if (spent > 0) {
        logs.push({
          text: `[패시브 소모] ${attacker.base.name} MP -${spent} (MaxMp 5%)`,
          tone: "system",
        });
      }
    }
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
    // 패시브 발동 비용 (방어자, MaxMp 5%)
    const { next, spent } = spendPctMp(defender, MP_PASSIVE_PCT);
    defender = next;
    if (spent > 0) {
      logs.push({
        text: `[패시브 소모] ${defender.base.name} MP -${spent} (MaxMp 5%)`,
        tone: "system",
      });
    }
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
      // 패시브 발동 비용 (공격자, MaxMp 5%)
      const { next, spent } = spendPctMp(attacker, MP_PASSIVE_PCT);
      attacker = next;
      if (spent > 0) {
        logs.push({
          text: `[패시브 소모] ${attacker.base.name} MP -${spent} (MaxMp 5%)`,
          tone: "system",
        });
      }
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
    const { next: afterCost, spent } = spendPctMp(next, MP_PASSIVE_PCT);
    next = afterCost;
    if (spent > 0) {
      logs.push({
        text: `[패시브 소모] ${next.base.name} MP -${spent} (MaxMp 5%)`,
        tone: "system",
      });
    }
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
  // 정률 기반 턴 종료 MP 소모 (MaxMp의 5%)
  const turnDrain = Math.floor(selfIn.maxMp * MP_TURN_END_PCT);
  let self: Combatant = { ...selfIn, mp: selfIn.mp - turnDrain };
  let opponent: Combatant = { ...opponentIn };

  logs.push({
    text: `${self.base.name}의 MP -${turnDrain} (MaxMp 5%, 잔량 ${Math.max(0, self.mp)}/${self.maxMp})`,
    tone: "system",
  });

  // 방어 디버프 자연 감쇠: 턴 종료마다 1스택씩 회복 (양측 모두)
  const decay = (c: Combatant): Combatant => {
    if (c.defDebuffStacks <= 0) return c;
    const prevStacks = c.defDebuffStacks;
    const prevDef = c.engineDef;
    const newStacks = prevStacks - 1;
    const newDef = Math.max(0, Math.round(c.base.def * (1 - newStacks * 0.1)));
    logs.push({
      text: `[디버프 감쇠] ${c.base.name} DEF ${prevDef} → ${newDef} (+${newDef - prevDef}) | 스택 ${prevStacks}/3 → ${newStacks}/3`,
      tone: "system",
    });
    return { ...c, defDebuffStacks: newStacks, engineDef: newDef };
  };
  self = decay(self);
  opponent = decay(opponent);

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
      const { next: afterCost, spent } = spendPctMp(self, MP_PASSIVE_PCT);
      self = afterCost;
      if (spent > 0) {
        logs.push({
          text: `[패시브 소모] ${self.base.name} MP -${spent} (MaxMp 5%)`,
          tone: "system",
        });
      }
    }
  }

  // Younigon: 격노 트리거 (HP가 30% 이하 최초 진입)
  if (self.base.name === "Younigon" && !self.rageUsed && self.engineHp > 0 && self.engineHp <= self.engineMaxHp * 0.3) {
    self.rageUsed = true;
    self.engineAtk = Math.round(self.engineAtk * 1.5);
    logs.push({ text: `[화염 격노] Younigon의 공격력이 1.5배로 증폭!`, tone: "penalty" });
    const { next: afterCost, spent } = spendPctMp(self, MP_PASSIVE_PCT);
    self = afterCost;
    if (spent > 0) {
      logs.push({
        text: `[패시브 소모] ${self.base.name} MP -${spent} (MaxMp 5%)`,
        tone: "system",
      });
    }
  }

  return { self, opponent, logs };
}

/**
 * 벤치(대기석) 1마리 턴 종료 회복: MaxMp의 15%만큼 MP 회복.
 * 회복으로 MP가 1 이상 되면 탈진 상태도 해제한다.
 */
export function recoverBenchMp(c: Combatant): { next: Combatant; recovered: number } {
  if (c.engineHp <= 0) return { next: c, recovered: 0 };
  const amount = Math.floor(c.maxMp * MP_BENCH_RECOVER_PCT);
  if (amount <= 0) return { next: c, recovered: 0 };
  const nextMp = Math.min(c.maxMp, c.mp + amount);
  const recovered = nextMp - c.mp;
  if (recovered <= 0) return { next: c, recovered: 0 };
  return {
    next: { ...c, mp: nextMp, exhausted: nextMp > 0 ? false : c.exhausted },
    recovered,
  };
}