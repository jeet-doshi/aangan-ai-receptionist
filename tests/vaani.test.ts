import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "crypto";
import { mapProjectType, normaliseVaaniPayload, verifyVaaniRequest } from "../src/lib/vaani";
import { qualify } from "../src/lib/qualify";

test("maps a nested post-call payload into a qualified lead", () => {
  const { input, reportedCosts, externalId } = normaliseVaaniPayload({
    event: "call.completed",
    call_id: "abc",
    from: "+91 90000 00000",
    duration_sec: 284,
    cost: 12.5,
    extracted_data: { caller_name: "Pooja", project_type: "2BHK full home", area_sqft: "900", location: "Magarpatta", timeline: "flexible, January start", decision_maker: "yes" },
  });
  assert.equal(input.project_type, "residential_full");
  assert.equal(input.area_sqft, 900);
  assert.equal(input.timeline_kind, "flexible");
  assert.equal(input.caller_phone, "+91 90000 00000");
  assert.equal(externalId, "abc");
  assert.deepEqual(reportedCosts, { voice_cost_inr: 12.5, ai_cost_inr: null });
  assert.equal(qualify(input).outcome, "qualified");
});

test("existing-client complaint from Vaani escalates", () => {
  const { input } = normaliseVaaniPayload({ data: { caller_type: "existing client", notes: "My designer hasn't replied in a week" } });
  const r = qualify(input);
  assert.equal(r.outcome, "needs_human_review");
  assert.equal(r.escalation_required, true);
});

test("free-text project types map to the right category", () => {
  assert.equal(mapProjectType("Restaurant fit-out"), "restaurant");
  assert.equal(mapProjectType("office 1200 sqft"), "commercial_office");
  assert.equal(mapProjectType("just want ideas"), "advice_only");
  assert.equal(mapProjectType(""), "unknown");
});

test("webhook auth: shared secret or HMAC signature, otherwise rejected", () => {
  const url = new URL("https://x.test/api/webhooks/vaani");
  const body = '{"a":1}';
  assert.equal(verifyVaaniRequest("s3cret", body, new Headers({ "x-webhook-secret": "s3cret" }), url), true);
  assert.equal(verifyVaaniRequest("s3cret", body, new Headers({ authorization: "Bearer s3cret" }), url), true);
  assert.equal(verifyVaaniRequest("s3cret", body, new Headers(), new URL(`${url}?secret=s3cret`)), true);
  const sig = createHmac("sha256", "s3cret").update(body).digest("hex");
  assert.equal(verifyVaaniRequest("s3cret", body, new Headers({ "x-vaaniyantra-signature": `sha256=${sig}` }), url), true);
  assert.equal(verifyVaaniRequest("s3cret", body, new Headers({ "x-webhook-secret": "wrong" }), url), false);
  assert.equal(verifyVaaniRequest("s3cret", body, new Headers(), url), false);
  assert.equal(verifyVaaniRequest("", body, new Headers({ "x-webhook-secret": "" }), url), false);
});

test("Vaani call_postprocessing payload (documented shape): ms duration, entities, dispositions", () => {
  const { input, transcript, externalId } = normaliseVaaniPayload({
    event: "call_postprocessing",
    call_id: "outbound-123",
    timestamp: "2026-10-10T10:00:00Z",
    data: {
      room_name: "outbound-123",
      call_id: "outbound-123",
      call_duration: 55150.0,
      end_reason: "Call ended",
      summary: "Caller wants a full redesign of a 2BHK in Wakad.",
      entities: { caller_name: "Ritu", project_type: "2BHK full home", area_sqft: "1,050 sq ft", location: "Wakad", timeline: "flexible", decision_maker: "yes" },
      dispositions: { outcome: "interested" },
      transcript: "[00:00:01] AGENT: Hello\n\n[00:00:03] USER: Hi",
    },
  });
  assert.equal(input.duration_sec, 55);
  assert.equal(input.caller_name, "Ritu");
  assert.equal(input.area_sqft, 1050);
  assert.equal(input.project_type, "residential_full");
  assert.ok(input.notes?.includes("Disposition: interested"));
  assert.ok(transcript?.includes("AGENT"));
  assert.equal(externalId, "outbound-123");
  assert.equal(qualify(input).outcome, "qualified");
});

test("complaint disposition or summary from Vaani escalates", () => {
  const { input } = normaliseVaaniPayload({
    event: "call_postprocessing",
    data: { summary: "Existing client says her designer hasn't replied in a week.", entities: { caller_type: "existing_client" }, dispositions: { outcome: "complaint" } },
  });
  assert.equal(qualify(input).escalation_required, true);
});

// Fixture: the first live Vaani call (10 Oct 2026), exactly as received; only name was extracted.
const LIVE_CALL = {
  event: "call_postprocessing",
  call_id: "webrtc-1791643617-11ae3bc2",
  data: {
    call_id: "webrtc-1791643617-11ae3bc2",
    summary:
      "The caller, Priya, reached out to discuss an interior redesign project for her 3 BHK property in Banner. While she confirmed she is the owner and provided a target completion date of March 2027, the call ended before she could provide her contact details or the carpet area. The intake remains incomplete and requires follow-up to gather the missing information.",
    entities: { name: "Priya" },
    dispositions: { status: "Intake Incomplete" },
    transcript:
      "[14:47:10] AGENT: Thank you for calling Aangan Studio! I am your AI receptionist, May I know your name and what kind of interior design project you are planning?\n[14:47:28] USER: Hi. I am Priya. I have three BHK in Banner, and wonderful interior redesign. With executions. No rush. Maybe by March, and I'm the owner\n[14:47:30] AGENT: To help us get everything set up for you, could you please share your best contact number and your approximate carpet area in square feet?",
  },
};

test("live Vaani call: missing fields are inferred from summary/transcript and the lead qualifies", () => {
  const { input } = normaliseVaaniPayload(LIVE_CALL);
  assert.equal(input.caller_name, "Priya");
  assert.equal(input.location, "Baner");
  assert.equal(input.project_type, "residential_full");
  assert.equal(input.timeline_kind, "flexible");
  assert.equal(input.decision_maker, "yes");
  assert.equal(input.pricing_asked, false);
  assert.equal(input.duration_sec, 20);
  assert.ok(input.notes?.includes("Inferred from the Vaani summary/transcript (verify)"));
  assert.equal(qualify(input).outcome, "qualified");
});

test("inference never overrides fields Vaani extracted, and ignores agent lines", () => {
  const { input } = normaliseVaaniPayload({
    event: "call_postprocessing",
    data: {
      summary: "Caller wants a restaurant in Nashik.",
      entities: { location: "Banner", project_type: "office", timeline: "flexible" },
      transcript: "[10:00:00] AGENT: We serve Pune and can discuss pricing.\n[10:00:05] USER: ok",
    },
  });
  assert.equal(input.location, "Baner"); // alias-corrected, not replaced by "Nashik"
  assert.equal(input.project_type, "commercial_office");
  assert.equal(input.pricing_asked, false); // "pricing" appears only in an AGENT line
});
