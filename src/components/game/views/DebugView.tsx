import { useMemo, useState } from "react";
import { Bug, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useGameStore, type Dragon } from "@/store/dragons";
import {
  makeCombatant,
  performAttack,
  endTurnDrain,
  onTurnStart,
  effectiveStats,
  hpPercent,
  type Combatant,
  type LogEntry,
} from "@/components/game/battle/battleLogic";

/** 한 턴의 스냅샷 — 표/그래프 데이터 소스 */
interface TurnRow {
  turn: number;
  actor: "A" | "B";
  actorName: string;
  rawDamage: number;
  cap: number;
  appliedDamage: number;
  aHp: number;
  aMaxHp: number;
  bHp: number;
  bMaxHp: number;
  aMp: number;
  aMaxMp: number;
  bMp: number;
  bMaxMp: number;
  logs: string[];
}

/** logs에서 "raw NN, cap NN → NN" 패턴 파싱 */
function parseDamage(logs: Omit<LogEntry, "id">[]) {
  for (const l of logs) {
    const m = /raw\s+(\d+),\s*cap\s+(\d+)\s*→\s*(\d+)/.exec(l.text);
    if (m) return { raw: +m[1], cap: +m[2], applied: +m[3] };
  }
  return { raw: 0, cap: 0, applied: 0 };
}

function runSimulation(a: Dragon, b: Dragon, maxTurns = 30, skillEvery = 0): TurnRow[] {
  let A = makeCombatant(a);
  let B = makeCombatant(b);
  const rows: TurnRow[] = [];
  let turn = 1;
  const snap = (
    actor: "A" | "B",
    actorName: string,
    parsed: { raw: number; cap: number; applied: number },
    logs: Omit<LogEntry, "id">[],
  ) => {
    rows.push({
      turn,
      actor,
      actorName,
      rawDamage: parsed.raw,
      cap: parsed.cap,
      appliedDamage: parsed.applied,
      aHp: A.engineHp, aMaxHp: A.engineMaxHp,
      bHp: B.engineHp, bMaxHp: B.engineMaxHp,
      aMp: A.mp, aMaxMp: A.maxMp,
      bMp: B.mp, bMaxMp: B.maxMp,
      logs: logs.map((l) => l.text),
    });
  };
  while (A.engineHp > 0 && B.engineHp > 0 && turn <= maxTurns) {
    // A의 턴
    const startA = onTurnStart(A); A = startA.next;
    const skill = skillEvery > 0 && turn % skillEvery === 0;
    const atkA = performAttack(A, B, { turnNumber: turn, skill });
    A = atkA.attacker; B = atkA.defender;
    const parsedA = parseDamage(atkA.logs);
    if (B.engineHp > 0) {
      const ed = endTurnDrain(A, B, { turnNumber: turn });
      A = ed.self; B = ed.opponent;
      snap("A", A.base.name, parsedA, [...startA.logs, ...atkA.logs, ...ed.logs]);
    } else {
      snap("A", A.base.name, parsedA, [...startA.logs, ...atkA.logs]);
      break;
    }
    turn++;
    if (turn > maxTurns) break;
    // B의 턴
    const startB = onTurnStart(B); B = startB.next;
    const atkB = performAttack(B, A, { turnNumber: turn });
    B = atkB.attacker; A = atkB.defender;
    const parsedB = parseDamage(atkB.logs);
    if (A.engineHp > 0) {
      const ed2 = endTurnDrain(B, A, { turnNumber: turn });
      B = ed2.self; A = ed2.opponent;
      snap("B", B.base.name, parsedB, [...startB.logs, ...atkB.logs, ...ed2.logs]);
    } else {
      snap("B", B.base.name, parsedB, [...startB.logs, ...atkB.logs]);
      break;
    }
    turn++;
  }
  return rows;
}

