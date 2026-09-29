-- JD — RÉCONCILIATION base ↔ code (2026-09-04). Applique les 2 sections du schéma jamais lancées en prod,
-- seules absences que le CODE référence : (26) modération events, (27) live streaming.
-- Idempotent : rejouable sans risque. Backend seul → AUCUN redéploiement. SQL Editor → Run.

-- ============================================================
-- 26) ÉVÉNEMENTS PARTENAIRES + MODÉRATION (débloque l'inscription + le chargement des events)
-- ============================================================
create or replace function public.is_staff()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and roles && array['admin', 'organizer', 'staff']::text[]
  );
$$;

alter table public.events add column if not exists moderation text not null default 'approved';

drop policy if exists "events_read" on public.events;
create policy "events_read" on public.events for select to authenticated
  using (moderation = 'approved' or organizer_id = auth.uid() or public.is_admin());

create or replace function public.trg_event_submit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then
    new.tier := 'partner';
    new.moderation := 'pending';
    new.status := 'upcoming';
  end if;
  return new;
end $$;
drop trigger if exists trg_event_submit on public.events;
create trigger trg_event_submit before insert on public.events
  for each row execute function public.trg_event_submit();

create or replace function public.trg_event_protect()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    new.moderation := old.moderation;
    new.tier := old.tier;
  end if;
  return new;
end $$;
drop trigger if exists trg_event_protect on public.events;
create trigger trg_event_protect before update on public.events
  for each row execute function public.trg_event_protect();

-- ============================================================
-- 27) LIVE STREAMING (débloque l'écran Direct / Watch)
-- ============================================================
create table if not exists public.live_streams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete set null,
  title text not null default 'Direct Juste Debout',
  provider text not null default 'bunny',
  playback_url text,
  status text not null default 'idle',
  started_at timestamptz,
  ended_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_live_status on public.live_streams(status);

alter table public.live_streams enable row level security;
drop policy if exists "live_read" on public.live_streams;
create policy "live_read" on public.live_streams for select to authenticated using (true);
drop policy if exists "live_write" on public.live_streams;
create policy "live_write" on public.live_streams for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create or replace function public.active_live()
returns setof public.live_streams
language sql security definer stable set search_path = public as $$
  select * from public.live_streams
  where status = 'live'
  order by started_at desc nulls last
  limit 1;
$$;

notify pgrst, 'reload schema';
