import { NextResponse } from "next/server";
import { CallInputSchema, createCall } from "@/lib/calls";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getStore().list());
}

/** Simulated demo call from the in-app form. Always stored with source = "simulated". */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = CallInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid call details", issues: parsed.error.issues }, { status: 400 });
  }
  try {
    const rec = await createCall(parsed.data, { source: "simulated", transcript: parsed.data.notes });
    return NextResponse.json(rec, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
