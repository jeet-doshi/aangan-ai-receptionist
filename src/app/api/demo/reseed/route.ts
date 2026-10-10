import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

/** Restores the labelled demo-seed records. Simulated and real (Vaani) calls are untouched. */
export async function POST() {
  try {
    const count = await getStore().reseedDemo();
    return NextResponse.json({ ok: true, count });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
