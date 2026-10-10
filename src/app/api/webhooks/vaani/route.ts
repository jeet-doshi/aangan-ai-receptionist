import { NextResponse } from "next/server";
import { createCall } from "@/lib/calls";
import { config } from "@/lib/config";
import { normaliseVaaniPayload, verifyVaaniRequest } from "@/lib/vaani";

/**
 * Post-call webhook for the Vaani Voice agent (Settings → Webhooks in app.vaanivoice.ai).
 * Records are stored with source = "vaani" (a live AI voice conversation), except payloads that identify themselves as tests.
 * Vaani documents no signature, so authenticate with ?secret=<VAANI_WEBHOOK_SECRET> in the webhook URL.
 */
export async function POST(req: Request) {
  if (!config.vaani.enabled) {
    return NextResponse.json({ error: "Vaani webhook is disabled. Set VAANI_WEBHOOK_SECRET to enable it." }, { status: 503 });
  }
  const raw = await req.text();
  if (!verifyVaaniRequest(config.vaani.webhookSecret, raw, req.headers, new URL(req.url))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const event = String(body.event ?? body.type ?? req.headers.get("x-vaaniyantra-event") ?? "");
  // Vaani sends ~11 lifecycle events per call (call_started, call_ended, …). Only the post-call
  // analysis event carries the summary, entities and transcript, so it is the only one recorded.
  const RECORDED_EVENTS = ["", "call_postprocessing", "call.completed"];
  if (!RECORDED_EVENTS.includes(event) && !/test/i.test(event)) {
    return NextResponse.json({ ok: true, ignored: `event ${event} (only call_postprocessing is recorded)` });
  }
  const isTest = body.test === true || /test/i.test(event);
  const call = normaliseVaaniPayload(body);
  try {
    const rec = await createCall(call.input, {
      source: isTest ? "simulated" : "vaani",
      transcript: [isTest ? "[Vaani test webhook]" : null, call.externalId ? `Vaani call id: ${call.externalId}` : null, call.transcript].filter(Boolean).join("\n") || null,
      reportedCosts: call.reportedCosts,
    });
    return NextResponse.json({ ok: true, id: rec.id, outcome: rec.outcome, handoff_status: rec.handoff_status });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
