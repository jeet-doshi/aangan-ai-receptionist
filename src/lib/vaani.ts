// Normalises a post-call webhook from the Vaani Voice agent into a CallInput.
// Vaani's exact payload schema is not confirmed, so this mapper is deliberately tolerant:
// it looks for our own field names first, then common alternatives, at the top level
// or nested under data / extracted_data / collected_data / analysis / variables.
import { createHmac, timingSafeEqual } from "crypto";
import { OUTSIDE_AREA, SERVICE_AREA } from "./policy";
import type { CallInput, DecisionMaker, ProjectType, TimelineKind } from "./types";

type Json = Record<string, unknown>;

function flatten(body: Json): Json {
  const out: Json = {};
  const nestedKeys = ["data", "entities", "call", "extracted_data", "collected_data", "analysis", "variables", "custom_data", "post_call_analysis"];
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
  // Handles numbers and strings like "1,200 sq ft" or "8 weeks".
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/,/g, "").match(/-?\d+(\.\d+)?/)?.[0] ?? "");
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
  // Vaani's call_postprocessing event reports call_duration in MILLISECONDS (call_ended uses seconds).
  const isPostprocessing = body.event === "call_postprocessing";
  const vaaniMs = isPostprocessing ? numOrNull(f.call_duration) : null;
  const durationRaw = vaaniMs != null ? Math.round(vaaniMs / 1000) : numOrNull(pick(f, "duration_sec", "duration_seconds", "call_duration", "duration"));
  // Dispositions (e.g. {"outcome": "existing client complaint"}) are appended to notes so escalation keywords are seen.
  const dispositions = body.data && typeof body.data === "object" ? (body.data as Json).dispositions : undefined;
  const dispositionText = dispositions && typeof dispositions === "object" ? Object.values(dispositions as Json).map(String).join("; ") : "";
  const durationMs = numOrNull(pick(f, "duration_ms"));
  const voiceCost = numOrNull(pick(f, "voice_cost_inr", "call_cost", "cost_inr", "cost"));
  const aiCost = numOrNull(pick(f, "ai_cost_inr", "llm_cost"));
  const transcriptRaw = pick(f, "transcript", "transcription", "conversation");
  const normalised: NormalisedVaaniCall = {
    input: {
      caller_name: str(pick(f, "caller_name", "name", "customer_name")),
      caller_phone: str(pick(f, "caller_phone", "phone", "phone_number", "contact_number", "from", "from_number", "caller_number", "customer_number")),
      caller_type: /existing|client/.test(callerType) || truthy(pick(f, "is_existing_client")) ? "existing_client" : "new_enquiry",
      project_type: mapProjectType(pick(f, "project_type", "project", "requirement")),
      area_sqft: numOrNull(pick(f, "area_sqft", "carpet_area", "area", "sqft")),
      location: str(pick(f, "location", "site_location", "area_name", "locality", "city")),
      ...mapTimeline(f),
      budget_text: str(pick(f, "budget_text", "budget")),
      decision_maker: mapDecision(pick(f, "decision_maker", "is_decision_maker", "authority")),
      pricing_asked: truthy(pick(f, "pricing_asked", "asked_pricing")),
      urgent_human_request: truthy(pick(f, "urgent_human_request", "escalate", "needs_human", "urgent")),
      notes: [str(pick(f, "notes", "complaint")), str(pick(f, "summary", "call_summary")), dispositionText ? `Disposition: ${dispositionText}` : null].filter(Boolean).join("\n") || null,
      duration_sec: durationRaw ?? (durationMs != null ? Math.round(durationMs / 1000) : null),
    },
    transcript: str(transcriptRaw),
    reportedCosts: voiceCost != null || aiCost != null ? { voice_cost_inr: voiceCost, ai_cost_inr: aiCost } : null,
    externalId: str(pick(f, "call_id", "id", "conversation_id")),
  };
  return inferFromConversation(normalised, str(pick(f, "summary", "call_summary")) ?? "");
}

// ---------------------------------------------------------------------------
// Fallback inference from Vaani's summary + the caller's own words
// ---------------------------------------------------------------------------

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** Speech-to-text variants seen in live calls, mapped to the real locality. */
const LOCATION_ALIASES: Record<string, string> = { banner: "Baner" };

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function inferLocation(text: string): string | null {
  const t = ` ${text.toLowerCase()} `;
  for (const [alias, real] of Object.entries(LOCATION_ALIASES)) if (new RegExp(`\\b${alias}\\b`).test(t)) return real;
  const outside = OUTSIDE_AREA.find((a) => new RegExp(`\\b${a}\\b`).test(t));
  if (outside) return titleCase(outside);
  // Specific localities first; the generic "pune"/"pcmc" only as a last resort.
  const specific = SERVICE_AREA.filter((a) => a !== "pune" && a !== "pcmc").find((a) => new RegExp(`\\b${a}\\b`).test(t));
  if (specific) return titleCase(specific);
  return /\bpcmc\b/.test(t) ? "PCMC" : /\bpune\b/.test(t) ? "Pune" : null;
}

