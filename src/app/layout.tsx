import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { getIntegrationStatus } from "@/lib/status";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aangan Studio · AI Receptionist",
  description: "Enquiry qualification, escalation and cost dashboard for Aangan Studio, Pune.",
};

export const dynamic = "force-dynamic";

function Pill({ live, label, title }: { live: boolean; label: string; title: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${live ? "border border-line text-good" : "bg-demo text-demo-ink"}`}>
      <span aria-hidden>{live ? "●" : "○"}</span>
      {label}
    </span>
  );
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const s = getIntegrationStatus();
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="border-b border-line bg-surface">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-bold text-brand-ink">A</div>
              <div className="leading-tight">
                <div className="text-sm font-semibold">Aangan Studio</div>
                <div className="text-xs text-muted">AI Receptionist</div>
              </div>
            </div>
            <Nav />
            <div className="flex flex-wrap gap-2 lg:ml-auto">
              <Pill live={s.storage.kind === "supabase"} label={s.storage.kind === "supabase" ? "Supabase" : "Local demo storage"} title={s.storage.detail} />
              <Pill live={s.telegram.live} label={s.telegram.label} title={s.telegram.detail} />
              <Pill live={s.vaani.live} label={s.vaani.label} title={s.vaani.detail} />
              <Pill live={s.hubspot.live} label={s.hubspot.label} title={s.hubspot.detail} />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
        <footer className="mx-auto max-w-7xl px-4 pb-8 text-xs text-muted sm:px-6">
          MVP for the Mesa School of Business Case 03. Records marked “Demo seed” or “Simulated” are not real phone calls.
        </footer>
      </body>
    </html>
  );
}