/** 다중 라인 SVG 차트 (외부 라이브러리 없이 가벼운 구현) */
function LineChart({
  rows,
  series,
  height = 160,
  yMax,
  yLabel,
}: {
  rows: TurnRow[];
  series: { key: keyof TurnRow; color: string; label: string }[];
  height?: number;
  yMax?: number;
  yLabel: string;
}) {
  const { t } = useTranslation();
  const w = 560;
  const padL = 38, padR = 8, padT = 8, padB = 22;
  const innerW = w - padL - padR;
  const innerH = height - padT - padB;
  const max = yMax ?? Math.max(1, ...rows.flatMap((r) => series.map((s) => Number(r[s.key]) || 0)));
  const xStep = rows.length > 1 ? innerW / (rows.length - 1) : 0;
  const path = (key: keyof TurnRow) =>
    rows.map((r, i) => {
      const x = padL + i * xStep;
      const y = padT + innerH - ((Number(r[key]) || 0) / max) * innerH;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t));
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60 p-2">
      <svg viewBox={`0 0 ${w} ${height}`} className="w-full" role="img" aria-label={t("debug2.chartLabel", { label: yLabel })}>
        {/* grid */}
        {ticks.map((t, i) => {
          const y = padT + innerH - (i / (ticks.length - 1)) * innerH;
          return (
            <g key={i}>
              <line x1={padL} x2={w - padR} y1={y} y2={y} stroke="#1e293b" strokeWidth={1} />
              <text x={4} y={y + 3} fontSize="9" fill="#64748b">{t}</text>
            </g>
          );
        })}
        {/* x-axis */}
        {rows.map((r, i) => {
          if (i % Math.max(1, Math.floor(rows.length / 8)) !== 0) return null;
          const x = padL + i * xStep;
          return (
            <text key={i} x={x} y={height - 6} fontSize="9" fill="#64748b" textAnchor="middle">
              T{r.turn}
            </text>
          );
        })}
        {/* series */}
        {series.map((s) => (
          <path key={s.key as string} d={path(s.key)} stroke={s.color} strokeWidth={1.6} fill="none" />
        ))}
        {/* dots */}
        {series.map((s) =>
          rows.map((r, i) => {
            const x = padL + i * xStep;
            const y = padT + innerH - ((Number(r[s.key]) || 0) / max) * innerH;
            return <circle key={`${s.key as string}-${i}`} cx={x} cy={y} r={1.8} fill={s.color} />;
          })
        )}
      </svg>
      <div className="mt-1 flex flex-wrap gap-3 px-2 text-[10px] text-slate-300">
        {series.map((s) => (
          <span key={s.key as string} className="flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
        <span className="ml-auto text-slate-500">{t("debug2.yAxis", { label: yLabel, max })}</span>
      </div>
    </div>
  );
}

export function DebugView() {
  const { t } = useTranslation();
  const dragons = useGameStore((s) => s.dragons);
  const [aId, setAId] = useState<number>(dragons[0]?.id ?? 1);
  const [bId, setBId] = useState<number>(dragons[1]?.id ?? dragons[0]?.id ?? 1);
  const [maxTurns, setMaxTurns] = useState(30);
  const [skillEvery, setSkillEvery] = useState(0);
  const [seed, setSeed] = useState(0); // re-run trigger

  const a = dragons.find((d) => d.id === aId)!;
  const b = dragons.find((d) => d.id === bId)!;

  const rows = useMemo(
    () => (a && b ? runSimulation(a, b, maxTurns, skillEvery) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aId, bId, maxTurns, skillEvery, seed],
  );

  const winner =
    rows.length === 0 ? null
    : rows[rows.length - 1].aHp <= 0 ? t("debug2.winner", { name: b?.name })
    : rows[rows.length - 1].bHp <= 0 ? t("debug2.winner", { name: a?.name })
    : t("debug.timeout");

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <Bug className="h-5 w-5 text-amber-400" />
        <h2 className="text-lg font-bold">{t("debug.title")}</h2>
      </header>

      {/* Controls */}
      <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs">
        <label className="flex flex-col gap-1">
          <span className="text-slate-400">{t("debug.playerA")}</span>
          <select value={aId} onChange={(e) => setAId(+e.target.value)} className="rounded bg-slate-800 px-2 py-1.5">
            {dragons.map((d) => <option key={d.id} value={d.id}>{d.name} [{d.element}]</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-slate-400">{t("debug.playerB")}</span>
          <select value={bId} onChange={(e) => setBId(+e.target.value)} className="rounded bg-slate-800 px-2 py-1.5">
            {dragons.map((d) => <option key={d.id} value={d.id}>{d.name} [{d.element}]</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-slate-400">{t("debug.maxTurns")}</span>
          <input type="number" min={1} max={100} value={maxTurns} onChange={(e) => setMaxTurns(+e.target.value || 1)} className="rounded bg-slate-800 px-2 py-1.5" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-slate-400">{t("debug.skillEvery")}</span>
          <input type="number" min={0} max={20} value={skillEvery} onChange={(e) => setSkillEvery(+e.target.value || 0)} className="rounded bg-slate-800 px-2 py-1.5" />
        </label>
        <button onClick={() => setSeed((s) => s + 1)} className="col-span-2 mt-1 flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 font-semibold text-slate-950 hover:bg-amber-400">
          <Play className="h-4 w-4" /> {t("debug.rerun")}
        </button>
      </div>

      {/* Initial stats */}
      {a && b && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          {[a, b].map((d, i) => {
            const c: Combatant = makeCombatant(d);
            const s = effectiveStats(c);
            return (
              <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/60 p-2">
                <p className="text-[10px] uppercase text-slate-500">{i === 0 ? "A" : "B"}</p>
                <p className="font-bold">{d.name}</p>
                <p className="text-slate-400">{t("debug2.initStats", { hp: c.engineMaxHp, atk: s.atk, def: s.def, mp: c.maxMp })}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Charts */}
      <section className="space-y-2">
        <h3 className="text-sm font-bold text-slate-300">{t("debug.hpTrend")}</h3>
        <LineChart
          rows={rows}
          yLabel="HP"
          series={[
            { key: "aHp", color: "#34d399", label: `${a?.name} HP` },
            { key: "bHp", color: "#f87171", label: `${b?.name} HP` },
          ]}
        />
        <h3 className="text-sm font-bold text-slate-300">{t("debug.mpTrend")}</h3>
        <LineChart
          rows={rows}
          yLabel="MP"
          series={[
            { key: "aMp", color: "#60a5fa", label: `${a?.name} MP` },
            { key: "bMp", color: "#a78bfa", label: `${b?.name} MP` },
          ]}
        />
        <h3 className="text-sm font-bold text-slate-300">{t("debug.damageTrend")}</h3>
        <LineChart
          rows={rows}
          yLabel="DMG"
          series={[
            { key: "rawDamage", color: "#fbbf24", label: "Raw" },
            { key: "cap", color: "#94a3b8", label: "Cap" },
            { key: "appliedDamage", color: "#fb7185", label: "Applied" },
          ]}
        />
      </section>

      {/* Summary */}
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100">
        <p>{t("debug.summary", { n: rows.length })}<b>{winner ?? "-"}</b></p>
        <p className="text-amber-200/80">
          {t("debug2.summaryAvg", {
            raw: rows.length ? Math.round(rows.reduce((a, r) => a + r.rawDamage, 0) / rows.length) : 0,
            applied: rows.length ? Math.round(rows.reduce((a, r) => a + r.appliedDamage, 0) / rows.length) : 0,
          })}
        </p>
      </div>

      {/* Table */}
      <section className="space-y-1">
        <h3 className="text-sm font-bold text-slate-300">{t("debug.tableTitle")}</h3>
        <div className="max-h-[420px] overflow-auto rounded-xl border border-slate-800">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-slate-900 text-slate-400">
              <tr>
                <th className="px-2 py-1 text-left">{t("debug2.tableHeaders.T")}</th>
                <th className="px-2 py-1 text-left">{t("debug2.tableHeaders.actor")}</th>
                <th className="px-2 py-1 text-right">{t("debug2.tableHeaders.raw")}</th>
                <th className="px-2 py-1 text-right">{t("debug2.tableHeaders.cap")}</th>
                <th className="px-2 py-1 text-right">{t("debug2.tableHeaders.applied")}</th>
                <th className="px-2 py-1 text-right">{t("debug2.tableHeaders.aHp")}</th>
                <th className="px-2 py-1 text-right">{t("debug2.tableHeaders.bHp")}</th>
                <th className="px-2 py-1 text-right">{t("debug2.tableHeaders.aMp")}</th>
                <th className="px-2 py-1 text-right">{t("debug2.tableHeaders.bMp")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={i % 2 ? "bg-slate-900/40" : "bg-slate-900/20"}>
                  <td className="px-2 py-1">{r.turn}</td>
                  <td className={`px-2 py-1 ${r.actor === "A" ? "text-emerald-300" : "text-rose-300"}`}>
                    {r.actor}·{r.actorName}
                  </td>
                  <td className="px-2 py-1 text-right font-mono text-amber-200">{r.rawDamage || "-"}</td>
                  <td className="px-2 py-1 text-right font-mono text-slate-400">{r.cap || "-"}</td>
                  <td className="px-2 py-1 text-right font-mono text-rose-300">{r.appliedDamage || "-"}</td>
                  <td className="px-2 py-1 text-right font-mono">{r.aHp}<span className="text-slate-500">/{r.aMaxHp}</span></td>
                  <td className="px-2 py-1 text-right font-mono">{r.bHp}<span className="text-slate-500">/{r.bMaxHp}</span></td>
                  <td className="px-2 py-1 text-right font-mono text-sky-300">{r.aMp}</td>
                  <td className="px-2 py-1 text-right font-mono text-violet-300">{r.bMp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Logs */}
      <section className="space-y-1">
        <h3 className="text-sm font-bold text-slate-300">{t("debug.logs")}</h3>
        <div className="max-h-[300px] space-y-2 overflow-auto rounded-xl border border-slate-800 bg-slate-950/70 p-2 font-mono text-[11px] leading-relaxed">
          {rows.map((r, i) => (
            <div key={i}>
              <p className="text-slate-500">— Turn {r.turn} ({r.actor}·{r.actorName}) —</p>
              {r.logs.map((l, j) => <p key={j} className="text-slate-300">  {l}</p>)}
            </div>
          ))}
        </div>
      </section>
      {/* hpPercent kept for future overlay use */}
      <span className="hidden">{rows[0] ? hpPercent(makeCombatant(a)).toFixed(0) : ""}</span>
    </div>
  );
}