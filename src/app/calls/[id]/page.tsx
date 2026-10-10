import Link from "next/link";
import { notFound } from "next/navigation";
import { RetryHandoffButton } from "@/components/actions";
import { formatWhen } from "@/components/calls-table";
import { Card, EscalationBadge, HandoffBadge, OutcomeBadge, SourceBadge } from "@/components/ui";
import { formatDuration, formatInr } from "@/lib/metrics";
import { PROJECT_TYPE_LABELS } from "@/lib/policy";
import { getStore } from "@/lib/store";
import type { CriterionStatus } from "@/lib/types";

const STATUS_STYLE: Record<CriterionStatus, { label: string; cls: string }> = {
  pass: { label: "✓ Pass", cls: "text-good" },
  fail: { label: "✕ Fail", cls: "text-critical" },
  unclear: { label: "? Unclear", cls: "text-ink-2" },
  conflict: { label: "⚑ Policy conflict", cls: "rounded bg-demo px-1 text-demo-ink" },
};

const DECISION: Record<string, string> = {
  yes: "Yes (caller decides)",
  authorised_representative: "Authorised representative",
  researching_only: "Researching only",
  unknown: "Not confirmed",
};

export default async function CallDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getStore().get(id);
  if (!c) notFound();
  const needsHandoff = c.outcome === "qualified" || c.outcome === "needs_human_review";

  const fields: [string, string][] = [
    ["Caller", c.caller_name || "Not given"],
    ["Phone", c.caller_phone || "Not given"],
    ["Caller type", c.caller_type === "existing_client" ? "Existing client" : "New enquiry"],
    ["Project type", PROJECT_TYPE_LABELS[c.project_type]],
    ["Carpet area", c.area_sqft ? `${c.area_sqft.toLocaleString("en-IN")} sq ft` : "Not stated"],
    ["Location", c.location || "Not stated"],
    ["Timeline", c.timeline_text || (c.timeline_kind === "deadline" && c.deadline_weeks != null ? `${c.deadline_weeks} weeks` : c.timeline_kind === "flexible" ? "Flexible" : "Not stated")],
    ["Budget (volunteered)", c.budget_text || "Not mentioned"],
    ["Decision-maker", DECISION[c.decision_maker]],
    ["Asked about pricing", c.pricing_asked ? "Yes (approved response given)" : "No"],
    ["Duration", c.duration_sec ? formatDuration(c.duration_sec) : "—"],
    ["Cost", `${formatInr((c.voice_cost_inr ?? 0) + (c.ai_cost_inr ?? 0))}${c.cost_estimated ? " (estimated)" : " (reported)"}`],
  ];

  return (
    <div className="space-y-5">
      <Link href="/calls" className="text-sm text-ink-2 hover:underline">
        ← All call records
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{c.caller_name || "Unnamed caller"}</h1>
          <p className="mt-1 text-sm text-ink-2">
            {formatWhen(c.created_at)} IST{c.reference ? ` · Case transcript ${c.reference}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <OutcomeBadge outcome={c.outcome} />
          {c.escalation_required && <EscalationBadge />}
          <SourceBadge source={c.source} />
        </div>
      </div>

      {c.source !== "vaani" && (
        <div className="rounded-lg bg-demo px-4 py-2.5 text-sm text-demo-ink">
          {c.source === "demo_seed"
            ? "Demo seed record: a case transcript replayed through the AI rules. This was not an AI-handled phone call."
            : "Simulated demo call created from the in-app form. This was not a real phone call."}
        </div>
      )}

      <Card title="Summary">
        <p className="text-sm">{c.summary}</p>
        {c.escalation_reason && (
          <p className="mt-2 text-sm">
            <span className="font-semibold">{c.escalation_required ? "Escalation reason" : "Review reason"}:</span> {c.escalation_reason}
          </p>
        )}
        {c.follow_up_question && (
          <p className="mt-2 text-sm">
            <span className="font-semibold">Follow-up question to ask:</span> “{c.follow_up_question}”
          </p>
        )}
        {c.handoff_note && <p className="mt-2 text-sm text-ink-2">{c.handoff_note}</p>}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Caller & project details">
          <dl className="grid grid-cols-[minmax(0,10rem)_1fr] gap-x-4 gap-y-2 text-sm">
            {fields.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-ink-2">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card title="Qualification criteria" subtitle="The five criteria from qualified.md">
          <ul className="space-y-3">
            {c.criteria.map((cr) => (
              <li key={cr.key} className="text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{cr.label}</span>
                  <span className={`text-xs font-semibold ${STATUS_STYLE[cr.status].cls}`}>{STATUS_STYLE[cr.status].label}</span>
                </div>
                <p className="text-ink-2">{cr.reason}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="What the receptionist says" subtitle="Generated reply, checked by the pricing guard so it never contains a figure.">
        <blockquote className="border-l-2 border-brand pl-3 text-sm italic">{c.agent_response}</blockquote>
      </Card>

      <Card title="Human handoff" action={<HandoffBadge status={c.handoff_status} />}>
        {!needsHandoff ? (
          <p className="text-sm text-ink-2">No handoff needed for this outcome.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-ink-2">
              {c.handoff_detail}
              {c.handoff_at ? ` (${formatWhen(c.handoff_at)} IST)` : ""}
            </p>
            {c.handoff_message && <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-xs">{c.handoff_message}</pre>}
            {c.handoff_status !== "sent" && <RetryHandoffButton id={c.id} />}
          </div>
        )}
      </Card>

      {c.transcript && (
        <Card title={c.source === "demo_seed" ? "Transcript summary (from case data)" : "Notes / transcript"}>
          <p className="whitespace-pre-wrap text-sm text-ink-2">{c.transcript}</p>
        </Card>
      )}
    </div>
  );
}
