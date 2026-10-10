// Normalises a post-call webhook from the Vaani Voice agent into a CallInput.
// Vaani's exact payload schema is not confirmed, so this mapper is deliberately tolerant:
// it looks for our own field names first, then common alternatives, at the top level
// or nested under data / extracted_data / collected_data / analysis / variables.
import { createHmac, timingSafeEqual } from "crypto";
import type { CallInput, DecisionMaker, ProjectType, TimelineKind } from "./types";

type Json = Record<string, unknown>;

function flatten(body: Json): Json {
  const out: Json = {};
  const nestedKeys = ["data", "call", "extracted_data", "collected_data", "analysis", "variables", "custom_data", "post_call_analysis"];
  for (const k of nestedKeys) {
    const v = body[k];
    if (v && typeof v === "object" && !Array.isArray(v)) Object.assign(out, flatten(v as Json));
  }
  for (const [k, v] of Object.entries(body)) if (!nestedKeys.includes(k)) out[k] = v;
  return out;
}

function pick(f: Json, ...keys: string[]): unknown {
  for (const k of keys) if (f[k] != null && f[k] !== "") return f[k];
  return undefined;
}
const str = (v: unknown) => (v == null ? null : typeof v === "string" ? v : JSON.stringify(v));
const numOrNull = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : null;
};
const truthy = (v: unknown) => v === true || /^(true|yes|y|1)$/i.test(String(v ?? ""));

export function mapProjectType(v: unknown): ProjectType {
  const t = String(v ?? "").toLowerCase();
  if (!t) return "unknown";
  const direct = t.replace(/[\s-]+/g, "_");
  const known: ProjectType[] = ["residential_full", "residential_partial", "residential_single_room", "commercial_office", "commercial_clinic", "commercial_studio", "structural", "decor_only", "advice_only", "furniture_only", "vastu_only", "restaurant", "hotel", "retail", "gym", "other", "unknown"];
  if (known.includes(direct as ProjectType)) return direct as ProjectType;
  if (/restaurant|cafe|caf[eé]/.test(t)) return "restaurant";
  if (/hotel|resort|hospitality/.test(t)) return "hotel";
  if (/retail|shop|store|showroom/.test(t)) return "retail";
  if (/gym|fitness/.test(t)) return "gym";
  if (/structur|wall|architect/.test(t)) return "structural";
  if (/vastu/.test(t)) return "vastu_only";
  if (/advice|ideas|suggestion|consult(ation)? only/.test(t)) return "advice_only";
  if (/decor|styling/.test(t)) return "decor_only";
  if (/furniture only|just furniture/.test(t)) return "furniture_only";
  if (/clinic/.test(t)) return "commercial_clinic";
  if (/studio/.test(t)) return "commercial_studio";
  if (/office|commercial|workspace/.test(t)) return "commercial_office";
  if (/single room|one room|bedroom|living room/.test(t)) return "residential_single_room";
  if (/partial|rooms|kitchen/.test(t)) return "residential_partial";
  if (/full|home|flat|apartment|bhk|villa|house|residential/.test(t)) return "residential_full";
  return "other";
}

function mapDecision(v: unknown): DecisionMaker {
  const t = String(v ?? "").toLowerCase();
  if (!t) return "unknown";
  if (/research|just checking|not (the )?decision/.test(t)) return "researching_only";
  if (/authori[sz]ed|on behalf|represent/.test(t)) return "authorised_representative";
  if (/^(yes|true|y|owner|self)/.test(t)) return "yes";
  return "unknown";
}

