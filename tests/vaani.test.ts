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
