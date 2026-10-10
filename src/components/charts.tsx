"use client";
import { useState } from "react";
import { OUTCOME_LABELS, OUTCOME_ORDER } from "@/lib/metrics";
import type { Outcome } from "@/lib/types";
import { OUTCOME_COLOR } from "./ui";

/** Horizontal funnel: one series, one hue. Each stage shows count + % of the first stage. */
export function FunnelChart({ stages }: { stages: { label: string; value: number; hint: string }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, stages[0]?.value ?? 1);
  return (
    <div className="space-y-2.5">
      {stages.map((s, i) => {
        const pct = (s.value / max) * 100;
        return (
          <div key={s.label} className="relative" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="font-medium text-ink-2">{s.label}</span>
              <span className="tabular text-ink">
                <span className="font-semibold">{s.value}</span>
                <span className="ml-1.5 text-muted">{i === 0 ? "" : `${Math.round(pct)}%`}</span>
              </span>
            </div>
            <div className="h-5 w-full rounded bg-surface-2">
              <div
                className="h-5 rounded transition-[width]"
                style={{ width: `${Math.max(pct, s.value ? 1.5 : 0)}%`, background: "var(--series-1)", opacity: hover === null || hover === i ? 1 : 0.55 }}
              />
            </div>
            {hover === i && (
              <div className="pointer-events-none absolute right-0 top-full z-10 mt-1 max-w-xs rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs text-ink-2 shadow-lg">
                {s.hint}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function OutcomeLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
      {OUTCOME_ORDER.map((o) => (
        <span key={o} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: OUTCOME_COLOR[o] }} />
          {OUTCOME_LABELS[o]}
        </span>
      ))}
    </div>
  );
}

type DayRow = { date: string } & Record<Outcome, number>;

/** Calls per day, stacked by outcome. 2px surface gaps between segments; hover shows the breakdown. */
export function CallsByDayChart({ rows }: { rows: DayRow[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (rows.length === 0) return <p className="py-10 text-center text-sm text-muted">No calls in this range.</p>;
  const totals = rows.map((r) => OUTCOME_ORDER.reduce((a, o) => a + r[o], 0));
  const max = Math.max(...totals, 1);
  const ticks = max <= 4 ? Array.from({ length: max + 1 }, (_, i) => i) : [0, Math.round(max / 2), max];
  const H = 160;
  const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const labelEvery = Math.ceil(rows.length / 8);

  return (
    <div>
      <div className="relative flex gap-2">
        {/* y axis */}
        <div className="relative w-6 shrink-0 text-right text-[10px] text-muted tabular" style={{ height: H }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: H - (t / max) * H }}>
              {t}
            </span>
          ))}
        </div>
        <div className="relative flex-1" style={{ height: H }}>
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 border-t" style={{ top: H - (t / max) * H, borderColor: t === 0 ? "var(--axis)" : "var(--grid)" }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-[3px]">
            {rows.map((r, i) => (
              <div
                key={r.date}
                className="relative flex h-full flex-1 cursor-default flex-col justify-end"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <div className="flex flex-col-reverse gap-[2px]" style={{ opacity: hover === null || hover === i ? 1 : 0.5 }}>
                  {OUTCOME_ORDER.filter((o) => r[o] > 0).map((o, j, arr) => (
                    <div
                      key={o}
                      style={{ height: (r[o] / max) * H - 2, background: OUTCOME_COLOR[o], borderRadius: j === arr.length - 1 ? "4px 4px 0 0" : 0 }}
                    />
                  ))}
                </div>
                {hover === i && (
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-40 -translate-x-1/2 rounded-md border border-line bg-surface p-2 text-xs shadow-lg">
                    <div className="mb-1 font-semibold text-ink">
                      {fmt(r.date)} · {totals[i]} call{totals[i] === 1 ? "" : "s"}
                    </div>
                    {OUTCOME_ORDER.filter((o) => r[o] > 0).map((o) => (
                      <div key={o} className="flex items-center justify-between text-ink-2">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-sm" style={{ background: OUTCOME_COLOR[o] }} />
                          {OUTCOME_LABELS[o]}
                        </span>
                        <span className="tabular text-ink">{r[o]}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="ml-8 mt-1.5 flex gap-[3px] text-[10px] text-muted">
        {rows.map((r, i) => (
          <div key={r.date} className="flex-1 truncate text-center">
            {i % labelEvery === 0 ? fmt(r.date) : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Ranked horizontal bars for a single measure. */
export function BarList({ items, empty }: { items: { label: string; value: number }[]; empty: string }) {
  if (items.length === 0) return <p className="py-6 text-center text-sm text-muted">{empty}</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-2.5">
      {items.map((it) => (
        <div key={it.label} title={`${it.label}: ${it.value}`}>
          <div className="mb-1 flex justify-between gap-3 text-xs">
            <span className="text-ink-2">{it.label}</span>
            <span className="tabular font-semibold text-ink">{it.value}</span>
          </div>
          <div className="h-2.5 rounded-sm bg-surface-2">
            <div className="h-2.5 rounded-sm" style={{ width: `${(it.value / max) * 100}%`, background: "var(--series-1)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}