export function inferProjectType(text: string): ProjectType {
  const t = text.toLowerCase().replace(/aangan studio/g, "");
  if (/\brestaurant|\bcaf[eé]\b/.test(t)) return "restaurant";
  if (/\bhotel\b/.test(t)) return "hotel";
  if (/\b(retail|shop|showroom)\b/.test(t)) return "retail";
  if (/\b(gym|fitness)\b/.test(t)) return "gym";
  if (/\bvastu\b/.test(t) && /\bonly\b/.test(t)) return "vastu_only";
  if (/\b(just|only) (some )?(ideas|advice|suggestions)\b|\badvice only\b/.test(t)) return "advice_only";
  if (/\bclinic\b/.test(t)) return "commercial_clinic";
  if (/\b(office|workspace|coworking)\b/.test(t)) return "commercial_office";
  if (/\b\d\s*-?\s*bhk\b|\b(full|whole|entire|complete) (home|flat|house|apartment)\b|\bvilla\b|\bbungalow\b/.test(t)) return "residential_full";
  if (/\b(kitchen|bedroom|living room|wardrobe)s?\b/.test(t)) return "residential_partial";
  return "unknown";
}

export function inferTimeline(text: string, now: Date): Pick<CallInput, "timeline_kind" | "deadline_weeks" | "timeline_text"> | null {
  const t = text.toLowerCase();
  if (/\b(no rush|no hurry|not in a hurry|flexible|whenever)\b/.test(t)) return { timeline_kind: "flexible", deadline_weeks: null, timeline_text: "Flexible (inferred)" };
  const m = t.match(new RegExp(`\\b(${MONTHS.join("|")}|${MONTHS.map((x) => x.slice(0, 3)).join("|")})\\b\\.?\\s*(\\d{4})?`));
  if (m) {
    const month = MONTHS.findIndex((x) => x.startsWith(m[1].slice(0, 3)));
    let year = m[2] ? Number(m[2]) : now.getFullYear();
    if (!m[2] && month < now.getMonth()) year += 1;
    const endOfMonth = new Date(year, month + 1, 0);
    const weeks = Math.floor((endOfMonth.getTime() - now.getTime()) / (7 * 86_400_000));
    if (weeks >= 0) return { timeline_kind: "deadline", deadline_weeks: weeks, timeline_text: `By ${titleCase(MONTHS[month])} ${year} (inferred)` };
  }
  const w = t.match(/\b(?:in|within)\s+(\d+)\s*(weeks?|months?)\b/);
  if (w) {
    const n = Number(w[1]) * (w[2].startsWith("month") ? 4 : 1);
    return { timeline_kind: "deadline", deadline_weeks: n, timeline_text: `Within ${w[1]} ${w[2]} (inferred)` };
  }
  return null;
}

/** Call length from the first and last [HH:MM:SS] timestamps in a Vaani transcript. */
export function durationFromTranscript(transcript: string | null): number | null {
  const stamps = [...(transcript ?? "").matchAll(/\[(\d{1,2}):(\d{2}):(\d{2})\]/g)].map((m) => Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]));
  if (stamps.length < 2) return null;
  let d = stamps[stamps.length - 1] - stamps[0];
  if (d < 0) d += 86_400;
  return d > 0 ? d : null;
}

/**
 * Fills fields Vaani did not extract, using its summary plus the caller's own lines (never the agent's,
 * which mention things like "Pune" or pricing on their own). Every inferred field is listed in the notes
 * so a designer knows to double-check it.
 */
export function inferFromConversation(call: NormalisedVaaniCall, summary: string, now = new Date()): NormalisedVaaniCall {
  const userLines = [...(call.transcript ?? "").matchAll(/USER:\s*([^\n]*)/g)].map((m) => m[1]).join(" ");
  const text = `${summary} ${userLines}`;
  const i = { ...call.input };
  const inferred: string[] = [];

  if (i.location) {
    // Correct speech-to-text variants in an extracted location too (e.g. "Banner" -> "Baner").
    const alias = Object.entries(LOCATION_ALIASES).find(([a]) => new RegExp(`\\b${a}\\b`, "i").test(i.location ?? ""));
    if (alias) i.location = alias[1];
  } else {
    const loc = inferLocation(text);
    if (loc) {
      i.location = loc;
      inferred.push("location");
    }
  }
  if (i.project_type === "unknown" || i.project_type === "other") {
    const pt = inferProjectType(text);
    if (pt !== "unknown") {
      i.project_type = pt;
      inferred.push("project type");
    }
  }
  if (i.timeline_kind === "unknown") {
    const tl = inferTimeline(text, now);
    if (tl) {
      Object.assign(i, tl);
      inferred.push("timeline");
    }
  }
  if (i.decision_maker === "unknown") {
    if (/\b(is|am|i'm|as) the (owner|decision[- ]maker)\b|\bconfirmed (she|he|they) (is|are) the owner\b|\bi own\b/i.test(text)) i.decision_maker = "yes";
    else if (/\bauthori[sz]ed\b|\bon behalf of\b/i.test(text)) i.decision_maker = "authorised_representative";
    if (i.decision_maker !== "unknown") inferred.push("decision-maker");
  }
  if (!i.area_sqft) {
    const a = text.match(/(\d[\d,]*)\s*(sq\.?\s*f(?:ee)?t|square f(?:ee|oo)t|sqft)/i);
    if (a) {
      i.area_sqft = Number(a[1].replace(/,/g, ""));
      inferred.push("carpet area");
    }
  }
  if (!i.pricing_asked && /\b(price|pricing|cost|rate|charges?|how much)\b/i.test(userLines)) {
    i.pricing_asked = true;
    inferred.push("pricing question");
  }
  if (!i.duration_sec) {
    const d = durationFromTranscript(call.transcript);
    if (d) i.duration_sec = d;
  }
  if (inferred.length) i.notes = [i.notes, `Inferred from the Vaani summary/transcript (verify): ${inferred.join(", ")}.`].filter(Boolean).join("\n");
  return { ...call, input: i };
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
