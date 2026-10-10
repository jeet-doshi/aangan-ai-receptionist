-- Adds HubSpot CRM sync status to call records. Safe to run more than once.
alter table public.calls add column if not exists crm_status text not null default 'not_required'
  check (crm_status in ('not_required', 'synced', 'failed', 'not_configured'));
alter table public.calls add column if not exists crm_detail text;
alter table public.calls add column if not exists crm_contact_id text;
