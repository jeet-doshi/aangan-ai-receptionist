"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function run(url: string, describe: (body: Record<string, unknown>) => string | { ok: boolean; text: string }) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(url, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (res.ok && body.ok !== false) {
        const d = describe(body);
        setMsg(typeof d === "string" ? { ok: true, text: d } : d);
      } else setMsg({ ok: false, text: String(body.error ?? `Request failed (${res.status})`) });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }
  return { busy, msg, run };
}

const btn = "rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-brand-ink disabled:opacity-60";

function Msg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return <p className={`mt-2 text-sm ${msg.ok ? "text-good" : "text-critical"}`}>{msg.text}</p>;
}

export function ReseedButton({ label = "Reset demo seed data" }: { label?: string }) {
  const { busy, msg, run } = useAction();
  return (
    <div>
      <button className={btn} disabled={busy} onClick={() => run("/api/demo/reseed", (b) => `Loaded ${b.count} demo-seed records. Simulated and real calls were not touched.`)}>
        {busy ? "Working…" : label}
      </button>
      <Msg msg={msg} />
    </div>
  );
}

export function TelegramTestButton({ enabled }: { enabled: boolean }) {
  const { busy, msg, run } = useAction();
  return (
    <div>
      <button className={btn} disabled={busy || !enabled} onClick={() => run("/api/integrations/telegram-test", () => "Telegram confirmed delivery of the test message.")}>
        {busy ? "Sending…" : "Send Telegram test message"}
      </button>
      {!enabled && <p className="mt-2 text-xs text-muted">Disabled until Telegram credentials are set.</p>}
      <Msg msg={msg} />
    </div>
  );
}

export function RetryHandoffButton({ id }: { id: string }) {
  const { busy, msg, run } = useAction();
  return (
    <div>
      <button className={btn} disabled={busy} onClick={() => run(`/api/calls/${id}/handoff`, (b) => (b.handoff_status === "sent" ? "Sent: Telegram confirmed delivery." : { ok: false, text: `Not delivered: ${String(b.handoff_detail)}` }))}>
        {busy ? "Sending…" : "Retry Telegram handoff"}
      </button>
      <Msg msg={msg} />
    </div>
  );
}

export function SyncCrmButton({ id, label = "Sync to HubSpot" }: { id: string; label?: string }) {
  const { busy, msg, run } = useAction();
  return (
    <div>
      <button
        className={btn}
        disabled={busy}
        onClick={() => run(`/api/calls/${id}/crm`, (b) => (b.crm_status === "synced" ? "Saved in HubSpot: HubSpot confirmed it." : { ok: false, text: `Not synced: ${String(b.crm_detail)}` }))}
      >
        {busy ? "Syncing…" : label}
      </button>
      <Msg msg={msg} />
    </div>
  );
}

export function HubSpotTestButton({ enabled }: { enabled: boolean }) {
  const { busy, msg, run } = useAction();
  return (
    <div>
      <button className={btn} disabled={busy || !enabled} onClick={() => run("/api/integrations/hubspot-test", (b) => `Connected to HubSpot account ${String(b.portalId)}. Nothing was created.`)}>
        {busy ? "Checking…" : "Test HubSpot connection"}
      </button>
      {!enabled && <p className="mt-2 text-xs text-muted">Disabled until HUBSPOT_ACCESS_TOKEN is set.</p>}
      <Msg msg={msg} />
    </div>
  );
}
