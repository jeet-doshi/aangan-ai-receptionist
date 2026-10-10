import "server-only";
import { estimateCosts } from "./config";
import { buildHandoffMessage, needsHandoff } from "./handoff";
import { qualify } from "./qualify";
import { SEED_CALLS } from "./seed-data";
import type { CallRecord } from "./types";

/** Builds demo-seed records. Deterministic ids so reseeding replaces rather than duplicates. */
export function buildSeedRecords(): CallRecord[] {
  return SEED_CALLS.map((s, i) => {
    const rec: CallRecord = {
      ...s.input,
      // Explicit defaults: Supabase bulk inserts send null for keys missing from some rows.
      pricing_asked: s.input.pricing_asked ?? false,
      urgent_human_request: s.input.urgent_human_request ?? false,
      ...qualify(s.input),
      id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
      created_at: new Date(s.at).toISOString(),
      source: "demo_seed",
      is_demo: true,
      reference: s.reference,
      transcript: s.transcript,
      ...estimateCosts(s.input.duration_sec),
      cost_estimated: true,
      handoff_status: "not_required",
      handoff_detail: null,
      handoff_message: null,
      handoff_at: null,
    };
    if (needsHandoff(rec)) {
      rec.handoff_status = "demo_not_configured";
      rec.handoff_detail = "Seed record: handoff message prepared, but no notification was sent.";
      rec.handoff_message = buildHandoffMessage(rec);
    }
    return rec;
  });
}
