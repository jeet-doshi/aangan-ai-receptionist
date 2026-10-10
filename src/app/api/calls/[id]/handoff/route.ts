import { NextResponse } from "next/server";
import { retryHandoff } from "@/lib/calls";

export async function POST(_req: Request, ctx: RouteContext<"/api/calls/[id]/handoff">) {
  const { id } = await ctx.params;
  try {
    return NextResponse.json(await retryHandoff(id));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
