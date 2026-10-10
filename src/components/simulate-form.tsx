"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PROJECT_TYPE_LABELS } from "@/lib/policy";
import type { CallRecord, ProjectType } from "@/lib/types";
import { EscalationBadge, HandoffBadge, OutcomeBadge } from "./ui";

interface FormState {
  caller_name: string;
  caller_phone: string;
  caller_type: "new_enquiry" | "existing_client";
  project_type: ProjectType;
  area_sqft: string;
  location: string;
  timeline_kind: "flexible" | "deadline" | "unknown";
  deadline_weeks: string;
  timeline_text: string;
  budget_text: string;
  decision_maker: "yes" | "authorised_representative" | "researching_only" | "unknown";
  pricing_asked: boolean;
  urgent_human_request: boolean;
  notes: string;
  duration_sec: string;
}

const EMPTY: FormState = {
  caller_name: "",
  caller_phone: "",
  caller_type: "new_enquiry",
  project_type: "unknown",
  area_sqft: "",
  location: "",
  timeline_kind: "unknown",
  deadline_weeks: "",
  timeline_text: "",
  budget_text: "",
  decision_maker: "unknown",
  pricing_asked: false,
  urgent_human_request: false,
  notes: "",
  duration_sec: "240",
};

// Fictional callers; phone numbers are obviously fake demo values.
const PRESETS: { key: string; label: string; tone: string; data: Partial<FormState> }[] = [
  {
    key: "qualified",
    label: "Qualified lead",
    tone: "Full-home project in Baner, asks about price",
    data: { caller_name: "Neha Kulkarni (demo)", caller_phone: "+91 90000 00001", project_type: "residential_full", area_sqft: "1200", location: "Baner", timeline_kind: "flexible", timeline_text: "Move in by April, flexible", decision_maker: "yes", pricing_asked: true, notes: "3BHK, builder flat. Wants kitchen, wardrobes, living and both bedrooms. Asked how much per sq ft.", duration_sec: "312" },
  },
  {
    key: "escalation",
    label: "Urgent escalation",
    tone: "Existing client: leak + unresponsive designer",
    data: { caller_name: "Rahul Joshi (demo)", caller_phone: "+91 90000 00002", caller_type: "existing_client", project_type: "residential_full", location: "Kothrud", decision_maker: "yes", urgent_human_request: true, notes: "Water is leaking from the new kitchen sink fitting and my designer hasn't replied in 3 days. I need to speak to someone senior today.", duration_sec: "275" },
  },
  {
    key: "followup",
    label: "Needs follow-up",
    tone: "Timeline not given",
    data: { caller_name: "Kavya Iyer (demo)", caller_phone: "+91 90000 00003", project_type: "residential_partial", area_sqft: "950", location: "Aundh", timeline_kind: "unknown", decision_maker: "yes", notes: "Living room and kitchen redesign with execution.", duration_sec: "190" },
  },
  {
    key: "conflict",
    label: "Timeline conflict",
    tone: "Needs it in 8 weeks: policy docs disagree",
    data: { caller_name: "Arjun Mehta (demo)", caller_phone: "+91 90000 00004", project_type: "residential_full", area_sqft: "900", location: "Wakad", timeline_kind: "deadline", deadline_weeks: "8", timeline_text: "Must be done in 8 weeks (family wedding)", decision_maker: "yes", duration_sec: "260" },
  },
  {
    key: "outside",
    label: "Out of area",
    tone: "Talegaon: single fail, polite decline",
    data: { caller_name: "Nilesh D. (demo)", caller_phone: "+91 90000 00005", project_type: "residential_full", area_sqft: "1400", location: "Talegaon Dabhade", timeline_kind: "flexible", timeline_text: "3–4 months, flexible", budget_text: "15-20 lakh", decision_maker: "yes", duration_sec: "150" },
  },
  {
    key: "multi",
    label: "Two criteria fail",
    tone: "Restaurant in 3 weeks",
    data: { caller_name: "Demo caller", caller_phone: "+91 90000 00006", project_type: "restaurant", area_sqft: "1800", location: "Koregaon Park", timeline_kind: "deadline", deadline_weeks: "3", timeline_text: "Opening in 3 weeks", decision_maker: "yes", duration_sec: "140" },
  },
];

const input = "w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm text-ink";

