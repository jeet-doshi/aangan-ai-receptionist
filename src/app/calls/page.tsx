import Link from "next/link";
import { Suspense } from "react";
import { RecentCallsTable } from "@/components/calls-table";
import { Filters } from "@/components/filters";
import { Card } from "@/components/ui";
import { filterCalls, OUTCOME_LABELS, parseRange, parseSource, RANGE_LABELS, SOURCE_LABELS } from "@/lib/metrics";
import { loadCalls, StorageError } from "@/components/storage-error";
import type { Outcome } from "@/lib/types";

export default async function CallsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const outcome = sp.outcome && sp.outcome in OUTCOME_LABELS ? (sp.outcome as Outcome) : null;
  const escalationOnly = sp.escalation === "yes";
  const loaded = await loadCalls();
  if (loaded.error) return <StorageError error={loaded.error} />;
  let calls = filterCalls(loaded.calls, parseRange(sp.range), parseSource(sp.source));
  if (outcome) calls = calls.filter((c) => c.outcome === outcome);
  if (escalationOnly) calls = calls.filter((c) => c.escalation_required);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Call records</h1>
          <p className="mt-1 text-sm text-ink-2">
            {calls.length} record{calls.length === 1 ? "" : "s"}. Open one to see the criteria, the receptionist&apos;s reply and the handoff note.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Suspense>
            <Filters
              filters={[
                { key: "range", label: "Date range", options: Object.entries(RANGE_LABELS).map(([value, label]) => ({ value, label })).reverse() },
                { key: "source", label: "Source", options: Object.entries(SOURCE_LABELS).map(([value, label]) => ({ value, label })) },
                { key: "outcome", label: "Outcome", options: [{ value: "all", label: "All outcomes" }, ...Object.entries(OUTCOME_LABELS).map(([value, label]) => ({ value, label }))] },
                { key: "escalation", label: "Escalation", options: [{ value: "all", label: "Any escalation status" }, { value: "yes", label: "Escalations only" }] },
              ]}
            />
          </Suspense>
          <Link href="/simulate" className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-brand-ink">
            + Simulate call
          </Link>
        </div>
      </div>
      <Card>
        <RecentCallsTable calls={calls} />
      </Card>
    </div>
  );
}
