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
