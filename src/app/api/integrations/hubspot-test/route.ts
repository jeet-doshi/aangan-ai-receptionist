import { NextResponse } from "next/server";
import { getPortalId, hubspotEnabled } from "@/lib/hubspot";

/** Read-only check that the HubSpot token works. Creates nothing in the CRM. */
export async function POST() {
  if (!hubspotEnabled()) return NextResponse.json({ ok: false, error: "HubSpot is not configured. Set HUBSPOT_ACCESS_TOKEN." }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, portalId: await getPortalId() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
