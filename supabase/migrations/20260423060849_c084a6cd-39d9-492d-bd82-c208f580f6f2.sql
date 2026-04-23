-- 1. Storage bucket for intake media (photos, videos, floor plans)
insert into storage.buckets (id, name, public)
values ('intake-media', 'intake-media', true)
on conflict (id) do nothing;

-- Public read for the bucket
create policy "Intake media is publicly readable"
on storage.objects for select
using (bucket_id = 'intake-media');

-- Anonymous-friendly write (no auth yet). Each session uses its own folder
-- ({session_id}/{filename}) so we can scope better later.
create policy "Anyone can upload intake media"
on storage.objects for insert
with check (bucket_id = 'intake-media');

create policy "Anyone can update intake media"
on storage.objects for update
using (bucket_id = 'intake-media');

create policy "Anyone can delete intake media"
on storage.objects for delete
using (bucket_id = 'intake-media');

-- 2. space_analyses table — stores the structured AI output
create table public.space_analyses (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  -- Snapshot of the intake data the analysis was run against
  intake jsonb not null,
  -- URLs of media used as input (derived from storage)
  media_urls jsonb not null default '[]'::jsonb,
  -- The AI result: { sections: [{key,title,description,items:[{text,basis}]}], summary, raw }
  result jsonb,
  status text not null default 'pending', -- pending | running | done | error
  error text,
  model text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index idx_space_analyses_session on public.space_analyses (session_id, created_at desc);

alter table public.space_analyses enable row level security;

-- Anonymous use for now. Tighten when auth lands.
create policy "Anyone can read space analyses"
on public.space_analyses for select using (true);

create policy "Anyone can create space analyses"
on public.space_analyses for insert with check (true);

create policy "Anyone can update space analyses"
on public.space_analyses for update using (true);

-- updated_at trigger
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = public;

create trigger trg_space_analyses_updated_at
before update on public.space_analyses
for each row execute function public.update_updated_at_column();