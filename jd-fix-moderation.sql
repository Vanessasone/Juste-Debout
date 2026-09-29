-- JD — CORRECTIF : colonne events.moderation manquante en base (casse l'inscription + le chargement des events).
-- Applique la section « Événements partenaires + modération » du schéma (jamais lancée en prod).
-- Idempotent : rejouable sans risque. À lancer dans Supabase → SQL Editor → Run.

-- Staff JD (officiel) : admin / organizer / staff.
create or replace function public.is_staff()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and roles && array['admin', 'organizer', 'staff']::text[]
  );
$$;

-- Statut de modération (les events existants restent 'approved').
alter table public.events add column if not exists moderation text not null default 'approved';

-- Lecture : public seulement si approuvé ; l'organisateur voit les siens ; l'admin voit tout.
drop policy if exists "events_read" on public.events;
create policy "events_read" on public.events for select to authenticated
  using (moderation = 'approved' or organizer_id = auth.uid() or public.is_admin());

-- À la création par un non-staff → événement partenaire en attente.
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

-- Seul un admin peut changer la modération ou le niveau (anti auto-validation).
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

notify pgrst, 'reload schema';
