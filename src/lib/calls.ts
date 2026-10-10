// Call processing service: qualify → store → hand off → record the true handoff outcome.
import "server-only";
import { z } from "zod";
import { estimateCosts } from "./config";
import { needsHandoff, performHandoff } from "./handoff";
import { needsCrmSync, syncToHubSpot, type CrmResult } from "./hubspot";
import { qualify } from "./qualify";
import { getStore } from "./store";
import type { CallInput, CallRecord, CallSource } from "./types";

const optionalText = z.string().trim().max(2000).nullish().transform((v) => (v ? v : null));
const optionalNum = z.coerce.number().nonnegative().nullish().transform((v) => (v == null || Number.isNaN(v) ? null : v));

export const CallInputSchema = z.object({
  caller_name: optionalText,
  caller_phone: optionalText,
  caller_type: z.enum(["new_enquiry", "existing_client"]),
  project_type: z.enum([
    "residential_full", "residential_partial", "residential_single_room", "commercial_office", "commercial_clinic",
    "commercial_studio", "structural", "decor_only", "advice_only", "furniture_only", "vastu_only", "restaurant",
    "hotel", "retail", "gym", "other", "unknown",
  ]),
  area_sqft: optionalNum,
  location: optionalText,
  timeline_kind: z.enum(["flexible", "deadline", "unknown"]),
  deadline_weeks: optionalNum,
  timeline_text: optionalText,
  budget_text: optionalText,
  decision_maker: z.enum(["yes", "authorised_representative", "researching_only", "unknown"]),
  pricing_asked: z.boolean().optional().default(false),
  urgent_human_request: z.boolean().optional().default(false),
  notes: optionalText,
  duration_sec: optionalNum,
});

export interface CreateCallOptions {
  source: CallSource;
  transcript?: string | null;
  /** Provider-reported costs (e.g. from Vaani). When absent, costs are estimated from configured rates. */
  reportedCosts?: { voice_cost_inr: number | null; ai_cost_inr: number | null } | null;
  createdAt?: string;
}

export async function createCall(input: CallInput, opts: CreateCallOptions): Promise<CallRecord> {
  const result = qualify(input);
  const costs = opts.reportedCosts ?? estimateCosts(input.duration_sec);
  const rec: CallRecord = {
    ...input,
    ...result,
    id: crypto.randomUUID(),
    created_at: opts.createdAt ?? new Date().toISOString(),
    source: opts.source,
    is_demo: opts.source !== "vaani",
    reference: null,
    transcript: opts.transcript ?? null,
    voice_cost_inr: costs.voice_cost_inr,
    ai_cost_inr: costs.ai_cost_inr,
    cost_estimated: !opts.reportedCosts,
    handoff_status: "not_required",
    handoff_detail: null,
    handoff_message: null,
    handoff_at: null,
  };
  const store = getStore();
  await store.insert(rec);
  if (needsHandoff(rec)) {
    const handoff = await performHandoff(rec);
    Object.assign(rec, handoff);
    await store.update(rec.id, handoff);
  }
  if (needsCrmSync(rec)) Object.assign(rec, await saveCrm(rec.id, await syncToHubSpot(rec)));
  return rec;
}

/** Persists the CRM result. If the CRM columns don't exist yet (migration not run), say so instead of failing the call. */
async function saveCrm(id: string, crm: CrmResult): Promise<CrmResult> {
  try {
    await getStore().update(id, crm);
    return crm;
  } catch (e) {
    return { ...crm, crm_detail: `${crm.crm_detail} (Status not saved: ${(e as Error).message}. Run supabase/migrations/002_hubspot.sql.)` };
  }
}

/** Logs (or re-logs) an existing call to HubSpot. */
export async function retryCrmSync(id: string): Promise<CallRecord> {
  const rec = await getStore().get(id);
  if (!rec) throw new Error("Call not found");
  if (!needsCrmSync(rec)) throw new Error("Only qualified leads and human-review calls (not demo seed data) are logged to HubSpot.");
  return { ...rec, ...(await saveCrm(id, await syncToHubSpot(rec))) };
}

/** Re-attempts the Telegram handoff for an existing record (e.g. after credentials are added). */
export async function retryHandoff(id: string): Promise<CallRecord> {
  const store = getStore();
  const rec = await store.get(id);
  if (!rec) throw new Error("Call not found");
  if (!needsHandoff(rec)) throw new Error("This call does not need a handoff.");
  const handoff = await performHandoff(rec);
  await store.update(id, handoff);
  return { ...rec, ...handoff };
}
