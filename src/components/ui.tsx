import type { ReactNode } from "react";
import { OUTCOME_LABELS } from "@/lib/metrics";
import type { CallSource, HandoffStatus, Outcome } from "@/lib/types";

export function Card({ title, subtitle, children, className = "", action }: { title?: string; subtitle?: ReactNode; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={`min-w-0 rounded-xl border border-line bg-surface p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatTile({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "critical" | "good" }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="text-xs font-medium text-ink-2">{label}</div>
      <div className={`mt-1 text-3xl font-semibold ${tone === "critical" ? "text-critical" : tone === "good" ? "text-good" : "text-ink"}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

/** Outcome colours follow fixed categorical slots (see OUTCOME_ORDER). Always shown with a text label. */
export const OUTCOME_COLOR: Record<Outcome, string> = {
  qualified: "var(--series-1)",
  needs_follow_up: "var(--series-2)",
  needs_human_review: "var(--series-3)",
  unqualified: "var(--series-4)",
};

const OUTCOME_ICON: Record<Outcome, string> = { qualified: "✓", needs_follow_up: "?", needs_human_review: "!", unqualified: "×" };

export function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink">
      <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: OUTCOME_COLOR[outcome] }} aria-hidden>
        {OUTCOME_ICON[outcome]}
      </span>
      {OUTCOME_LABELS[outcome]}
    </span>
  );
}

export function EscalationBadge() {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold text-white" style={{ background: "var(--critical)" }}>
      ⚠ Escalation
    </span>
  );
}

export function SourceBadge({ source }: { source: CallSource }) {
  if (source === "vaani")
    return <span className="whitespace-nowrap rounded-full border border-line px-2 py-0.5 text-xs font-medium text-good">● Vaani voice call</span>;
  return (
    <span className="whitespace-nowrap rounded-full bg-demo px-2 py-0.5 text-xs font-medium text-demo-ink">
      {source === "simulated" ? "Simulated · demo" : "Demo seed"}
    </span>
  );
}

export function HandoffBadge({ status }: { status: HandoffStatus }) {
  const map: Record<HandoffStatus, { label: string; cls: string }> = {
    sent: { label: "✓ Sent to Telegram", cls: "text-good" },
    failed: { label: "✕ Send failed", cls: "text-critical" },
    demo_not_configured: { label: "Demo: not sent", cls: "text-demo-ink bg-demo" },
    not_required: { label: "Not required", cls: "text-muted" },
  };
  const m = map[status];
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${m.cls}`}>{m.label}</span>;
}
