// Deterministic qualification engine implementing qualified.md + services.md.
// Pure functions only: no I/O, so it is cheap (₹0 per call) and fully testable.

import {
  APPROVED_PRICING_RESPONSE,
  COMMERCIAL,
  COMMERCIAL_MAX_SQFT,
  COMMERCIAL_MIN_SQFT,
  COMMERCIAL_TOLERANCE_SQFT,
  EXCLUDED_TYPE_RESPONSES,
  INTERNAL_BUDGET_FLOOR,
  MIN_REALISTIC_WEEKS,
  MULTI_FAIL_DECLINE,
  OUTSIDE_AREA,
  PROJECT_TYPE_LABELS,
  RESIDENTIAL,
  SERVICE_AREA,
  TIMELINES,
} from "./policy";
import type { CallInput, CriterionResult, QualificationResult } from "./types";

// ---------------------------------------------------------------------------
// Escalation detection
// ---------------------------------------------------------------------------

const ESCALATION_PATTERNS: { reason: string; patterns: RegExp[] }[] = [
  {
    reason: "Complaint",
    patterns: [/\bcomplain(t|ts|ing)?\b/i, /\b(not acceptable|unacceptable)\b/i, /\brefund\b/i, /\bconsumer court\b/i, /\blegal action\b/i, /\bvery disappointed\b/i],
  },
  {
    reason: "Unresponsive designer / no follow-up",
    patterns: [
      /\b(has ?n[o']t|have ?n[o']t|did ?n[o']t|has not|have not|did not|never) (replied|responded|got back|gotten back|called back|heard back)\b/i,
      /\b(no ?one|nobody) (has )?(replied|responded|got back|called back|followed up)\b/i,
      /\bno (response|reply|follow[- ]?up)\b/i,
      /\bnot (responding|replying|picking up)\b/i,
    ],
  },
  {
    reason: "Urgent request for a human",
    patterns: [
      /\b(speak|talk) to (someone|somebody|a (real )?person|a human|a manager|nikhil|a senior|someone senior)\b/i,
      /\bsenior person\b/i,
      /\bescalate\b/i,
      /\bright now\b.*\b(speak|talk|someone)\b|\b(speak|talk|someone)\b.*\bright now\b/i,
    ],
  },
];

const EXISTING_PROJECT_PATTERNS = [/\bmy designer\b/i, /\b(my|our) (ongoing |current )?project with you\b/i, /\bongoing project\b/i, /\bexisting (client|project)\b/i, /\bmy project has been\b/i];

/** Only meaningful when the caller has an existing project (avoids flagging "broken builder furniture" from a new lead). */
const SERVICE_FAILURE_PATTERNS = [/\bleak(ing|age)?\b/i, /\bwater damage\b/i, /\bdamaged?\b/i, /\bshort circuit\b/i, /\belectrical fault\b/i, /\b(work|site) (has )?(stopped|halted)\b/i, /\bunsafe\b/i, /\bdefect(s|ive)?\b/i, /\bdelay(ed)?\b/i];

export function detectEscalation(input: CallInput): string[] {
  const reasons: string[] = [];
  const notes = input.notes ?? "";
  const existingProject = input.caller_type === "existing_client" || EXISTING_PROJECT_PATTERNS.some((p) => p.test(notes));

  if (input.caller_type === "existing_client") reasons.push("Existing client");
  else if (existingProject) reasons.push("Caller describes an existing project with the studio");
  if (input.urgent_human_request) reasons.push("Caller asked for urgent human help");
  for (const group of ESCALATION_PATTERNS) {
    if (group.patterns.some((p) => p.test(notes))) reasons.push(group.reason);
  }
  if (existingProject && SERVICE_FAILURE_PATTERNS.some((p) => p.test(notes))) reasons.push("Urgent service failure on an existing project");
  return [...new Set(reasons)];
}

// ---------------------------------------------------------------------------
// Budget parsing (internal)
// ---------------------------------------------------------------------------

/** Parses a volunteered budget like "1 to 1.5 lakh", "60-80 lakh", "₹50,000", "1.2 cr". Returns the upper bound in ₹. */
export function parseBudgetInr(text: string | null | undefined): number | null {
  if (!text) return null;
  const t = text.toLowerCase().replace(/,/g, "");
  const numbers = [...t.matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => parseFloat(m[1]));
  if (numbers.length === 0) return null;
  const max = Math.max(...numbers);
  let multiplier = 1;
  if (/\b(crore|cr)\b/.test(t)) multiplier = 10_000_000;
  else if (/\b(lakh|lakhs|lac|lacs|l)\b/.test(t)) multiplier = 100_000;
  else if (/\b(k|thousand)\b/.test(t)) multiplier = 1_000;
  else if (max < 1000) return null; // a bare "15" is ambiguous; don't guess
  return Math.round(max * multiplier);
}

function minimumIndicativeCost(input: CallInput): number | null {
  const f = INTERNAL_BUDGET_FLOOR;
  switch (input.project_type) {
    case "residential_single_room":
      return f.singleRoom;
    case "residential_partial":
      return f.partial;
    case "residential_full":
      return f.residentialPerSqft * (input.area_sqft || f.defaultResidentialSqft);
    case "commercial_office":
    case "commercial_clinic":
    case "commercial_studio":
      return f.commercialPerSqft * (input.area_sqft || f.defaultCommercialSqft);
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Criteria
// ---------------------------------------------------------------------------

export function matchServiceArea(location: string | null | undefined): "in" | "out" | "unknown" {
  const loc = (location ?? "").toLowerCase().trim();
  if (!loc) return "unknown";
  if (OUTSIDE_AREA.some((a) => loc.includes(a))) return "out";
  if (SERVICE_AREA.some((a) => loc.includes(a))) return "in";
  return "unknown";
}

function projectCriterion(input: CallInput): CriterionResult {
  const label = "Real design + execution project";
  const t = input.project_type;
  const typeLabel = PROJECT_TYPE_LABELS[t];
  if (RESIDENTIAL.includes(t)) return { key: "project", label, status: "pass", reason: `${typeLabel} with execution.` };
  if (COMMERCIAL.includes(t)) {
    const a = input.area_sqft;
    if (a && a > COMMERCIAL_TOLERANCE_SQFT)
      return { key: "project", label, status: "fail", reason: `${typeLabel}, ${a.toLocaleString("en-IN")} sq ft, is above the ~3,000 sq ft commercial limit (services.md).` };
    if (a && a > COMMERCIAL_MAX_SQFT)
      return { key: "project", label, status: "pass", reason: `${typeLabel}, ${a.toLocaleString("en-IN")} sq ft. Slightly over the ~3,000 sq ft guideline; designer to confirm.` };
    if (a && a < COMMERCIAL_MIN_SQFT)
      return { key: "project", label, status: "fail", reason: `${typeLabel}, ${a} sq ft, is below typical commercial scope (500 sq ft, per front-desk practice in T18; not in services.md, so it's flagged in Policy).` };
    return { key: "project", label, status: "pass", reason: a ? `${typeLabel}, ${a.toLocaleString("en-IN")} sq ft (within the ~3,000 sq ft limit).` : `${typeLabel}; size not stated.` };
  }
  if (t === "unknown" || t === "other")
    return { key: "project", label, status: "unclear", reason: "Project type not clear yet." };
  return { key: "project", label, status: "fail", reason: `${typeLabel} is outside the studio's services (services.md).` };
}

function locationCriterion(input: CallInput): CriterionResult {
  const label = "In service area (Pune / PCMC)";
  const m = matchServiceArea(input.location);
  if (m === "in") return { key: "location", label, status: "pass", reason: `${input.location} is within Pune / PCMC.` };
  if (m === "out") return { key: "location", label, status: "fail", reason: `${input.location} is outside Pune / PCMC (no vendor network there).` };
  return {
    key: "location",
    label,
    status: "unclear",
    reason: input.location ? `"${input.location}" isn't a recognised Pune / PCMC locality; needs confirming.` : "Location not stated.",
  };
}

function timelineCriterion(input: CallInput): { result: CriterionResult; conflict: boolean } {
  const label = "Realistic timeline";
  if (input.timeline_kind === "flexible")
    return { result: { key: "timeline", label, status: "pass", reason: `Flexible / no hard deadline${input.timeline_text ? ` (“${input.timeline_text}”)` : ""}.` }, conflict: false };
  if (input.timeline_kind === "deadline" && input.deadline_weeks != null && input.deadline_weeks >= 0) {
    const w = input.deadline_weeks;
    if (w < TIMELINES.minLeadTimeWeeks)
      return { result: { key: "timeline", label, status: "fail", reason: `Needs completion in ${w} weeks, which is under the 6-week minimum lead time (services.md).` }, conflict: false };
    if (w < MIN_REALISTIC_WEEKS)
      return {
        result: {
          key: "timeline",
          label,
          status: "conflict",
          reason: `Needs completion in ${w} weeks. That clears the 6-week minimum lead time, but it's shorter than design (3–4 wk) + execution (8–16 wk). The case documents conflict here, so it's flagged for a designer instead of being decided automatically.`,
        },
        conflict: true,
      };
    return { result: { key: "timeline", label, status: "pass", reason: `Needs completion in ${w} weeks, enough for design + execution.` }, conflict: false };
  }
  return { result: { key: "timeline", label, status: "unclear", reason: "Timeline not stated." }, conflict: false };
}

function budgetCriterion(input: CallInput): { result: CriterionResult; budget: number | null } {
  const label = "Budget broadly aligned (volunteered only)";
  if (!input.budget_text?.trim())
    return { result: { key: "budget", label, status: "pass", reason: "Budget not mentioned, so treated as qualified (qualified.md). Not probed." }, budget: null };
  const budget = parseBudgetInr(input.budget_text);
  if (budget == null)
    return { result: { key: "budget", label, status: "unclear", reason: `Volunteered “${input.budget_text}”, which couldn't be read as an amount. Noted for the designer; not probed.` }, budget: null };
  const floor = minimumIndicativeCost(input);
  if (floor != null && budget < floor * INTERNAL_BUDGET_FLOOR.clearlyBelowRatio)
    return { result: { key: "budget", label, status: "fail", reason: `Volunteered “${input.budget_text}”, clearly below any realistic cost for this scope (internal check).` }, budget };
  return { result: { key: "budget", label, status: "pass", reason: `Volunteered “${input.budget_text}”, no obvious misalignment. Designer confirms fit at consultation.` }, budget };
}

function decisionCriterion(input: CallInput): CriterionResult {
  const label = "Decision-maker on call (or authorised)";
  switch (input.decision_maker) {
    case "yes":
      return { key: "decision_maker", label, status: "pass", reason: "Caller is the decision-maker." };
    case "authorised_representative":
      return { key: "decision_maker", label, status: "pass", reason: "Caller is authorised by / represents the decision-maker." };
    case "researching_only":
      return { key: "decision_maker", label, status: "fail", reason: "Caller is only researching for someone else, with no authority to proceed (qualified.md)." };
    default:
      return { key: "decision_maker", label, status: "unclear", reason: "Not confirmed. Treated as qualified and noted for the designer (qualified.md: don't push)." };
  }
}

// ---------------------------------------------------------------------------
// Caller-facing language
// ---------------------------------------------------------------------------

const FOLLOW_UP_QUESTIONS = {
  project: "Are you looking for a complete redesign with execution, and is this for a home or an office?",
  location: "Which area is the site in? We work across Pune city and PCMC.",
  timeline: "When would you need the project complete?",
} as const;

/**
 * Pricing guard: a reply must never contain a price, range or per-sq-ft figure.
 * If anything currency-like slips into a reply, the whole reply is replaced with the approved line.
 */
const PRICE_PATTERN = /(₹|\brs\.?\s*\d|\binr\b|\brupees?\b|\blakhs?\b|\blacs?\b|\bcrores?\b|\bper\s*sq|\/\s*sq\.?\s*ft|\d\s*k\b)/i;

export function containsPricing(text: string): boolean {
  return PRICE_PATTERN.test(text);
}

export function enforcePricingPolicy(text: string): string {
  return containsPricing(text) ? APPROVED_PRICING_RESPONSE : text;
}

function singleFailResponse(c: CriterionResult, input: CallInput): string {
  switch (c.key) {
    case "project": {
      const specific = EXCLUDED_TYPE_RESPONSES[input.project_type];
      if (specific) return `Thank you for thinking of us. ${specific}`;
      if (COMMERCIAL.includes(input.project_type) && (input.area_sqft ?? 0) > COMMERCIAL_MAX_SQFT)
        return "Thank you for thinking of us. Our commercial work is for offices, clinics and studios up to approximately 3,000 sq ft, so a space of this size is beyond what we take on.";
      return "Thank you for thinking of us. A space of this size is below the scale our design and execution team is set up for, so we wouldn't be able to do it justice. A designer who specialises in smaller spaces would be a better fit.";
    }
    case "location":
      return "Thank you for thinking of us. At the moment we only take on projects within Pune city and PCMC. We don't have our vendor network outside Pune, so we wouldn't be able to serve you well there.";
    case "timeline":
      return `Thank you for calling. Our design phase alone takes ${TIMELINES.designWeeks}, and execution takes ${TIMELINES.executionWeeks}, so we can't take on a project that needs to be ready in under six weeks without rushing it. If your timeline moves, we'd love to hear from you.`;
    case "budget":
      return "I appreciate you sharing that. For the scope you've described, the budget you mentioned may not align with what a full design-and-execution project with us involves. I'd rather be upfront now than have you find out at the consultation.";
    case "decision_maker":
      return "Thank you for calling. It would be best for us to speak with the person who'll be making the decision. Please feel free to have them call us, or call back once you're ready to go ahead on their behalf.";
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function qualify(input: CallInput): QualificationResult {
  const project = projectCriterion(input);
  const location = locationCriterion(input);
  const { result: timeline, conflict: timeline_conflict } = timelineCriterion(input);
  const { result: budget, budget: budget_inr } = budgetCriterion(input);
  const decision = decisionCriterion(input);
  const criteria = [project, location, timeline, budget, decision];

  const pricingLine = input.pricing_asked ? ` ${APPROVED_PRICING_RESPONSE}` : "";
  const typeLabel = PROJECT_TYPE_LABELS[input.project_type];
  const who = input.caller_name?.trim() || "Unnamed caller";
  const facts = [
    typeLabel,
    input.area_sqft ? `${input.area_sqft.toLocaleString("en-IN")} sq ft` : null,
    input.location || null,
    input.timeline_text || (input.timeline_kind === "flexible" ? "flexible timeline" : null),
  ]
    .filter(Boolean)
    .join(" · ");

  // 1. Escalations always win. An existing-client complaint is never an "unqualified lead".
  const escalationReasons = detectEscalation(input);
  if (escalationReasons.length > 0) {
    const reason = escalationReasons.join("; ");
    return {
      outcome: "needs_human_review",
      escalation_required: true,
      escalation_reason: reason,
      criteria,
      follow_up_question: null,
      timeline_conflict,
      agent_response: enforcePricingPolicy(
        "I'm really sorry about this. It's not the experience we want anyone to have. I'm recording this as urgent for a senior member of our team, with your name, your project and what's happened, so you won't have to repeat yourself. Could you confirm the best number to reach you on?",
      ),
      summary: `URGENT: ${who} (${input.caller_type === "existing_client" ? "existing client" : "caller"}). ${reason}.${facts ? ` ${facts}.` : ""}`,
      budget_inr,
      handoff_note: `Escalation: ${reason}. Caller notes: ${input.notes?.trim() || "none recorded"}`,
    };
  }

  const fails = criteria.filter((c) => c.status === "fail");
  const unclearCore = [project, location, timeline].filter((c) => c.status === "unclear");
  const uncertainSoft = [budget, decision].filter((c) => c.status === "unclear");

  // 2. Any failed criterion closes the enquiry gracefully (qualified.md: "If it fails one, close gracefully").
  if (fails.length > 0) {
    const response = fails.length >= 2 ? `Thank you so much for calling. ${MULTI_FAIL_DECLINE}` : singleFailResponse(fails[0], input);
    return {
      outcome: "unqualified",
      escalation_required: false,
      escalation_reason: null,
      criteria,
      follow_up_question: null,
      timeline_conflict,
      // The approved pricing line offers to book a consultation, which would contradict a decline,
      // so declined callers get no pricing line at all (and never a number).
      agent_response: enforcePricingPolicy(response),
      summary: `Declined: ${who}. ${fails.map((f) => f.reason).join(" ")}`,
      budget_inr,
      handoff_note: null,
    };
  }

  // 3. Unclear on project, location or timeline: ask ONE direct question.
  if (unclearCore.length > 0) {
    const q = FOLLOW_UP_QUESTIONS[unclearCore[0].key as keyof typeof FOLLOW_UP_QUESTIONS];
    return {
      outcome: "needs_follow_up",
      escalation_required: false,
      escalation_reason: null,
      criteria,
      follow_up_question: q,
      timeline_conflict,
      agent_response: enforcePricingPolicy(`Thank you for calling Aangan Studio.${pricingLine} ${q}`.trim()),
      summary: `Needs info: ${who}. Unclear on ${unclearCore.map((c) => c.key.replace("_", " ")).join(", ")}.${facts ? ` ${facts}.` : ""}`,
      budget_inr,
      handoff_note: null,
    };
  }

  const uncertaintyNote = uncertainSoft.length ? `Uncertain (not disqualifying): ${uncertainSoft.map((c) => c.reason).join(" ")}` : null;
  const timelineLine = `Just so you know how it works: design typically takes ${TIMELINES.designWeeks}, and execution ${TIMELINES.executionWeeks} depending on the size of the project.`;

  // 4. Timeline in the zone where the case documents disagree: don't decide, flag for a human.
  if (timeline_conflict) {
    return {
      outcome: "needs_human_review",
      escalation_required: false,
      escalation_reason: "Timeline rule conflict. A designer needs to confirm feasibility.",
      criteria,
      follow_up_question: null,
      timeline_conflict,
      agent_response: enforcePricingPolicy(
        `Thank you, this sounds like a lovely project. ${timelineLine} Your timeline is tight, so I'd like one of our designers to confirm what's achievable before we commit. I'm noting your details for them now.${pricingLine}`,
      ),
      summary: `Review: ${who}. Passes all criteria except a tight timeline that falls in a policy conflict. ${facts}.`,
      budget_inr,
      handoff_note: ["TIMELINE RULE CONFLICT: designer to confirm feasibility.", uncertaintyNote].filter(Boolean).join(" "),
    };
  }

  // 5. Qualified.
  return {
    outcome: "qualified",
    escalation_required: false,
    escalation_reason: null,
    criteria,
    follow_up_question: null,
    timeline_conflict,
    agent_response: enforcePricingPolicy(
      `Wonderful, this sounds like a great fit for us. ${timelineLine} The next step is a consultation with one of our designers, and I'm noting your details so the team can confirm a slot with you.${pricingLine}`,
    ),
    summary: `Qualified: ${who}. ${facts}.${uncertaintyNote ? " Some details uncertain (see note)." : ""}`,
    budget_inr,
    handoff_note: uncertaintyNote,
  };
}
