// CRM logging to HubSpot via a private-app access token.
// A record is only marked "synced" after HubSpot confirms both the contact and the note.
import "server-only";
import { PROJECT_TYPE_LABELS } from "./policy";
import type { CallRecord, CrmStatus } from "./types";

const API = "https://api.hubapi.com";

export const hubspotEnabled = () => Boolean(process.env.HUBSPOT_ACCESS_TOKEN);

async function hs<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`, "Content-Type": "application/json", ...init?.headers },
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) throw new Error(`HubSpot ${res.status}: ${body.message ?? "request failed"}`);
  return body;
}

let portalId: number | null = null;
/** Verifies the token and returns the HubSpot account (portal) id, used for record links. */
export async function getPortalId(): Promise<number> {
  if (portalId == null) portalId = (await hs<{ portalId: number }>("/account-info/v3/details")).portalId;
  return portalId;
}

export function needsCrmSync(rec: Pick<CallRecord, "outcome" | "source">): boolean {
  return rec.source !== "demo_seed" && (rec.outcome === "qualified" || rec.outcome === "needs_human_review");
}

function splitName(name: string | null | undefined) {
  const parts = (name ?? "").replace(/\(demo\)/i, "").trim().split(/\s+/).filter(Boolean);
  return { firstname: parts[0] ?? "Unknown caller", lastname: parts.slice(1).join(" ") };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function noteBody(rec: CallRecord): string {
  const heading = `${rec.escalation_required ? "URGENT ESCALATION" : rec.outcome === "qualified" ? "Qualified lead" : "Human review needed"} (Aangan AI Receptionist)`;
  const lines = [
    rec.source === "vaani" ? "Source: Vaani AI voice call" : "⚠️ SIMULATED DEMO CALL (not a real phone call)",
    `Project: ${PROJECT_TYPE_LABELS[rec.project_type]}${rec.area_sqft ? `, ${rec.area_sqft} sq ft` : ""}`,
    `Location: ${rec.location || "Not stated"}`,
    `Timeline: ${rec.timeline_text || rec.timeline_kind}`,
    `Budget (volunteered): ${rec.budget_text || "Not mentioned"}`,
    rec.escalation_reason ? `Reason: ${rec.escalation_reason}` : null,
    rec.handoff_note ? `Note: ${rec.handoff_note}` : null,
    `Summary: ${rec.summary}`,
    rec.notes ? `Call notes: ${rec.notes.slice(0, 1500)}` : null,
    `Criteria: ${rec.criteria.map((c) => `${c.label}: ${c.status.toUpperCase()}`).join("; ")}`,
  ];
  return [`<strong>${esc(heading)}</strong>`, ...lines.filter((l): l is string => Boolean(l)).map(esc)].join("<br>");
}

export interface CrmResult {
  crm_status: CrmStatus;
  crm_detail: string;
  crm_contact_id: string | null;
}

export async function syncToHubSpot(rec: CallRecord): Promise<CrmResult> {
  if (!hubspotEnabled()) return { crm_status: "not_configured", crm_detail: "HubSpot is not configured (HUBSPOT_ACCESS_TOKEN missing). Not logged to CRM.", crm_contact_id: null };
  try {
    // De-duplicate on phone when we have one; otherwise create a new contact.
    let contactId: string | null = null;
    if (rec.caller_phone) {
      const found = await hs<{ results: { id: string }[] }>("/crm/v3/objects/contacts/search", {
        method: "POST",
        body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: "phone", operator: "EQ", value: rec.caller_phone }] }], limit: 1 }),
      });
      contactId = found.results[0]?.id ?? null;
    }
    if (!contactId) {
      const created = await hs<{ id: string }>("/crm/v3/objects/contacts", {
        method: "POST",
        body: JSON.stringify({
          properties: {
            ...splitName(rec.caller_name),
            ...(rec.caller_phone ? { phone: rec.caller_phone } : {}),
            ...(rec.location ? { city: rec.location } : {}),
            lifecyclestage: rec.caller_type === "existing_client" ? "customer" : "lead",
          },
        }),
      });
      contactId = created.id;
    }
    await hs("/crm/v3/objects/notes", {
      method: "POST",
      body: JSON.stringify({
        properties: { hs_timestamp: rec.created_at, hs_note_body: noteBody(rec) },
        associations: [{ to: { id: contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 }] }],
      }),
    });
    return { crm_status: "synced", crm_detail: "Contact and call note saved in HubSpot (confirmed by HubSpot API).", crm_contact_id: contactId };
  } catch (e) {
    return { crm_status: "failed", crm_detail: (e as Error).message, crm_contact_id: null };
  }
}
