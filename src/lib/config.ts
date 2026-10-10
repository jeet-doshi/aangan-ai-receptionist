// Reads integration settings from environment variables. Secrets stay server-side.
import "server-only";

function num(v: string | undefined, fallback: number): number {
  const n = v == null || v === "" ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    secretKey: process.env.SUPABASE_SECRET_KEY || "",
    get enabled() {
      return Boolean(this.url && this.secretKey && !this.url.includes("your-project"));
    },
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || "",
    chatId: process.env.TELEGRAM_CHAT_ID || "",
    /** Optional separate chat for urgent escalations; falls back to TELEGRAM_CHAT_ID. */
    escalationChatId: process.env.TELEGRAM_ESCALATION_CHAT_ID || "",
    get enabled() {
      return Boolean(this.botToken && this.chatId);
    },
  },
  vaani: {
    webhookSecret: process.env.VAANI_WEBHOOK_SECRET || "",
    get enabled() {
      return Boolean(this.webhookSecret);
    },
  },
  costs: {
    /** Placeholder rates: replace with your actual Vaani plan rates. Used only when a call has no reported cost. */
    voicePerMinInr: num(process.env.VOICE_COST_PER_MIN_INR, 4),
    aiPerCallInr: num(process.env.AI_COST_PER_CALL_INR, 1),
    get isDefault() {
      return !process.env.VOICE_COST_PER_MIN_INR && !process.env.AI_COST_PER_CALL_INR;
    },
  },
  appBaseUrl: process.env.APP_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ""),
};

export function estimateCosts(durationSec: number | null | undefined) {
  const minutes = Math.max(0, durationSec ?? 0) / 60;
  return {
    voice_cost_inr: Math.round(minutes * config.costs.voicePerMinInr * 100) / 100,
    ai_cost_inr: config.costs.aiPerCallInr,
  };
}
