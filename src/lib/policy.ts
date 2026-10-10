// Studio policy, transcribed from the Case 03 documents (services.md, qualified.md, pricing.md).
// Keep every rule traceable to a source so the founder can audit it.

import type { ProjectType } from "./types";

/** pricing.md — the ONLY acceptable response to a pricing question. Do not edit. */
export const APPROVED_PRICING_RESPONSE =
  "Pricing depends on the site, the materials you choose, and the scope — your designer will walk you through it in detail at the consultation. I can book that for you right now if you'd like.";

/** qualified.md — graceful decline when two or more criteria fail. */
export const MULTI_FAIL_DECLINE =
  "This sounds like it may not be the right fit for us right now — but feel free to reach out if your timeline or scope changes.";

/** services.md — timelines. */
export const TIMELINES = {
  designWeeks: "3–4 weeks",
  executionWeeks: "8–16 weeks",
  minDesignWeeks: 3,
  minExecutionWeeks: 8,
  /** services.md: "we cannot begin execution on a project that needs to be ready in under 6 weeks from today." */
  minLeadTimeWeeks: 6,
};

/**
 * Shortest possible design + execution, per services.md (3 + 8 weeks).
 * Deadlines between the 6-week minimum lead time and this figure are where the
 * case documents disagree, so we flag them instead of picking a side.
 */
export const MIN_REALISTIC_WEEKS = TIMELINES.minDesignWeeks + TIMELINES.minExecutionWeeks;

export const POLICY_CONFLICTS = [
  {
    id: "timeline",
    title: "Minimum timeline rules disagree",
    detail:
      "services.md says the studio cannot take a project that must be ready in under 6 weeks. The same file says design takes 3–4 weeks and execution 8–16 weeks (11 weeks minimum). qualified.md says the site must be available for execution within 8–10 weeks of the consultation, and front-desk transcript T07 says a single room takes 'at least 8–10 weeks from start to finish'.",
    handling:
      "Under 6 weeks: declined (all sources agree). 6 to under 11 weeks: not declined and not auto-qualified. It's flagged 'timeline rule conflict' and sent for human review so a designer confirms feasibility. 11+ weeks or flexible: passes.",
    needsDecisionFrom: "Nikhil (founder) — confirm the single rule the receptionist should apply.",
  },
  {
    id: "commercial-min",
    title: "Commercial minimum size is not in the written policy",
    detail:
      "services.md sets a commercial maximum (~3,000 sq ft) but no minimum. In transcript T18 the front desk declined a 180 sq ft pod, saying commercial projects are 'typically 500 sq ft or more'.",
    handling:
      "Commercial spaces under 500 sq ft fail the project criterion, citing T18 as the source. Spaces of 3,000–3,300 sq ft pass with a note ('approximately'). Above 3,300 sq ft fails.",
    needsDecisionFrom: "Nikhil — confirm whether 500 sq ft is a real minimum.",
  },
] as const;

/** services.md — Pune city + PCMC, plus adjoining Pune localities. Matched as lowercase substrings. */
export const SERVICE_AREA = [
  // Pune city (named in services.md)
  "kothrud", "baner", "aundh", "wakad", "koregaon park", "kalyani nagar", "viman nagar", "hadapsar",
  "magarpatta", "nibm", "kondhwa", "undri", "shivane", "warje", "erandwane", "deccan",
  // PCMC (named in services.md)
  "pimpri", "chinchwad", "pimple saudagar", "pimple nilakh", "ravet", "hinjewadi", "pcmc",
  // Adjoining Pune localities ("and adjoining areas")
  "kharadi", "balewadi", "pashan", "bavdhan", "shivajinagar", "shivaji nagar", "model colony",
  "karve nagar", "sinhagad road", "dhayari", "katraj", "bibwewadi", "swargate", "sadashiv peth",
  "yerawada", "mundhwa", "wanowrie", "nanded city", "pimple gurav", "dahanukar", "sus road",
  "akurdi", "nigdi", "bhosari", "tathawade", "punawale", "camp", "salunke vihar", "sb road",
  "fatima nagar", "lohegaon", "vishrantwadi", "dhanori", "pune",
];

