import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { sendTelegram } from "@/lib/handoff";

/** Sends a clearly-labelled test message so you can confirm the bot + chat id work. */
export async function POST() {
  if (!config.telegram.enabled) {
    return NextResponse.json({ ok: false, error: "Telegram is not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID." }, { status: 400 });
  }
  const r = await sendTelegram(config.telegram.chatId, "✅ TEST MESSAGE from Aangan AI Receptionist. Telegram handoff is connected. (This is not a lead.)");
  return NextResponse.json(r, { status: r.ok ? 200 : 502 });
}
