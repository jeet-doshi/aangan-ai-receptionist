// Human handoff via Telegram Bot API. Status is only "sent" when Telegram confirms delivery.
import "server-only";
import { config } from "./config";
import { PROJECT_TYPE_LABELS } from "./policy";
import type { CallRecord, HandoffStatus } from "./types";

const OUTCOME_HEADINGS: Record<string, string> = {
  qualified: "🟢 QUALIFIED LEAD",
  needs_human_review: "🟠 HUMAN REVIEW NEEDED",
};

const DECISION_LABELS: Record<string, string> = {
  yes: "Yes (caller decides)",
  authorised_representative: "Authorised representative",
  researching_only: "Researching only",
  unknown: "Not confirmed",
};

export function needsHandoff(rec: Pick<CallRecord, "outcome">): boolean {
  return rec.outcome === "qualified" || rec.outcome === "needs_human_review";
}

/** Plain-text note so the designer never has to re-ask what the receptionist already asked. */
export function buildHandoffMessage(rec: CallRecord): string {
  const heading = rec.escalation_required ? "🔴 URGENT ESCALATION" : OUTCOME_HEADINGS[rec.outcome] ?? rec.outcome;
  const sourceLine =
    rec.source === "vaani"
      ? `Source: Vaani AI voice call${rec.caller_phone ? "" : " (no phone number received; e.g. a browser test call)"}`
      : rec.source === "simulated"
        ? "⚠️ SIMULATED DEMO CALL (not a real phone call)"
        : "⚠️ DEMO SEED DATA (not a real phone call)";
  const lines = [
    `${heading}: Aangan AI Receptionist`,
    sourceLine,
    "",
    `Caller: ${rec.caller_name || "Name not given"}${rec.caller_phone ? ` · ${rec.caller_phone}` : ""}`,
    `Caller type: ${rec.caller_type === "existing_client" ? "EXISTING CLIENT" : "New enquiry"}`,
    `Project: ${PROJECT_TYPE_LABELS[rec.project_type]}${rec.area_sqft ? `, ${rec.area_sqft.toLocaleString("en-IN")} sq ft` : ""}`,
    `Location: ${rec.location || "Not stated"}`,
    `Timeline: ${rec.timeline_text || (rec.timeline_kind === "deadline" && rec.deadline_weeks != null ? `${rec.deadline_weeks} weeks` : rec.timeline_kind)}`,
    `Budget (volunteered): ${rec.budget_text || "Not mentioned"}`,
    `Decision-maker: ${DECISION_LABELS[rec.decision_maker]}`,
    rec.pricing_asked ? "Pricing: caller asked. Given the approved response, no figures quoted." : null,
    "",
    `Outcome: ${rec.outcome.replace(/_/g, " ")}`,
    rec.escalation_reason ? `Reason: ${rec.escalation_reason}` : null,
    rec.handoff_note ? `Note: ${rec.handoff_note}` : null,
    // For simulated calls the notes are what the caller said; for Vaani calls, its summary + any inferred-field caveat.
    rec.notes ? `\nCall notes:\n${rec.notes.length > 900 ? `${rec.notes.slice(0, 900)}…` : rec.notes}` : null,
    "",
    "Criteria:",
    ...rec.criteria.map((c) => `• ${c.label}: ${c.status.toUpperCase()}. ${c.reason}`),
    config.appBaseUrl ? `\nRecord: ${config.appBaseUrl}/calls/${rec.id}` : null,
  ];
  return lines.filter((l) => l !== null).join("\n");
}

export interface HandoffResult {
  handoff_status: HandoffStatus;
  handoff_detail: string;
  handoff_message: string;
  handoff_at: string | null;
}

export async function sendTelegram(chatId: string, text: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000), disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    if (res.ok && body.ok) return { ok: true };
    return { ok: false, error: `Telegram API error ${res.status}: ${body.description ?? "unknown error"}` };
  } catch (e) {
    return { ok: false, error: `Could not reach Telegram: ${(e as Error).message}` };
  }
}

export async function performHandoff(rec: CallRecord): Promise<HandoffResult> {
  const message = buildHandoffMessage(rec);
  if (!config.telegram.enabled) {
    return {
      handoff_status: "demo_not_configured",
      handoff_detail: "Telegram is not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID missing). Message prepared but NOT sent.",
      handoff_message: message,
      handoff_at: null,
    };
  }
  const chatId = rec.escalation_required && config.telegram.escalationChatId ? config.telegram.escalationChatId : config.telegram.chatId;
  const sent = await sendTelegram(chatId, message);
  return sent.ok
    ? { handoff_status: "sent", handoff_detail: "Delivered to Telegram (confirmed by Telegram API).", handoff_message: message, handoff_at: new Date().toISOString() }
    : { handoff_status: "failed", handoff_detail: sent.error, handoff_message: message, handoff_at: null };
}
