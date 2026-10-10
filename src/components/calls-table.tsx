import Link from "next/link";
import { PROJECT_TYPE_LABELS } from "@/lib/policy";
import { formatDuration } from "@/lib/metrics";
import type { CallRecord } from "@/lib/types";
import { EscalationBadge, HandoffBadge, OutcomeBadge, SourceBadge } from "./ui";

export function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function RecentCallsTable({ calls }: { calls: CallRecord[] }) {
  if (calls.length === 0) return <p className="py-6 text-center text-sm text-muted">No calls match these filters.</p>;
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs text-muted">
            <th className="px-5 py-2 font-medium">When (IST)</th>
            <th className="px-2 py-2 font-medium">Caller</th>
            <th className="px-2 py-2 font-medium">Project · location</th>
            <th className="px-2 py-2 font-medium">Outcome</th>
            <th className="px-2 py-2 font-medium">Handoff</th>
            <th className="px-2 py-2 font-medium">Source</th>
            <th className="px-5 py-2 text-right font-medium">Duration</th>
          </tr>
        </thead>
        <tbody>
          {calls.map((c) => (
            <tr key={c.id} className="border-b border-line last:border-0 hover:bg-surface-2">
              <td className="whitespace-nowrap px-5 py-2.5 text-ink-2 tabular">
                <Link href={`/calls/${c.id}`} className="hover:underline">
                  {formatWhen(c.created_at)}
                </Link>
              </td>
              <td className="px-2 py-2.5">
                <Link href={`/calls/${c.id}`} className="font-medium hover:underline">
                  {c.caller_name || "Unnamed caller"}
                </Link>
                <div className="text-xs text-muted">
                  {c.caller_type === "existing_client" ? "Existing client" : "New enquiry"}
                  {c.reference ? ` · ${c.reference}` : ""}
                </div>
              </td>
              <td className="px-2 py-2.5 text-ink-2">
                <div>{PROJECT_TYPE_LABELS[c.project_type]}</div>
                <div className="text-xs text-muted">{c.location || "Location not stated"}</div>
              </td>
              <td className="px-2 py-2.5">
                <div className="flex flex-wrap gap-1">
                  <OutcomeBadge outcome={c.outcome} />
                  {c.escalation_required && <EscalationBadge />}
                </div>
              </td>
              <td className="px-2 py-2.5">
                <HandoffBadge status={c.handoff_status} />
              </td>
              <td className="px-2 py-2.5">
                <SourceBadge source={c.source} />
              </td>
              <td className="px-5 py-2.5 text-right text-ink-2 tabular">{c.duration_sec ? formatDuration(c.duration_sec) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
