import { test } from "node:test";
import assert from "node:assert/strict";
import { containsPricing, enforcePricingPolicy, matchServiceArea, parseBudgetInr, qualify } from "../src/lib/qualify";
import { APPROVED_PRICING_RESPONSE, MULTI_FAIL_DECLINE } from "../src/lib/policy";
import { SEED_CALLS } from "../src/lib/seed-data";
import type { CallInput } from "../src/lib/types";

const base: CallInput = {
  caller_name: "Test",
  caller_type: "new_enquiry",
  project_type: "residential_full",
  area_sqft: 1000,
  location: "Baner",
  timeline_kind: "flexible",
  decision_maker: "yes",
};

test("every case transcript (T01–T20) gets the expected outcome", () => {
  for (const s of SEED_CALLS) {
    const r = qualify(s.input);
    assert.equal(r.outcome, s.expected, `${s.reference}: expected ${s.expected}, got ${r.outcome} (${r.summary})`);
  }
});

test("no agent response for any transcript contains a price", () => {
  for (const s of SEED_CALLS) {
    const r = qualify(s.input);
    assert.ok(!containsPricing(r.agent_response), `${s.reference} leaked pricing: ${r.agent_response}`);
  }
});

test("pricing question → approved response verbatim, not disqualified", () => {
  const r = qualify({ ...base, pricing_asked: true });
  assert.equal(r.outcome, "qualified");
  assert.ok(r.agent_response.includes(APPROVED_PRICING_RESPONSE));
});

test("pricing guard replaces any reply containing a figure", () => {
  assert.equal(enforcePricingPolicy("It is around ₹1,800 per sq ft"), APPROVED_PRICING_RESPONSE);
  assert.equal(enforcePricingPolicy("Typically 8 lakh for a 2BHK"), APPROVED_PRICING_RESPONSE);
  assert.equal(enforcePricingPolicy("Rs 2000/sq ft"), APPROVED_PRICING_RESPONSE);
  const safe = "Design takes 3–4 weeks and execution 8–16 weeks; offices up to approximately 3,000 sq ft.";
  assert.equal(enforcePricingPolicy(safe), safe);
});

test("existing-client complaint is human review + escalation, never unqualified", () => {
  // Even with every other criterion failing.
  const r = qualify({
    ...base,
    caller_type: "existing_client",
    project_type: "restaurant",
    location: "Mumbai",
    timeline_kind: "deadline",
    deadline_weeks: 1,
    notes: "My designer hasn't replied in a week",
  });
  assert.equal(r.outcome, "needs_human_review");
  assert.equal(r.escalation_required, true);
});

test("complaint / unresponsive / urgent-human signals in notes escalate", () => {
  for (const notes of [
    "This is not acceptable, I want to complain",
    "Nobody got back to me after I called twice",
    "I need to speak to someone senior right now",
    "There is a leak at the site and my designer isn't answering",
  ]) {
    const r = qualify({ ...base, notes });
    assert.equal(r.outcome, "needs_human_review", notes);
    assert.equal(r.escalation_required, true, notes);
  }
});

test("new lead mentioning a 'broken' builder fitting is not escalated", () => {
  const r = qualify({ ...base, notes: "Builder wardrobes are broken and damaged, want to redo everything" });
  assert.equal(r.outcome, "qualified");
  assert.equal(r.escalation_required, false);
});

test("unclear project / location / timeline → one direct follow-up question", () => {
  assert.equal(qualify({ ...base, project_type: "unknown" }).follow_up_question, "Are you looking for a complete redesign with execution, and is this for a home or an office?");
  assert.equal(qualify({ ...base, location: null }).follow_up_question, "Which area is the site in? We work across Pune city and PCMC.");
  const t = qualify({ ...base, timeline_kind: "unknown" });
  assert.equal(t.outcome, "needs_follow_up");
  assert.equal(t.follow_up_question, "When would you need the project complete?");
});

test("missing budget or authority is uncertain, not disqualifying", () => {
  const r = qualify({ ...base, decision_maker: "unknown", budget_text: "reasonable" });
  assert.equal(r.outcome, "qualified");
  assert.ok(r.handoff_note?.includes("Uncertain"));
});

test("one clear fail → specific graceful decline; two or more → standard decline", () => {
  const one = qualify({ ...base, location: "Talegaon Dabhade, near Pune" });
  assert.equal(one.outcome, "unqualified");
  assert.ok(one.agent_response.includes("Pune city and PCMC"));
  const two = qualify({ ...base, location: "Nashik", project_type: "gym" });
  assert.equal(two.outcome, "unqualified");
  assert.ok(two.agent_response.includes(MULTI_FAIL_DECLINE));
});

test("excluded services are declined", () => {
  for (const t of ["structural", "decor_only", "furniture_only", "restaurant", "hotel", "retail", "gym", "vastu_only"] as const) {
    assert.equal(qualify({ ...base, project_type: t }).outcome, "unqualified", t);
  }
});

test("commercial size limits", () => {
  assert.equal(qualify({ ...base, project_type: "commercial_office", area_sqft: 2200 }).outcome, "qualified");
  assert.equal(qualify({ ...base, project_type: "commercial_clinic", area_sqft: 3200 }).outcome, "qualified");
  assert.equal(qualify({ ...base, project_type: "commercial_office", area_sqft: 5000 }).outcome, "unqualified");
});

test("timeline: <6 wk declined, 6–10 wk flagged as policy conflict, 11+ wk passes", () => {
  assert.equal(qualify({ ...base, timeline_kind: "deadline", deadline_weeks: 3 }).outcome, "unqualified");
  const conflict = qualify({ ...base, timeline_kind: "deadline", deadline_weeks: 8 });
  assert.equal(conflict.outcome, "needs_human_review");
  assert.equal(conflict.timeline_conflict, true);
  assert.equal(conflict.escalation_required, false);
  assert.equal(qualify({ ...base, timeline_kind: "deadline", deadline_weeks: 11 }).outcome, "qualified");
});

test("budget parsing and clearly-below detection", () => {
  assert.equal(parseBudgetInr("1 to 1.5 lakh"), 150_000);
  assert.equal(parseBudgetInr("60-80 lakh"), 8_000_000);
  assert.equal(parseBudgetInr("₹50,000"), 50_000);
  assert.equal(parseBudgetInr("1.2 crore"), 12_000_000);
  assert.equal(parseBudgetInr("reasonable"), null);
  assert.equal(qualify({ ...base, budget_text: "2 lakh", area_sqft: 1400 }).outcome, "unqualified");
  assert.equal(qualify({ ...base, budget_text: "18-22 lakh", area_sqft: 1300 }).outcome, "qualified");
});

test("service area matching", () => {
  assert.equal(matchServiceArea("Pimple Saudagar"), "in");
  assert.equal(matchServiceArea("Hinjewadi Phase 1, Pune"), "in");
  assert.equal(matchServiceArea("Talegaon Dabhade, near Pune"), "out");
  assert.equal(matchServiceArea("Lonavala"), "out");
  assert.equal(matchServiceArea("Somewhere"), "unknown");
});
