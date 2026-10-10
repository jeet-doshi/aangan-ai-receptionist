# Aangan Studio: AI Receptionist (MVP)

MVP for **Mesa School of Business, Case 03 (Nikhil: Unanswered Enquiries)**.
Every phone enquiry is answered, qualified against Nikhil's own rubric (`qualified.md`), and routed. Qualified leads and urgent escalations go to the team with a complete handoff note. A dashboard shows what the system generates and what it costs.

> **What's real and what's demo.** Every record has a source badge.
> **Demo seed**: the 19 Sep 2026 phone transcripts from the case, replayed through the AI rules (originally handled by the human front desk).
> **Simulated**: calls you create in the app.
> **Real call (Vaani)**: only calls delivered by the Vaani webhook.
> A handoff is shown as **Sent** only when Telegram's API confirms delivery.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000. No setup is needed: without credentials the app uses local demo storage (`.data/calls.json`) and a labelled demo handoff.

```bash
npm test          # 19 tests: rules vs all case transcripts, pricing guard, webhook auth
npm run build     # production build
```

## 2-minute demo script

1. **Dashboard**: 19 demo calls: 8 qualified, 6 declined, 3 awaiting one follow-up question, 2 escalations. Show the funnel, calls per day, cost per call / per qualified lead, and why enquiries were declined.
2. **Simulate a call → "Qualified lead" → Run.** The caller asked about pricing and got the approved line, never a figure. The handoff note was prepared; it's marked *Demo: not sent* until Telegram is connected.
3. **Simulate → "Urgent escalation" → Run.** An existing client reports a leak and an unresponsive designer. Result: *Human review* + ⚠ Escalation, never "unqualified".
4. **Simulate → "Timeline conflict".** An 8-week deadline falls where the case documents disagree, so it's flagged for a designer instead of being silently decided.
5. **Call records → open T09** (Sheetal, existing client) to show criteria, the receptionist's reply, and the full handoff note.
6. **Integrations & policy**: what's live vs demo, the pricing policy, and the conflicts flagged for Nikhil.

## Qualification rules (from the case documents)

| Rule | Source | Implementation |
|---|---|---|
| Existing-client complaint, unresponsive designer, urgent service failure, urgent request for a human | brief + T09/T16 | `needs_human_review`, `escalation_required = true`. Checked **first**, so it can never become an "unqualified lead" |
| 1. Real design + execution project | qualified.md, services.md | Residential (any size); office/clinic/studio up to ~3,000 sq ft. Declines structural, decor-only, advice-only, furniture-only, Vastu-only, restaurant, hotel, retail, gym |
| 2. Pune city / PCMC | services.md | Locality list; Talegaon, Lonavala, Nashik, Mumbai etc. declined |
| 3. Realistic timeline | services.md | < 6 weeks declined; see conflict below |
| 4. Budget (only if volunteered) | qualified.md | Not mentioned → passes. Volunteered and clearly below any realistic cost → fails. Never probed, never quoted |
| 5. Decision-maker | qualified.md | "Only researching for someone else" fails; unknown → passes with a note |
| Unclear on 1, 2 or 3 | qualified.md | One direct question (`needs_follow_up`) |
| Unclear on 4 or 5 | qualified.md | Treated as qualified; uncertainty written into the handoff note |
| One criterion fails | qualified.md | Specific, graceful decline |
| Two or more fail | qualified.md | Standard decline: "This sounds like it may not be the right fit for us right now…" |
| Pricing | pricing.md | Only the approved response. Every reply passes a **pricing guard**: any ₹/lakh/per-sq-ft text is replaced with the approved line |

The engine (`src/lib/qualify.ts`) is deterministic. It costs ₹0 per call, behaves the same every time, and every decision is explained criterion by criterion.

### ⚑ Conflicts flagged, not resolved

1. **Timeline.** `services.md` allows anything ≥ 6 weeks, yet its own design (3–4 wk) + execution (8–16 wk) figures imply at least 11 weeks. `qualified.md` and transcript T07 say 8–10 weeks. **Handling:** < 6 weeks declined (all sources agree); 6 to under 11 weeks → *human review: timeline rule conflict*; ≥ 11 weeks or flexible → passes. **Nikhil needs to pick one rule.**
2. **Commercial minimum.** Not in `services.md`; the front desk declined a 180 sq ft pod in T18 ("typically 500 sq ft or more"). Applied as a 500 sq ft minimum and flagged.
3. **The founder's ask to quote per-sq-ft pricing** is deliberately not built: `pricing.md` says no number may be quoted (this is "the Cut").

