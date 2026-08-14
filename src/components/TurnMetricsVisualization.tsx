import React from "react";
import type { ConversationTurn } from "@/types/agentTurns";

/** Reference-style palette: ASR cyan, LLM purple, TTS orange (flat fills). */
const PALETTE = {
  asr: "#22d3ee",
  llm: "#a855f7",
  tts: "#fb923c",
} as const;

function msLabel(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  return s < 10 ? `${s.toFixed(1)} s` : `${Math.round(s)} s`;
}

function bucketSegments(
  segs: { name: string; latency: number }[] | undefined,
): { asr: number; llm: number; tts: number } {
  const out = { asr: 0, llm: 0, tts: 0 };
  if (!segs?.length) return out;
  for (const s of segs) {
    const v = Math.max(0, Number(s.latency) || 0);
    if (s.name === "asr_ttlw") out.asr += v;
    else if (
      s.name === "llm_ttft" ||
      s.name === "llm_ftfs" ||
      s.name === "llm_ttfa"
    )
      out.llm += v;
    else if (s.name === "tts_ttfb") out.tts += v;
  }
  return out;
}

/** Upper bound for chart Y-axis (readable ticks like 200 / 400 / 750). */
function chartCeilingMs(maxSample: number): number {
  const raw = Math.max(maxSample, 1);
  const steps = [100, 200, 250, 400, 500, 750, 1000, 1500, 2000, 3000, 5000];
  for (const s of steps) {
    if (s >= raw * 1.02) return s;
  }
  return Math.ceil(raw / 250) * 250;
}

function pickYTicks(ceiling: number): number[] {
  const split = [
    0,
    Math.round(ceiling / 3),
    Math.round((2 * ceiling) / 3),
    ceiling,
  ];
  return [...new Set(split)].sort((a, b) => a - b);
}

type TurnRow = {
  turnId: number;
  asr: number;
  llm: number;
  tts: number;
  e2e: number;
};

function GroupedLatencyChart({
  rows,
  yMax,
}: {
  rows: TurnRow[];
  yMax: number;
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  const W = 520;
  const H = 200;
  const padL = 36;
  const padR = 12;
  const padT = 16;
  const padB = 36;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const ticks = pickYTicks(yMax);
  const n = Math.max(rows.length, 1);
  const groupW = innerW / n;
  const barGap = 4;
  const barW = Math.max(6, (groupW - barGap * 4) / 3);

  const barHeight = (ms: number) => (ms / yMax) * innerH;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto max-h-[220px] text-zinc-500"
        role="img"
        aria-label="Latency per turn: grouped bars for ASR, LLM, and TTS in milliseconds"
      >
        {ticks.map((tk) => {
          const y = padT + innerH - (tk / yMax) * innerH;
          return (
            <g key={tk}>
              <line
                x1={padL}
                x2={W - padR}
                y1={y}
                y2={y}
                stroke="currentColor"
                strokeDasharray="4 6"
                strokeOpacity={0.35}
              />
              <text
                x={padL - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-zinc-500 text-[9px] font-medium tabular-nums"
              >
                {tk}
              </text>
            </g>
          );
        })}

        {rows.map((r, i) => {
          const gx = padL + i * groupW + (groupW - (3 * barW + 2 * barGap)) / 2;
          const bases = [
            { key: "asr", ms: r.asr, fill: PALETTE.asr, x: gx },
            { key: "llm", ms: r.llm, fill: PALETTE.llm, x: gx + barW + barGap },
            {
              key: "tts",
              ms: r.tts,
              fill: PALETTE.tts,
              x: gx + 2 * (barW + barGap),
            },
          ];
          return (
            <g key={r.turnId}>
              <title>
                {`T${r.turnId} — E2E ${Math.round(r.e2e)} ms | ASR ${Math.round(r.asr)} · LLM ${Math.round(r.llm)} · TTS ${Math.round(r.tts)}`}
              </title>
              <rect
                x={padL + i * groupW + 2}
                y={padT}
                width={groupW - 4}
                height={innerH}
                fill="transparent"
                className="cursor-default"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
              {bases.map((b) => {
                const h = barHeight(b.ms);
                const y = padT + innerH - h;
                return (
                  <rect
                    key={b.key}
                    x={b.x}
                    y={y}
                    width={barW}
                    height={Math.max(h, 0)}
                    fill={b.fill}
                    rx={2}
                    opacity={hover === null || hover === i ? 1 : 0.35}
                  />
                );
              })}
              <text
                x={gx + (3 * barW + 2 * barGap) / 2}
                y={H - 10}
                textAnchor="middle"
                className="fill-zinc-400 text-[10px] font-semibold tabular-nums"
              >
                T{r.turnId}
              </text>
            </g>
          );
        })}
      </svg>

      {hover !== null && rows[hover] != null ? (
        <div
          className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-lg border border-zinc-700 bg-zinc-900/98 px-3 py-2 text-xs shadow-xl backdrop-blur-sm"
          role="status"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Turn T{rows[hover].turnId}
          </p>
          <p className="mt-0.5 font-semibold text-white tabular-nums">
            E2E: {msLabel(rows[hover].e2e)}
          </p>
          <p className="mt-1 space-y-0.5 tabular-nums">
            <span className="block" style={{ color: PALETTE.asr }}>
              ASR: {msLabel(rows[hover].asr)}
            </span>
            <span className="block" style={{ color: PALETTE.llm }}>
              LLM: {msLabel(rows[hover].llm)}
            </span>
            <span className="block" style={{ color: PALETTE.tts }}>
              TTS: {msLabel(rows[hover].tts)}
            </span>
          </p>
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center justify-center gap-5 text-[11px] text-zinc-400">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: PALETTE.asr }}
          />
          ASR
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: PALETTE.llm }}
          />
          LLM
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: PALETTE.tts }}
          />
          TTS
        </span>
      </div>
      <p className="mt-1 text-center text-[10px] text-zinc-600">
        Hover a turn for totals · Scale 0–{yMax} ms
      </p>
    </div>
  );
}