function mapTimeline(f: Json): { timeline_kind: TimelineKind; deadline_weeks: number | null; timeline_text: string | null } {
  const weeks = numOrNull(pick(f, "deadline_weeks", "weeks_until_deadline", "timeline_weeks"));
  const text = str(pick(f, "timeline_text", "timeline", "completion_timeline", "deadline"));
  if (weeks != null) return { timeline_kind: "deadline", deadline_weeks: weeks, timeline_text: text };
  if (text && /flexib|no rush|no hurry|anytime|not urgent/i.test(text)) return { timeline_kind: "flexible", deadline_weeks: null, timeline_text: text };
  const kind = String(pick(f, "timeline_kind") ?? "");
  if (kind === "flexible" || kind === "deadline") return { timeline_kind: kind, deadline_weeks: null, timeline_text: text };
  // Free-text timeline without a number of weeks: keep it, but treat as unclear so a human/follow-up confirms.
  return { timeline_kind: "unknown", deadline_weeks: null, timeline_text: text };
}

export interface NormalisedVaaniCall {
  input: CallInput;
  transcript: string | null;
  reportedCosts: { voice_cost_inr: number | null; ai_cost_inr: number | null } | null;
  externalId: string | null;
}

export function normaliseVaaniPayload(body: Json): NormalisedVaaniCall {
  const f = flatten(body);
  const callerType = String(pick(f, "caller_type", "customer_type") ?? "").toLowerCase();
  const durationRaw = numOrNull(pick(f, "duration_sec", "duration_seconds", "call_duration", "duration"));
  const durationMs = numOrNull(pick(f, "duration_ms"));
  const voiceCost = numOrNull(pick(f, "voice_cost_inr", "call_cost", "cost_inr", "cost"));
  const aiCost = numOrNull(pick(f, "ai_cost_inr", "llm_cost"));
  const transcriptRaw = pick(f, "transcript", "transcription", "conversation");
  return {
    input: {
      caller_name: str(pick(f, "caller_name", "name", "customer_name")),
      caller_phone: str(pick(f, "caller_phone", "phone", "from", "from_number", "caller_number", "customer_number")),
      caller_type: /existing|client/.test(callerType) || truthy(pick(f, "is_existing_client")) ? "existing_client" : "new_enquiry",
      project_type: mapProjectType(pick(f, "project_type", "project", "requirement")),
      area_sqft: numOrNull(pick(f, "area_sqft", "carpet_area", "area", "sqft")),
      location: str(pick(f, "location", "site_location", "area_name", "locality", "city")),
      ...mapTimeline(f),
      budget_text: str(pick(f, "budget_text", "budget")),
      decision_maker: mapDecision(pick(f, "decision_maker", "is_decision_maker", "authority")),
      pricing_asked: truthy(pick(f, "pricing_asked", "asked_pricing")),
      urgent_human_request: truthy(pick(f, "urgent_human_request", "escalate", "needs_human", "urgent")),
      notes: str(pick(f, "notes", "summary", "call_summary", "complaint")),
      duration_sec: durationRaw ?? (durationMs != null ? Math.round(durationMs / 1000) : null),
    },
    transcript: str(transcriptRaw),
    reportedCosts: voiceCost != null || aiCost != null ? { voice_cost_inr: voiceCost, ai_cost_inr: aiCost } : null,
    externalId: str(pick(f, "call_id", "id", "conversation_id")),
  };
}

/**
 * Accepts either a shared secret (header `x-webhook-secret`, `Authorization: Bearer`, or `?secret=`)
 * or an HMAC-SHA256 signature of the raw body (`x-signature` / `x-vaaniyantra-signature`, "sha256=<hex>").
 */
export function verifyVaaniRequest(secret: string, rawBody: string, headers: Headers, url: URL): boolean {
  if (!secret) return false;
  const safeEq = (a: string, b: string) => {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    return ab.length === bb.length && timingSafeEqual(ab, bb);
  };
  const provided = headers.get("x-webhook-secret") || headers.get("authorization")?.replace(/^Bearer\s+/i, "") || url.searchParams.get("secret");
  if (provided && safeEq(provided, secret)) return true;
  const sig = headers.get("x-vaaniyantra-signature") || headers.get("x-signature") || headers.get("x-vaani-signature");
  if (sig) {
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    return safeEq(sig.replace(/^sha256=/, ""), expected);
  }
  return false;
}
