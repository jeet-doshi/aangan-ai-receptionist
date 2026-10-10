// Shared domain types for call records and qualification.

/** Where a record came from. Only `vaani` is a live AI voice conversation (phone, or a browser test call when no number is attached). */
export type CallSource = "demo_seed" | "simulated" | "vaani";

export type CallerType = "new_enquiry" | "existing_client";

export type ProjectType =
  | "residential_full"
  | "residential_partial"
  | "residential_single_room"
  | "commercial_office"
  | "commercial_clinic"
  | "commercial_studio"
  | "structural"
  | "decor_only"
  | "advice_only"
  | "furniture_only"
  | "vastu_only"
  | "restaurant"
  | "hotel"
  | "retail"
  | "gym"
  | "other"
  | "unknown";

/** How clearly the caller described their timeline. */
export type TimelineKind = "flexible" | "deadline" | "unknown";

export type DecisionMaker = "yes" | "authorised_representative" | "researching_only" | "unknown";

export type CriterionStatus = "pass" | "fail" | "unclear" | "conflict";

export type CriterionKey = "project" | "location" | "timeline" | "budget" | "decision_maker";

export interface CriterionResult {
  key: CriterionKey;
  label: string;
  status: CriterionStatus;
  reason: string;
}

export type Outcome = "qualified" | "unqualified" | "needs_follow_up" | "needs_human_review";

/**
 * Handoff status is only ever `sent` when the Telegram API confirmed delivery.
 * `demo_not_configured` means the message was prepared but NOT delivered.
 */
export type HandoffStatus = "not_required" | "sent" | "failed" | "demo_not_configured";

/** What the caller told the receptionist. Everything is optional except caller type. */
export interface CallInput {
  caller_name?: string | null;
  caller_phone?: string | null;
  caller_type: CallerType;
  project_type: ProjectType;
  area_sqft?: number | null;
  location?: string | null;
  timeline_kind: TimelineKind;
  /** Weeks from the call until the caller needs the project complete. Only used when timeline_kind = deadline. */
  deadline_weeks?: number | null;
  timeline_text?: string | null;
  /** Budget exactly as the caller volunteered it, e.g. "1 to 1.5 lakh". Never prompted for. */
  budget_text?: string | null;
  decision_maker: DecisionMaker;
  pricing_asked?: boolean;
  urgent_human_request?: boolean;
  /** Free-text notes / transcript. Scanned for complaint and urgency signals. */
  notes?: string | null;
  duration_sec?: number | null;
}

export interface QualificationResult {
  outcome: Outcome;
  escalation_required: boolean;
  escalation_reason: string | null;
  criteria: CriterionResult[];
  follow_up_question: string | null;
  timeline_conflict: boolean;
  /** What the AI receptionist says back to the caller. Passed through the pricing guard. */
  agent_response: string;
  summary: string;
  budget_inr: number | null;
  /** Internal note for the designer about uncertain criteria. */
  handoff_note: string | null;
}

/** `synced` only when HubSpot confirmed the contact and note. Demo-seed records are never synced. */
export type CrmStatus = "not_required" | "synced" | "failed" | "not_configured";

export interface CallRecord extends CallInput, QualificationResult {
  id: string;
  created_at: string;
  source: CallSource;
  is_demo: boolean;
  /** Seed provenance, e.g. "T01" for case transcript replays. */
  reference: string | null;
  transcript: string | null;
  voice_cost_inr: number | null;
  ai_cost_inr: number | null;
  /** true when costs come from configured rates rather than provider-reported figures. */
  cost_estimated: boolean;
  handoff_status: HandoffStatus;
  handoff_detail: string | null;
  handoff_message: string | null;
  handoff_at: string | null;
  /** Optional so records created before the HubSpot columns existed still type-check. */
  crm_status?: CrmStatus;
  crm_detail?: string | null;
  crm_contact_id?: string | null;
}