/** services.md — explicitly not served, plus other cities. Checked BEFORE the service area ("Talegaon, near Pune"). */
export const OUTSIDE_AREA = [
  "talegaon", "lonavala", "nashik", "mumbai", "thane", "navi mumbai", "satara", "kolhapur",
  "nagpur", "aurangabad", "bangalore", "bengaluru", "hyderabad", "goa", "lavasa", "delhi",
];

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  residential_full: "Residential — full home",
  residential_partial: "Residential — partial (2+ rooms / floor)",
  residential_single_room: "Residential — single room (full redesign)",
  commercial_office: "Commercial — office",
  commercial_clinic: "Commercial — clinic",
  commercial_studio: "Commercial — studio",
  structural: "Structural / architecture work",
  decor_only: "Decor / styling only",
  advice_only: "Advice / consultation only",
  furniture_only: "Standalone furniture sourcing",
  vastu_only: "Standalone Vastu consultation",
  restaurant: "Restaurant",
  hotel: "Hotel",
  retail: "Retail store",
  gym: "Gym / fitness",
  other: "Other",
  unknown: "Not stated",
};

export const RESIDENTIAL: ProjectType[] = ["residential_full", "residential_partial", "residential_single_room"];
export const COMMERCIAL: ProjectType[] = ["commercial_office", "commercial_clinic", "commercial_studio"];

/** services.md "What we don't do" — caller-facing decline wording per type (no prices, ever). */
export const EXCLUDED_TYPE_RESPONSES: Partial<Record<ProjectType, string>> = {
  structural:
    "We're interior designers rather than architects — we don't move walls, modify the building structure or handle structural permits, so we wouldn't be the right team for that work.",
  decor_only:
    "Our minimum engagement is a complete room redesign with execution, so we don't take on decor or styling-only work.",
  advice_only:
    "We're a full-service studio — our projects include design and execution together, so we don't do advice-only or consultation-only visits. If you decide to go ahead with a full redesign, we'd love to help.",
  furniture_only:
    "We don't source or procure furniture on its own — furniture is always part of a complete design project with us.",
  vastu_only:
    "We incorporate Vastu requirements into our designs, but we don't offer standalone Vastu consultations.",
  restaurant:
    "Restaurant and hospitality interiors are outside our current scope — we focus on homes and offices, clinics and studios.",
  hotel:
    "Hotel and hospitality interiors are outside our current scope — we focus on homes and offices, clinics and studios.",
  retail: "Retail store interiors are outside our current scope — we focus on homes and offices, clinics and studios.",
  gym: "Gym and fitness spaces have specialist requirements we're not set up for — we focus on homes and offices, clinics and studios.",
};

/**
 * INTERNAL ONLY — derived from the lowest band in pricing.md. Used solely to detect a
 * *volunteered* budget that is clearly below any realistic cost (qualified.md criterion 4).
 * These figures must never appear in anything said to a caller.
 */
export const INTERNAL_BUDGET_FLOOR = {
  residentialPerSqft: 1800,
  commercialPerSqft: 1200,
  singleRoom: 350_000,
  /** Assumes at least two rooms for a partial project. */
  partial: 700_000,
  /** Assumed carpet area when the caller gives none (smallest 2BHK / small office). */
  defaultResidentialSqft: 600,
  defaultCommercialSqft: 500,
  /** "Clearly below" = under this fraction of the lowest indicative cost. */
  clearlyBelowRatio: 0.5,
};

export const COMMERCIAL_MAX_SQFT = 3000;
export const COMMERCIAL_TOLERANCE_SQFT = 3300;
export const COMMERCIAL_MIN_SQFT = 500;
