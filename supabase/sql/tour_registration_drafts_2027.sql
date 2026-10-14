-- Preparation only: this table never creates a confirmed registration or a ticket.
-- Apply before deploying /tour-register. Existing registrations and ticketing untouched.
begin;
create table if not exists public.tour_registration_drafts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  stop_slug text not null check (stop_slug in ('chongqing','tokyo','milan','netherlands','liege','london','paris')),
  category text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  unique (profile_id,stop_slug,category),
  check (jsonb_typeof(payload) = 'object'),
  check ((payload->>'stop') is not distinct from stop_slug),
  check ((payload->>'category') is not distinct from category),
  check ((payload->>'consent') is not distinct from 'true'),
  check (jsonb_typeof(payload->'dancers') is not distinct from 'array'),
  check (jsonb_array_length(payload->'dancers') = case when category='Junior Dance Tour' then 1 else 2 end),
  check (category in ('Locking','Popping','House','Hip Hop','Afro','Dancehall','Electro','Krump','Junior Dance Tour')),
  check (case when stop_slug='paris' then true
    when stop_slug='london' then category in ('Hip Hop','Popping','Afro','Krump')
    when stop_slug in ('chongqing','milan') then category in ('Locking','Popping','House','Hip Hop','Junior Dance Tour')
    else category in ('Locking','Popping','House','Hip Hop') end),
  check (category <> 'Junior Dance Tour' or (
    (payload->'dancers'->0->>'birthDate') is not null
    and (payload->'dancers'->0->>'birthDate')::date between date '2012-03-14' and date '2021-03-13'
    and (payload->>'guardianConsent') is not distinct from 'true'
    and length(trim(coalesce(payload->>'guardianName',''))) > 0
    and length(trim(coalesce(payload->>'guardianEmail',''))) > 0
    and length(trim(coalesce(payload->>'guardianPhone',''))) > 0
  ))
);
alter table public.tour_registration_drafts enable row level security;
revoke all on public.tour_registration_drafts from anon, authenticated;
grant select,insert,update on public.tour_registration_drafts to authenticated;
create policy tour_drafts_read_own on public.tour_registration_drafts for select to authenticated using ((select auth.uid())=profile_id);
create policy tour_drafts_insert_own on public.tour_registration_drafts for insert to authenticated with check ((select auth.uid())=profile_id);
create policy tour_drafts_update_own on public.tour_registration_drafts for update to authenticated using ((select auth.uid())=profile_id) with check ((select auth.uid())=profile_id);
-- No organizer visibility for private drafts. Finalized entries will use event-scoped access.
commit;
