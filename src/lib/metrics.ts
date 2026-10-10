// Pure dashboard aggregations over call records.
import type { CallRecord, CallSource, Outcome } from "./types";

export type RangeKey = "7d" | "30d" | "90d" | "all";
export type SourceFilter = CallSource | "all";

export const RANGE_LABELS: Record<RangeKey, string> = { "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days", all: "All time" };
export const SOURCE_LABELS: Record<SourceFilter, string> = { all: "All sources", vaani: "Real calls (Vaani)", simulated: "Simulated calls", demo_seed: "Demo seed (case transcripts)" };
export const OUTCOME_LABELS: Record<Outcome, string> = {
  qualified: "Qualified",
  unqualified: "Unqualified",
  needs_follow_up: "Needs follow-up",
  needs_human_review: "Human review",
};
export const OUTCOME_ORDER: Outcome[] = ["qualified", "needs_follow_up", "needs_human_review", "unqualified"];

export function parseRange(v: unknown): RangeKey {
  return v === "7d" || v === "30d" || v === "90d" ? v : "all";
}
export function parseSource(v: unknown): SourceFilter {
  return v === "vaani" || v === "simulated" || v === "demo_seed" ? v : "all";
}

export function filterCalls(calls: CallRecord[], range: RangeKey, source: SourceFilter, now = new Date()): CallRecord[] {
  const days = range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : null;
  const cutoff = days ? now.getTime() - days * 86_400_000 : -Infinity;
  return calls.filter((c) => new Date(c.created_at).getTime() >= cutoff && (source === "all" || c.source === source));
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function computeMetrics(calls: CallRecord[]) {
  const by = (o: Outcome) => calls.filter((c) => c.outcome === o).length;
  const total = calls.length;
  const qualified = by("qualified");
  const newEnquiries = calls.filter((c) => c.caller_type === "new_enquiry" && !c.escalation_required);
  const notDeclined = newEnquiries.filter((c) => c.outcome !== "unqualified");
  const handedOff = calls.filter((c) => c.outcome === "qualified" && c.handoff_status === "sent").length;
  const handoffPrepared = calls.filter((c) => c.outcome === "qualified" && c.handoff_status !== "not_required").length;

  const durations = calls.map((c) => c.duration_sec ?? 0).filter((d) => d > 0);
  const voice = sum(calls.map((c) => c.voice_cost_inr ?? 0));
  const ai = sum(calls.map((c) => c.ai_cost_inr ?? 0));
  const totalCost = voice + ai;

  // Decline reasons: every failed criterion on unqualified calls.
  const declineReasons = new Map<string, number>();
  for (const c of calls.filter((x) => x.outcome === "unqualified"))
    for (const cr of c.criteria.filter((x) => x.status === "fail")) declineReasons.set(cr.label, (declineReasons.get(cr.label) ?? 0) + 1);

  // Calls per day, split by outcome (IST calendar days).
  const days = new Map<string, Record<Outcome, number>>();
  for (const c of calls) {
    const d = new Date(c.created_at).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const row = days.get(d) ?? { qualified: 0, unqualified: 0, needs_follow_up: 0, needs_human_review: 0 };
    row[c.outcome] += 1;
    days.set(d, row);
  }
  // Fill empty days so the time axis is continuous (capped to keep the chart readable).
  const keys = [...days.keys()].sort();
  if (keys.length > 1) {
    const end = new Date(`${keys[keys.length - 1]}T00:00:00Z`);
    for (let t = new Date(`${keys[0]}T00:00:00Z`); t <= end && days.size < 120; t.setUTCDate(t.getUTCDate() + 1)) {
      const k = t.toISOString().slice(0, 10);
      if (!days.has(k)) days.set(k, { qualified: 0, unqualified: 0, needs_follow_up: 0, needs_human_review: 0 });
    }
  }

  return {
    total,
    qualified,
    unqualified: by("unqualified"),
    needsFollowUp: by("needs_follow_up"),
    humanReview: by("needs_human_review"),
    escalations: calls.filter((c) => c.escalation_required).length,
    timelineConflicts: calls.filter((c) => c.timeline_conflict).length,
    pricingAsked: calls.filter((c) => c.pricing_asked).length,
    qualificationRate: newEnquiries.length ? qualified / newEnquiries.length : 0,
    funnel: [
      { label: "Calls answered", value: total, hint: "All calls in the selected range" },
      { label: "New enquiries", value: newEnquiries.length, hint: "Excludes existing clients and escalations" },
      { label: "In scope", value: notDeclined.length, hint: "Not declined: qualified, pending follow-up, or flagged for review" },
      { label: "Qualified", value: qualified, hint: "Passed all five criteria" },
      { label: "Handoff delivered", value: handedOff, hint: `Confirmed by Telegram. ${handoffPrepared - handedOff} prepared but not delivered.` },
    ],
    durations: {
      totalSec: sum(durations),
      avgSec: durations.length ? sum(durations) / durations.length : 0,
      maxSec: durations.length ? Math.max(...durations) : 0,
    },
    costs: {
      voice,
      ai,
      total: totalCost,
      perCall: total ? totalCost / total : 0,
      perQualified: qualified ? totalCost / qualified : null,
      anyEstimated: calls.some((c) => c.cost_estimated),
      allEstimated: calls.length > 0 && calls.every((c) => c.cost_estimated),
    },
    declineReasons: [...declineReasons.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value })),
    byDay: [...days.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, counts]) => ({ date, ...counts })),
  };
}

export type Metrics = ReturnType<typeof computeMetrics>;

export function formatDuration(sec: number): string {
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  return m ? `${m}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}

export function formatInr(v: number, digits = 2): string {
  return `₹${v.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}
