import "server-only";
import { config } from "./config";
import { hubspotEnabled } from "./hubspot";
import { getStore } from "./store";

export function getIntegrationStatus() {
  const storage = getStore().info();
  return {
    storage,
    telegram: config.telegram.enabled
      ? { live: true, label: "Telegram connected", detail: config.telegram.escalationChatId ? "Leads + separate escalation chat" : "Leads and escalations to one chat" }
      : { live: false, label: "Telegram: demo handoff", detail: "TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID not set. Handoff messages are prepared but not sent." },
    vaani: config.vaani.enabled
      ? { live: true, label: "Vaani webhook enabled", detail: "Records Vaani's call_postprocessing webhook. Verified only once a call appears with the 'Vaani voice call' badge." }
      : { live: false, label: "Vaani: not connected", detail: "VAANI_WEBHOOK_SECRET not set. Calls shown are simulated or demo data." },
    hubspot: hubspotEnabled()
      ? { live: true, label: "HubSpot connected", detail: "Qualified leads and escalations are logged as contacts with a call note." }
      : { live: false, label: "HubSpot: not connected", detail: "HUBSPOT_ACCESS_TOKEN not set. Leads are not logged to a CRM." },
    costs: { voicePerMinInr: config.costs.voicePerMinInr, aiPerCallInr: config.costs.aiPerCallInr, isDefault: config.costs.isDefault },
  };
}