## Integrations

All credentials go in `.env.local` (git-ignored). `.env.example` lists every variable with placeholders.

### Supabase (persistent storage)
1. In Supabase → SQL Editor, run `supabase/schema.sql`.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY` (Project Settings → API; secret/service-role key, server-only).
3. Restart, then go to **Integrations → Reset demo seed data** to load the demo records.

Without these, data is stored in `.data/calls.json`. On Vercel without Supabase, data goes to `/tmp` and **resets on cold starts**, so configure Supabase for any shared deployment.

### Telegram (designer handoff)
1. Telegram → @BotFather → `/newbot` → copy the token.
2. Add the bot to the designers' group and send a message in it.
3. Open `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy `chat.id` (group ids are negative).
4. Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (optional `TELEGRAM_ESCALATION_CHAT_ID`), restart, then use **Integrations → Send Telegram test message**.

Existing records can be re-sent from their detail page (**Retry Telegram handoff**).

**Why Telegram over email:** designers are on their phones on site. A Telegram group gives instant push, is shared by the whole team (no lead sits in one person's inbox), the bot is free, and setup takes 5 minutes. Email suits a formal record, but it's slower to notice, which defeats the "answered within the hour converts 4×" insight.

### Vaani Voice (live calls)
The post-call webhook is at `POST /api/webhooks/vaani`. It needs a public HTTPS URL, so use the Vercel deployment.
- Set `VAANI_WEBHOOK_SECRET` to a long random string.
- Authenticate with header `x-webhook-secret: <secret>`, `Authorization: Bearer <secret>`, `?secret=<secret>`, **or** an HMAC-SHA256 signature of the raw body in `X-VaaniYantra-Signature` / `x-signature` (`sha256=<hex>`).
- Have the agent collect these fields (top level or nested under `data` / `extracted_data` / `analysis` / `variables`): `caller_name, caller_type, project_type, area_sqft, location, timeline, deadline_weeks, budget, decision_maker, pricing_asked, urgent_human_request, notes`, plus `duration_sec`, `transcript`, and optionally `cost`. Free-text values are mapped (e.g. "2BHK full home" → residential full).
- `call.failed` / busy / no-answer events are ignored. Payloads with `"test": true` are stored as simulated.

**Status:** the endpoint, auth and mapping are covered by tests and were exercised locally over HTTP. It has **not** been verified against a live Vaani payload, because Vaani's exact schema wasn't available. No phone number was purchased and no paid telephony was enabled.

### Cost model
Costs come from provider-reported figures when the webhook sends them. Otherwise they're estimated from `VOICE_COST_PER_MIN_INR` (default ₹4, a placeholder) and `AI_COST_PER_CALL_INR` (default ₹1, a placeholder). Set your real Vaani rates. The dashboard labels estimated costs.

## Deploy to Vercel
1. Push this folder to a GitHub repo and import it in Vercel (framework auto-detected).
2. Add the environment variables from `.env.example` in Vercel → Settings → Environment Variables (at minimum Supabase, for persistence).
3. Deploy. Set `APP_BASE_URL` to the deployment URL so Telegram notes link to the record.

## Extending to WhatsApp and the web form (out of scope here)
Both channels can call the same `createCall()` service: a WhatsApp Business webhook and a form POST handler map their fields into `CallInput` and reuse the same rules, handoff and dashboard. Add a `channel` column to compare channels.

## Project structure
```
src/lib/policy.ts      Studio rules, approved wording, conflicts (traceable to case docs)
src/lib/qualify.ts     Deterministic qualification + escalation + pricing guard
src/lib/seed-data.ts   19 case transcripts as structured demo inputs
src/lib/calls.ts       qualify → store → Telegram handoff → record true status
src/lib/handoff.ts     Telegram message + delivery
src/lib/vaani.ts       Webhook payload mapper + auth
src/lib/store.ts       Supabase or local-file storage
src/app/               Dashboard, call records, simulator, integrations, API routes
tests/                 Rule and webhook tests
```
