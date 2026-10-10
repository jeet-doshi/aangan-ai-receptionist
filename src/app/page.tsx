import Link from "next/link";
import { Suspense } from "react";
import { BarList, CallsByDayChart, FunnelChart, OutcomeLegend } from "@/components/charts";
import { Filters } from "@/components/filters";
import { ReseedButton } from "@/components/actions";
import { RecentCallsTable } from "@/components/calls-table";
import { Card, StatTile } from "@/components/ui";
import { computeMetrics, filterCalls, formatDuration, formatInr, parseRange, parseSource, RANGE_LABELS, SOURCE_LABELS } from "@/lib/metrics";
import { getIntegrationStatus } from "@/lib/status";
import { loadCalls, StorageError } from "@/components/storage-error";

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const range = parseRange(sp.range);
  const source = parseSource(sp.source);
  const { calls: all, error } = await loadCalls();
  if (error) return <StorageError error={error} />;
  const calls = filterCalls(all, range, source);
  const m = computeMetrics(calls);
  const status = getIntegrationStatus();
  const nonReal = calls.filter((c) => c.source !== "vaani").length;
  const pct = (n: number) => (m.total ? `${Math.round((n / m.total) * 100)}% of calls` : "—");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Enquiry dashboard</h1>
          <p className="mt-1 text-sm text-ink-2">Every phone enquiry answered, qualified against the studio rubric, and routed to the right person.</p>
        </div>
        <Suspense>
          <Filters
            filters={[
              { key: "range", label: "Date range", options: Object.entries(RANGE_LABELS).map(([value, label]) => ({ value, label })).reverse() },
              { key: "source", label: "Source", options: Object.entries(SOURCE_LABELS).map(([value, label]) => ({ value, label })) },
            ]}
          />
        </Suspense>
      </div>

      {nonReal > 0 && (
        <div className="rounded-lg bg-demo px-4 py-2.5 text-sm text-demo-ink">
          <strong>Demo data:</strong> {nonReal} of {m.total} records shown are demo or simulated calls, <strong>not real calls</strong>. The demo seed replays the Sep 2026 case transcripts through the AI rules.
          Use the Source filter to isolate live Vaani voice calls.
        </div>
      )}

      {all.length === 0 && (
        <Card title="No calls yet">
          <p className="mb-3 text-sm text-ink-2">The database is empty. Load the labelled demo dataset (19 case-transcript replays), or simulate a call.</p>
          <div className="flex gap-2">
            <ReseedButton label="Load demo data" />
            <Link href="/simulate" className="rounded-md border border-line px-3 py-1.5 text-sm font-medium">Simulate a call</Link>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Total calls" value={m.total} hint={`${formatDuration(m.durations.totalSec)} total talk time`} />
        <StatTile label="Qualified leads" value={m.qualified} hint={`${Math.round(m.qualificationRate * 100)}% of new enquiries`} tone="good" />
        <StatTile label="Unqualified" value={m.unqualified} hint={`${pct(m.unqualified)}. Declined gracefully`} />
        <StatTile label="Needs human review" value={m.humanReview} hint={`${m.escalations} urgent escalation${m.escalations === 1 ? "" : "s"} · ${m.timelineConflicts} timeline conflict${m.timelineConflicts === 1 ? "" : "s"}`} tone={m.escalations ? "critical" : undefined} />
        <StatTile label="Awaiting follow-up" value={m.needsFollowUp} hint="One direct question still open" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card title="Lead conversion funnel" subtitle="Hover a stage for its definition" className="lg:col-span-2">
          <FunnelChart stages={m.funnel} />
        </Card>
        <Card title="Calls per day by outcome" subtitle={`${RANGE_LABELS[range]} · IST`} className="lg:col-span-3" action={<OutcomeLegend />}>
          <CallsByDayChart rows={m.byDay} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card
          title="Running cost"
          subtitle={
            m.costs.allEstimated
              ? `Estimated from configured rates: ${formatInr(status.costs.voicePerMinInr)}/min voice + ${formatInr(status.costs.aiPerCallInr)}/call AI${status.costs.isDefault ? " (placeholder rates; set your real Vaani rates in .env.local)" : ""}`
              : m.costs.anyEstimated
                ? "Mix of provider-reported and estimated costs"
                : "Provider-reported costs"
          }
          className="lg:col-span-3"
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Metric label="Total cost" value={formatInr(m.costs.total)} />
            <Metric label="Cost per call" value={formatInr(m.costs.perCall)} />
            <Metric label="Cost per qualified lead" value={m.costs.perQualified == null ? "—" : formatInr(m.costs.perQualified)} />
            <Metric label="Voice minutes cost" value={formatInr(m.costs.voice)} />
            <Metric label="AI processing cost" value={formatInr(m.costs.ai)} />
            <Metric label="Rules engine cost" value="₹0.00" hint="Deterministic, no LLM call" />
            <Metric label="Avg call duration" value={formatDuration(m.durations.avgSec)} />
            <Metric label="Longest call" value={formatDuration(m.durations.maxSec)} />
            <Metric label="Pricing questions" value={String(m.pricingAsked)} hint="Answered with approved line, never a figure" />
          </div>
        </Card>
        <Card title="Why enquiries were declined" subtitle="Failed criteria on unqualified calls" className="lg:col-span-2">
          <BarList items={m.declineReasons} empty="No declined enquiries in this range." />
        </Card>
      </div>

      <Card title="Recent call activity" action={<Link href="/calls" className="text-sm font-medium text-brand hover:underline">All records →</Link>}>
        <RecentCallsTable calls={calls.slice(0, 8)} />
      </Card>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-surface-2 p-3">
      <div className="text-xs text-ink-2">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular">{value}</div>
      {hint && <div className="text-[11px] text-muted">{hint}</div>}
    </div>
  );
}
