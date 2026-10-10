import { headers } from "next/headers";
import { HubSpotTestButton, ReseedButton, TelegramTestButton } from "@/components/actions";
import { Card } from "@/components/ui";
import { formatInr } from "@/lib/metrics";
import { APPROVED_PRICING_RESPONSE, POLICY_CONFLICTS, TIMELINES } from "@/lib/policy";
import { getIntegrationStatus } from "@/lib/status";

function State({ live, children }: { live: boolean; children: React.ReactNode }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${live ? "border border-line text-good" : "bg-demo text-demo-ink"}`}>{children}</span>;
}

// Shape of Vaani's call_postprocessing webhook (docs.vaanivoice.ai/guides/webhook-setup).
// The keys inside "entities" are whatever you configure under the agent's Analysis → extraction.
const SAMPLE_PAYLOAD = `{
  "event": "call_postprocessing",
  "call_id": "…",
  "data": {
    "call_duration": 284000,          // milliseconds
    "summary": "…",                    // also scanned for complaints / urgency
    "transcript": "[00:00:01] AGENT: …",
    "dispositions": { "outcome": "…" },
    "entities": {
      "caller_name": "Pooja",
      "caller_type": "new_enquiry",     // or "existing_client"
      "project_type": "2BHK full home",
      "area_sqft": "900",
      "location": "Magarpatta",
      "timeline": "flexible, January start",
      "deadline_weeks": "",             // number if there's a hard deadline
      "budget": "",                     // only if volunteered
      "decision_maker": "yes",
      "pricing_asked": "no",
      "urgent_human_request": "no",
      "phone_number": ""
    }
  }
}`;

export default async function IntegrationsPage() {
  const s = getIntegrationStatus();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const webhookUrl = `${proto}://${host}/api/webhooks/vaani`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations & policy</h1>
        <p className="mt-1 text-sm text-ink-2">What is live, what is in demo mode, and the rules the receptionist follows.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Data storage" action={<State live={s.storage.kind === "supabase"}>{s.storage.kind === "supabase" ? "Supabase" : "Local demo fallback"}</State>}>
          <p className="text-sm text-ink-2">{s.storage.detail}.</p>
          {s.storage.kind !== "supabase" && (
            <p className="mt-2 text-sm text-ink-2">
              To persist in Supabase: run <code className="break-all rounded bg-surface-2 px-1">supabase/schema.sql</code> in the Supabase SQL editor, then set{" "}
              <code className="break-all rounded bg-surface-2 px-1">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="break-all rounded bg-surface-2 px-1">SUPABASE_SECRET_KEY</code>.
            </p>
          )}
          <div className="mt-4">
            <ReseedButton />
          </div>
        </Card>

        <Card title="Telegram handoff" action={<State live={s.telegram.live}>{s.telegram.live ? "Connected" : "Demo: not sending"}</State>}>
          <p className="text-sm text-ink-2">{s.telegram.detail}</p>
          {!s.telegram.live && (
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-2">
              <li>In Telegram, message @BotFather → /newbot → copy the token.</li>
              <li>Add the bot to the designers&apos; group (or message it directly), send any message.</li>
              <li>
                Open <code className="break-all rounded bg-surface-2 px-1">https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code> and copy <code className="break-all rounded bg-surface-2 px-1">chat.id</code>.
              </li>
              <li>
                Set <code className="break-all rounded bg-surface-2 px-1">TELEGRAM_BOT_TOKEN</code> and <code className="break-all rounded bg-surface-2 px-1">TELEGRAM_CHAT_ID</code> (optionally{" "}
                <code className="break-all rounded bg-surface-2 px-1">TELEGRAM_ESCALATION_CHAT_ID</code>) and restart.
              </li>
            </ol>
          )}
          <p className="mt-2 text-xs text-muted">A handoff is only marked “Sent” when the Telegram API confirms delivery.</p>
          <div className="mt-4">
            <TelegramTestButton enabled={s.telegram.live} />
          </div>
        </Card>

        <Card title="HubSpot CRM" action={<State live={s.hubspot.live}>{s.hubspot.live ? "Connected" : "Not connected"}</State>} className="lg:col-span-2">
          <p className="text-sm text-ink-2">
            {s.hubspot.detail} Contacts are matched on phone number when one is available. Simulated calls are marked as simulated in the note, and the 19 demo-seed records are never synced. A call shows
            “Saved in HubSpot” only when HubSpot confirms it.
          </p>
          {!s.hubspot.live && (
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-2">
              <li>In HubSpot (free CRM): Settings → Integrations → <strong>Private Apps</strong> → Create a private app.</li>
              <li>
                Scopes: <code className="break-all rounded bg-surface-2 px-1">crm.objects.contacts.read</code> and <code className="break-all rounded bg-surface-2 px-1">crm.objects.contacts.write</code>.
              </li>
              <li>
                Copy the access token into <code className="break-all rounded bg-surface-2 px-1">HUBSPOT_ACCESS_TOKEN</code> (Vercel env vars + .env.local) and redeploy.
              </li>
            </ol>
          )}
          <div className="mt-4">
            <HubSpotTestButton enabled={s.hubspot.live} />
          </div>
        </Card>

        <Card title="Vaani Voice (live calls)" action={<State live={s.vaani.live}>{s.vaani.live ? "Webhook enabled" : "Not connected"}</State>} className="lg:col-span-2">
          <p className="text-sm text-ink-2">{s.vaani.detail}</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-2">
            <li>
              In <strong>app.vaanivoice.ai → Settings → Webhooks</strong>, add <code className="break-all rounded bg-surface-2 px-1">{webhookUrl}?secret=&lt;VAANI_WEBHOOK_SECRET&gt;</code>. Vaani documents no
              signature header, so the secret goes in the URL.
            </li>
            <li>
              In your agent&apos;s <strong>Analysis</strong> settings, add extraction fields named like the <code>entities</code> keys below. The mapper also accepts free text and common alternative names.
            </li>
            <li>Make a test call with the agent. Only the <code>call_postprocessing</code> event creates a record; Vaani&apos;s other lifecycle events are acknowledged and ignored.</li>
          </ol>
          <pre className="mt-3 overflow-auto rounded-lg bg-surface-2 p-3 text-xs">{SAMPLE_PAYLOAD}</pre>
          <p className="mt-2 text-xs text-muted">
            Built from Vaani&apos;s documented payload; not yet confirmed with a live call. Calls arriving here get the “Vaani voice call” badge. With no phone number attached (e.g. a browser test call), the record says so
            and never claims a phone call.
          </p>
        </Card>

        <Card title="Cost model">
          <p className="text-sm text-ink-2">
            Voice: {formatInr(s.costs.voicePerMinInr)}/min · AI processing: {formatInr(s.costs.aiPerCallInr)}/call · Qualification rules: ₹0 (no LLM).
          </p>
          <p className="mt-2 text-sm text-ink-2">
            {s.costs.isDefault ? (
              <>
                <strong>These are placeholder rates.</strong> Set <code className="break-all rounded bg-surface-2 px-1">VOICE_COST_PER_MIN_INR</code> and <code className="break-all rounded bg-surface-2 px-1">AI_COST_PER_CALL_INR</code> to your actual Vaani plan.
              </>
            ) : (
              "Rates come from your environment settings."
            )}{" "}
            If a Vaani webhook reports a cost, the reported figure is used instead.
          </p>
        </Card>

        <Card title="Pricing policy (pricing.md)">
          <p className="text-sm text-ink-2">The receptionist never quotes a price, range or per-sq-ft figure. Every reply passes a pricing guard. Pricing questions get exactly:</p>
          <blockquote className="mt-2 border-l-2 border-brand pl-3 text-sm italic">{APPROVED_PRICING_RESPONSE}</blockquote>
          <p className="mt-2 text-xs text-muted">The founder&apos;s request to quote standard per-sq-ft pricing was deliberately not built: pricing.md says no number may be quoted.</p>
        </Card>

        <Card title="Service boundaries (services.md)" className="lg:col-span-2">
          <div className="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <div className="font-medium">We take on</div>
              <ul className="mt-1 list-disc pl-5 text-ink-2">
                <li>Residential: full home, partial, or single room with full execution</li>
                <li>Offices, clinics, studios up to ~3,000 sq ft</li>
                <li>Pune city and PCMC only</li>
              </ul>
            </div>
            <div>
              <div className="font-medium">We decline</div>
              <ul className="mt-1 list-disc pl-5 text-ink-2">
                <li>Structural / architecture work</li>
                <li>Decor-only, advice-only, standalone Vastu</li>
                <li>Standalone furniture sourcing</li>
                <li>Restaurants, hotels, retail, gyms</li>
                <li>Talegaon, Lonavala, Nashik, Mumbai and other cities</li>
              </ul>
            </div>
            <div>
              <div className="font-medium">Timelines</div>
              <ul className="mt-1 list-disc pl-5 text-ink-2">
                <li>Design: {TIMELINES.designWeeks}</li>
                <li>Execution: {TIMELINES.executionWeeks}</li>
                <li>Minimum lead time: {TIMELINES.minLeadTimeWeeks} weeks</li>
              </ul>
            </div>
          </div>
        </Card>

        <Card title="⚑ Policy conflicts flagged for the founder" subtitle="Where the case documents disagree, the system flags the call and doesn't invent a rule." className="lg:col-span-2">
          <div className="space-y-4">
            {POLICY_CONFLICTS.map((c) => (
              <div key={c.id} className="rounded-lg bg-surface-2 p-3 text-sm">
                <div className="font-semibold">{c.title}</div>
                <p className="mt-1 text-ink-2">{c.detail}</p>
                <p className="mt-1">
                  <span className="font-medium">Current handling:</span> <span className="text-ink-2">{c.handling}</span>
                </p>
                <p className="mt-1">
                  <span className="font-medium">Decision needed from:</span> <span className="text-ink-2">{c.needsDecisionFrom}</span>
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