export function SimulateForm() {
  const router = useRouter();
  const [f, setF] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CallRecord | null>(null);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    const payload = {
      ...f,
      area_sqft: f.area_sqft || null,
      deadline_weeks: f.timeline_kind === "deadline" ? f.deadline_weeks || null : null,
      duration_sec: f.duration_sec || null,
    };
    try {
      const res = await fetch("/api/calls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save call");
      setResult(body as CallRecord);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <form onSubmit={submit} className="space-y-5 rounded-xl border border-line bg-surface p-5 lg:col-span-3">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">One-click scenarios</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PRESETS.map((p) => (
              <button
                type="button"
                key={p.key}
                onClick={() => {
                  setF({ ...EMPTY, ...p.data });
                  setResult(null);
                }}
                className="rounded-lg border border-line p-2.5 text-left hover:bg-surface-2"
              >
                <div className="text-sm font-medium">{p.label}</div>
                <div className="text-xs text-muted">{p.tone}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Caller name">
            <input className={input} value={f.caller_name} onChange={(e) => set("caller_name", e.target.value)} />
          </Field>
          <Field label="Phone">
            <input className={input} value={f.caller_phone} onChange={(e) => set("caller_phone", e.target.value)} />
          </Field>
          <Field label="Caller type">
            <select className={input} value={f.caller_type} onChange={(e) => set("caller_type", e.target.value as FormState["caller_type"])}>
              <option value="new_enquiry">New enquiry</option>
              <option value="existing_client">Existing client</option>
            </select>
          </Field>
          <Field label="Project type">
            <select className={input} value={f.project_type} onChange={(e) => set("project_type", e.target.value as ProjectType)}>
              {Object.entries(PROJECT_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Carpet area (sq ft)">
            <input className={input} inputMode="numeric" value={f.area_sqft} onChange={(e) => set("area_sqft", e.target.value.replace(/[^\d]/g, ""))} />
          </Field>
          <Field label="Site location">
            <input className={input} placeholder="e.g. Baner, Pune" value={f.location} onChange={(e) => set("location", e.target.value)} />
          </Field>
          <Field label="Timeline">
            <select className={input} value={f.timeline_kind} onChange={(e) => set("timeline_kind", e.target.value as FormState["timeline_kind"])}>
              <option value="unknown">Not stated</option>
              <option value="flexible">Flexible / no hard deadline</option>
              <option value="deadline">Hard deadline</option>
            </select>
          </Field>
          {f.timeline_kind === "deadline" ? (
            <Field label="Needs completion in (weeks)">
              <input className={input} inputMode="numeric" value={f.deadline_weeks} onChange={(e) => set("deadline_weeks", e.target.value.replace(/[^\d.]/g, ""))} />
            </Field>
          ) : (
            <div />
          )}
          <Field label="Timeline in caller's words">
            <input className={input} value={f.timeline_text} onChange={(e) => set("timeline_text", e.target.value)} />
          </Field>
          <Field label="Budget, only if volunteered">
            <input className={input} placeholder="Leave blank if not mentioned" value={f.budget_text} onChange={(e) => set("budget_text", e.target.value)} />
          </Field>
          <Field label="Decision-maker">
            <select className={input} value={f.decision_maker} onChange={(e) => set("decision_maker", e.target.value as FormState["decision_maker"])}>
              <option value="unknown">Not confirmed</option>
              <option value="yes">Yes, caller decides</option>
              <option value="authorised_representative">Authorised representative</option>
              <option value="researching_only">Only researching for someone else</option>
            </select>
          </Field>
          <Field label="Call duration (seconds)">
            <input className={input} inputMode="numeric" value={f.duration_sec} onChange={(e) => set("duration_sec", e.target.value.replace(/[^\d]/g, ""))} />
          </Field>
        </div>

        <div className="flex flex-wrap gap-5 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={f.pricing_asked} onChange={(e) => set("pricing_asked", e.target.checked)} /> Caller asked about pricing
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={f.urgent_human_request} onChange={(e) => set("urgent_human_request", e.target.checked)} /> Caller wants a human urgently
          </label>
        </div>

        <Field label="What the caller said (notes; scanned for complaints and urgency)">
          <textarea className={`${input} min-h-20`} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>

        <div className="flex items-center gap-3">
          <button disabled={busy} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-ink disabled:opacity-60">
            {busy ? "Processing…" : "Run simulated call"}
          </button>
          <button type="button" onClick={() => setF(EMPTY)} className="text-sm text-ink-2 hover:underline">
            Clear
          </button>
          <span className="text-xs text-muted">Saved as a simulated demo call, never as a real phone call.</span>
        </div>
        {error && <p className="text-sm text-critical">{error}</p>}
      </form>

      <div className="lg:col-span-2">
        {result ? (
          <div className="space-y-4 rounded-xl border border-line bg-surface p-5">
            <div className="flex flex-wrap items-center gap-2">
              <OutcomeBadge outcome={result.outcome} />
              {result.escalation_required && <EscalationBadge />}
              <HandoffBadge status={result.handoff_status} />
            </div>
            <p className="text-sm">{result.summary}</p>
            {result.escalation_reason && (
              <p className="text-sm">
                <span className="font-semibold">Reason:</span> {result.escalation_reason}
              </p>
            )}
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Receptionist reply</div>
              <blockquote className="border-l-2 border-brand pl-3 text-sm italic">{result.agent_response}</blockquote>
            </div>
            {result.handoff_status !== "not_required" && (
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Handoff</div>
                <p className="text-sm text-ink-2">{result.handoff_detail}</p>
              </div>
            )}
            <Link href={`/calls/${result.id}`} className="inline-block text-sm font-medium text-brand hover:underline">
              Open full record →
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-line p-5 text-sm text-ink-2">
            Pick a scenario or fill in the form, then run it. The result appears here: outcome, the receptionist&apos;s reply, and whether the team was actually notified.
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-2">{label}</span>
      {children}
    </label>
  );
}
