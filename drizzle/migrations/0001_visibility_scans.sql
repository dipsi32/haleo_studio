-- Visibility scans: a dated snapshot of where a contractor shows up when a
-- homeowner searches for a general contractor or a remodel in their city.
-- Written only by the visibility-scan edge function (service role). A
-- contractor can read their own scans and nothing else.

create table if not exists public.visibility_scans (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  created_at timestamptz not null default now(),
  city text,
  results jsonb not null
);

create index if not exists visibility_scans_contractor_created_idx
  on public.visibility_scans (contractor_id, created_at desc);

grant select on public.visibility_scans to authenticated;
grant all on public.visibility_scans to service_role;

alter table public.visibility_scans enable row level security;

drop policy if exists "Contractor reads own visibility scans" on public.visibility_scans;
create policy "Contractor reads own visibility scans"
  on public.visibility_scans for select to authenticated
  using (
    exists (
      select 1 from public.contractor_accounts ca
      where ca.contractor_id = visibility_scans.contractor_id
        and ca.user_id = auth.uid()
    )
  );