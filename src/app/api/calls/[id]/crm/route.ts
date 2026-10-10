import { NextResponse } from "next/server";
import { retryCrmSync } from "@/lib/calls";

export async function POST(_req: Request, ctx: RouteContext<"/api/calls/[id]/crm">) {
  const { id } = await ctx.params;
  try {
    return NextResponse.json(await retryCrmSync(id));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