function SummaryCard({
  label,
  sub,
  valueMs,
  accent,
}: {
  label: string;
  sub?: string;
  valueMs: number;
  accent?: "white" | "cyan" | "purple" | "orange";
}) {
  const color =
    accent === "cyan"
      ? "text-cyan-400"
      : accent === "purple"
        ? "text-purple-400"
        : accent === "orange"
          ? "text-orange-400"
          : "text-white";
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      {sub ? (
        <p className="mt-0.5 text-[10px] text-zinc-600">{sub}</p>
      ) : null}
      <p
        className={`mt-1 text-lg font-bold tabular-nums tracking-tight sm:text-xl ${color}`}
      >
        {msLabel(valueMs)}
      </p>
    </div>
  );
}

const TurnMetricsVisualization: React.FC<{ turns: ConversationTurn[] }> = ({
  turns,
}) => {
  const sortedTurns = React.useMemo(
    () => [...turns].sort((a, b) => (a.turn_id ?? 0) - (b.turn_id ?? 0)),
    [turns],
  );

  const rows: TurnRow[] = React.useMemo(
    () =>
      sortedTurns.map((t, i) => {
        const b = bucketSegments(t.metrics?.segmented_latency_ms);
        const e2e = t.metrics?.e2e_latency_ms ?? 0;
        return {
          turnId: t.turn_id ?? i + 1,
          ...b,
          e2e,
        };
      }),
    [sortedTurns],
  );

  const averages = React.useMemo(() => {
    const n = Math.max(rows.length, 1);
    const acc = rows.reduce(
      (a, r) => ({
        e2e: a.e2e + r.e2e,
        asr: a.asr + r.asr,
        llm: a.llm + r.llm,
        tts: a.tts + r.tts,
      }),
      { e2e: 0, asr: 0, llm: 0, tts: 0 },
    );
    return {
      e2e: acc.e2e / n,
      asr: acc.asr / n,
      llm: acc.llm / n,
      tts: acc.tts / n,
    };
  }, [rows]);

  const yMax = React.useMemo(() => {
    let m = 1;
    for (const r of rows) {
      m = Math.max(m, r.asr, r.llm, r.tts, r.e2e);
    }
    return chartCeilingMs(m);
  }, [rows]);

  return (
    <div className="turn-metrics-viz max-h-[min(82vh,640px)] overflow-y-auto pr-1">
      <div className="rounded-xl border border-zinc-800 bg-neutral-950 text-zinc-100 shadow-lg">
        <header className="border-b border-zinc-800 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold tracking-tight text-white sm:text-lg">
              Latency debug
            </h2>
            <a
              href="https://docs.agora.io/en/conversational-ai/rest-api/agent/turns"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-medium text-cyan-400/90 underline decoration-cyan-500/30 underline-offset-2 hover:text-cyan-300"
            >
              Agora turns API
            </a>
          </div>
          <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-zinc-500">
            Session averages (top), then each turn as three bars — speech
            recognition (ASR), model (LLM), and voice (TTS). End-to-end is total
            wait until the reply starts.
          </p>
        </header>

        <div className="grid gap-2 border-b border-zinc-800 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
          <SummaryCard
            label="Total (E2E)"
            sub="Avg until reply starts"
            valueMs={averages.e2e}
            accent="white"
          />
          <SummaryCard
            label="ASR"
            sub="Hearing you → text"
            valueMs={averages.asr}
            accent="cyan"
          />
          <SummaryCard
            label="LLM"
            sub="Thinking (tokens / audio)"
            valueMs={averages.llm}
            accent="purple"
          />
          <SummaryCard
            label="TTS"
            sub="Text → sound"
            valueMs={averages.tts}
            accent="orange"
          />
        </div>

        <section className="border-b border-zinc-800 px-4 py-4 sm:px-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-zinc-200">
              Latency per turn (ms)
            </h3>
            <span className="text-[11px] tabular-nums text-zinc-500">
              {rows.length} turn{rows.length === 1 ? "" : "s"}
            </span>
          </div>
          <GroupedLatencyChart rows={rows} yMax={yMax} />
        </section>

        <section className="px-4 py-4 sm:px-5">
          <h3 className="mb-2 text-sm font-semibold text-zinc-200">Numbers</h3>
          <div className="overflow-x-auto rounded-lg border border-zinc-800">
            <table className="w-full min-w-[320px] border-collapse text-left text-[12px]">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/90">
                  <th className="px-3 py-2.5 font-semibold text-zinc-400">
                    Turn
                  </th>
                  <th className="px-3 py-2.5 font-semibold text-zinc-400">
                    ASR
                  </th>
                  <th className="px-3 py-2.5 font-semibold text-zinc-400">
                    LLM
                  </th>
                  <th className="px-3 py-2.5 font-semibold text-zinc-400">
                    TTS
                  </th>
                  <th className="px-3 py-2.5 font-semibold text-white">
                    Total (E2E)
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.turnId}
                    className="border-b border-zinc-800/80 last:border-0 hover:bg-zinc-900/50"
                  >
                    <td className="px-3 py-2 font-medium text-zinc-300">
                      #{r.turnId}
                    </td>
                    <td
                      className="px-3 py-2 tabular-nums"
                      style={{ color: PALETTE.asr }}
                    >
                      {Math.round(r.asr)} ms
                    </td>
                    <td
                      className="px-3 py-2 tabular-nums"
                      style={{ color: PALETTE.llm }}
                    >
                      {Math.round(r.llm)} ms
                    </td>
                    <td
                      className="px-3 py-2 tabular-nums"
                      style={{ color: PALETTE.tts }}
                    >
                      {Math.round(r.tts)} ms
                    </td>
                    <td className="px-3 py-2 font-semibold tabular-nums text-white">
                      {Math.round(r.e2e)} ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="border-t border-zinc-800 px-4 py-3 text-[11px] text-zinc-600 sm:px-5">
          ASR / LLM / TTS are summed from Agora segment names{" "}
          <code className="rounded bg-zinc-900 px-1 text-zinc-500">
            asr_ttlw
          </code>
          ,{" "}
          <code className="rounded bg-zinc-900 px-1 text-zinc-500">
            llm_*
          </code>
          ,{" "}
          <code className="rounded bg-zinc-900 px-1 text-zinc-500">
            tts_ttfb
          </code>
          . Other segments are omitted from the three bars.
        </footer>
      </div>
    </div>
  );
};

export default TurnMetricsVisualization;
