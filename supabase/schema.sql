-- ============================================================
-- Juste Debout — JD Live · Schéma Phase 1 (INSCRIPTION)
-- À exécuter dans Supabase → SQL Editor → New query → Run.
-- Idempotent : peut être relancé sans risque.
-- ============================================================

-- 1) PROFILS (étend auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  alias text,
  country text,
  city text,
  photo_url text,
  roles text[] not null default array['spectator'], -- spectator | dancer | judge | organizer | staff | admin
  styles text[] default '{}',
  level text,
  bio text,
  instagram text,
  created_at timestamptz not null default now()
);

-- Création automatique du profil à chaque nouvelle inscription (auth.users)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) SAISONS
create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  year int not null unique,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

-- 3) CATÉGORIES (disciplines de la saison)
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  name text not null,
  format text not null default '2v2', -- '1v1' | '2v2'
  family text,                        -- 'classic' | 'afro' | 'junior'
  sort_order int default 0,
  unique (season_id, name)
);
alter table public.categories add column if not exists family text;

-- 4) ÉVÉNEMENTS (présélections + finale)
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  season_id uuid references public.seasons(id) on delete set null,
  title text not null,
  city text,
  country text,
  venue text,
  starts_on date,
  ends_on date,
  organizer_id uuid references public.profiles(id) on delete set null,
  capacity int,
  status text not null default 'upcoming', -- upcoming | preselection | live | done
  tickets_open boolean not null default false, -- billetterie ouverte ?
  created_at timestamptz not null default now(),
  unique (title)
);
-- (idempotent, pour les bases déjà créées)
alter table public.events add column if not exists tickets_open boolean not null default false;
alter table public.events add column if not exists hub_date_id uuid unique; -- lien vers JD Hub Partners (sync)

-- 5) INSCRIPTIONS
create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,                -- 'dancer' | 'spectator'
  category_id uuid references public.categories(id) on delete set null,
  partner_id uuid references public.profiles(id) on delete set null, -- pour les duos (2vs2)
  status text not null default 'registered', -- registered | confirmed | paid | cancelled
  payment_method text,               -- 'online' | 'cash' | null
  bib_number int,
  consent_rgpd boolean not null default false,
  created_at timestamptz not null default now(),
  unique (event_id, profile_id, type)
);

-- ============================================================
-- INDEX (performance à grande échelle — millions d'utilisateurs)
-- ============================================================
create index if not exists idx_categories_season   on public.categories(season_id);
create index if not exists idx_events_season        on public.events(season_id);
create index if not exists idx_events_organizer     on public.events(organizer_id);
create index if not exists idx_reg_event            on public.registrations(event_id);
create index if not exists idx_reg_profile          on public.registrations(profile_id);
create index if not exists idx_reg_category         on public.registrations(category_id);
create index if not exists idx_reg_partner          on public.registrations(partner_id);
create index if not exists idx_profiles_country     on public.profiles(country);
create index if not exists idx_profiles_styles      on public.profiles using gin(styles);
create index if not exists idx_profiles_roles       on public.profiles using gin(roles);

-- ============================================================
-- SÉCURITÉ (Row Level Security)
-- ============================================================
alter table public.profiles      enable row level security;
alter table public.seasons       enable row level security;
alter table public.categories    enable row level security;
alter table public.events        enable row level security;
alter table public.registrations enable row level security;

-- Profils : annuaire lisible par tous les connectés ; chacun modifie le sien
drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read" on public.profiles
  for select to authenticated using (true);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id);

-- Saisons / catégories / événements : lecture publique (connectés)
drop policy if exists "seasons_read" on public.seasons;
create policy "seasons_read" on public.seasons for select to authenticated using (true);
drop policy if exists "categories_read" on public.categories;
create policy "categories_read" on public.categories for select to authenticated using (true);
drop policy if exists "events_read" on public.events;
create policy "events_read" on public.events for select to authenticated using (true);

-- Inscriptions : chacun gère les siennes ; l'organisateur voit celles de ses événements
drop policy if exists "reg_insert_own" on public.registrations;
create policy "reg_insert_own" on public.registrations
  for insert to authenticated with check (auth.uid() = profile_id);
drop policy if exists "reg_read_own" on public.registrations;
create policy "reg_read_own" on public.registrations
  for select to authenticated using (auth.uid() = profile_id);
drop policy if exists "reg_update_own" on public.registrations;
create policy "reg_update_own" on public.registrations
  for update to authenticated using (auth.uid() = profile_id);
drop policy if exists "reg_organizer_read" on public.registrations;
create policy "reg_organizer_read" on public.registrations
  for select to authenticated using (
    exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid())
  );

-- ============================================================
-- DONNÉES DE DÉPART — Saison 2026 + disciplines + finale
-- ============================================================
insert into public.seasons (id, year, is_active)
values ('00000000-0000-0000-0000-000000000026', 2026, true)
on conflict (year) do nothing;

insert into public.categories (season_id, name, format, family, sort_order) values
  ('00000000-0000-0000-0000-000000000026','Hip-Hop','2v2','classic',1),
  ('00000000-0000-0000-0000-000000000026','Locking','2v2','classic',2),
  ('00000000-0000-0000-0000-000000000026','Popping','2v2','classic',3),
  ('00000000-0000-0000-0000-000000000026','House','2v2','classic',4),
  ('00000000-0000-0000-0000-000000000026','Afro','2v2','afro',5),
  ('00000000-0000-0000-0000-000000000026','Dancehall','2v2','afro',6),
  ('00000000-0000-0000-0000-000000000026','Krump','2v2','afro',7),
  ('00000000-0000-0000-0000-000000000026','Electro','2v2','afro',8),
  ('00000000-0000-0000-0000-000000000026','Junior Dance Tour','1v1','junior',9)
on conflict (season_id, name) do update
  set format = excluded.format, family = excluded.family, sort_order = excluded.sort_order;

-- Retrait de l'ancienne catégorie Experimental (n'existe plus)
delete from public.categories
where season_id = '00000000-0000-0000-0000-000000000026' and name = 'Experimental';

-- Présélection Paris 2027 (4 mars, Juste Debout School Industry)
insert into public.events (season_id, title, city, country, venue, starts_on, ends_on, status, tier, tickets_open)
values (
  '00000000-0000-0000-0000-000000000026',
  'Présélection Paris 2027','Paris','France','Juste Debout School Industry',
  '2027-03-04','2027-03-04','upcoming','preselection', false
)
on conflict (title) do update set
  city = excluded.city, country = excluded.country, venue = excluded.venue,
  starts_on = excluded.starts_on, ends_on = excluded.ends_on,
  status = excluded.status, tier = excluded.tier, tickets_open = excluded.tickets_open;

-- Finales Mondiales Paris 2027 (5-6 mars, Stade Pierre de Coubertin — billetterie pas encore ouverte)
insert into public.events (season_id, title, city, country, venue, starts_on, ends_on, status, tier, tickets_open)
values (
  '00000000-0000-0000-0000-000000000026',
  'Juste Debout — Finales Mondiales 2027','Paris','France','Stade Pierre de Coubertin',
  '2027-03-05','2027-03-06','upcoming','official', false
)
on conflict (title) do update set
  city = excluded.city, country = excluded.country, venue = excluded.venue,
  starts_on = excluded.starts_on, ends_on = excluded.ends_on,
  status = excluded.status, tier = excluded.tier, tickets_open = excluded.tickets_open;

-- ============================================================
-- 6) CATÉGORIES PAR ÉVÉNEMENT
--    Chaque présélection / finale propose SON sous-ensemble de disciplines.
-- ============================================================
create table if not exists public.event_categories (
  event_id uuid references public.events(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade,
  primary key (event_id, category_id)
);
alter table public.event_categories enable row level security;
drop policy if exists "event_categories_read" on public.event_categories;
create policy "event_categories_read" on public.event_categories
  for select to authenticated using (true);

-- La finale 2026 propose toutes les disciplines de la saison (modifiable par événement)
insert into public.event_categories (event_id, category_id)
select e.id, c.id
from public.events e
join public.categories c on c.season_id = e.season_id
where e.title = 'Juste Debout World Final 2026'
on conflict do nothing;

-- ============================================================
-- 7) PHOTOS — champ officiel + stockage (bucket public « photos »)
-- ============================================================
alter table public.profiles add column if not exists official_photo_url text;

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

-- Lecture publique des photos
drop policy if exists "photos_read" on storage.objects;
create policy "photos_read" on storage.objects
  for select using (bucket_id = 'photos');

-- Chacun gère les fichiers de SON dossier (préfixe = son user id)
drop policy if exists "photos_insert_own" on storage.objects;
create policy "photos_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "photos_update_own" on storage.objects;
create policy "photos_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- 8) ACCÈS ADMIN — lecture de toutes les inscriptions
-- ============================================================
drop policy if exists "reg_admin_read" on public.registrations;
create policy "reg_admin_read" on public.registrations
  for select to authenticated using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and 'admin' = any(p.roles))
  );

-- ============================================================
-- 9) PHOTOS OFFICIELLES — l'admin peut écrire le profil/le dossier d'un danseur
--    (fonction security definer pour éviter la récursion RLS sur profiles)
-- ============================================================
create or replace function public.is_admin()
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and 'admin' = any(roles));
$$;

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
  for update to authenticated using (public.is_admin());

-- Anti-escalade de privilèges : un non-admin ne peut PAS modifier ses propres rôles.
-- (La policy profiles_update_own autorise l'update de sa ligne, mais ce trigger restaure
--  roles depuis l'ancienne valeur — seul un admin peut promouvoir/rétrograder.)
create or replace function public.trg_profile_protect()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() null = contexte serveur de confiance (SQL Editor / service_role / edge function) → autorisé.
  -- Sinon (requête client), seul un admin peut changer les rôles ; un non-admin voit roles restauré.
  if auth.uid() is not null and not public.is_admin() then
    new.roles := old.roles;
  end if;
  return new;
end $$;
drop trigger if exists trg_profile_protect on public.profiles;
create trigger trg_profile_protect before update on public.profiles
  for each row execute function public.trg_profile_protect();

drop policy if exists "photos_admin_insert" on storage.objects;
create policy "photos_admin_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'photos' and public.is_admin());

drop policy if exists "photos_admin_update" on storage.objects;
create policy "photos_admin_update" on storage.objects
  for update to authenticated using (bucket_id = 'photos' and public.is_admin());

-- ============================================================
-- 10) VOTE DES JUGES — juges de saison, passages, votes pondérés
-- ============================================================
create or replace function public.is_judge()
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and 'judge' = any(roles));
$$;

-- Juges de la saison + leur discipline "maison" (vote ×2 sur celle-ci)
create table if not exists public.season_judges (
  season_id uuid references public.seasons(id) on delete cascade,
  judge_id uuid references public.profiles(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  primary key (season_id, judge_id)
);

-- Passages (rencontres) — couleurs configurables (défaut : vert lime / rose fuchsia)
create table if not exists public.passages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  round text,
  side_a_name text not null default 'Côté A',
  side_b_name text not null default 'Côté B',
  side_a_color text not null default '#A4FA00',
  side_b_color text not null default '#FF2D9E',
  side_a_photo text,
  side_b_photo text,
  status text not null default 'draft', -- draft | open | locked | revealed
  winner text,                          -- 'a' | 'b' | 'tie'
  created_at timestamptz not null default now()
);

-- Votes des juges (un seul par juge et par passage)
create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  passage_id uuid references public.passages(id) on delete cascade,
  judge_id uuid references public.profiles(id) on delete cascade,
  choice text not null,        -- 'a' | 'b'
  weight int not null default 1,
  created_at timestamptz not null default now(),
  unique (passage_id, judge_id)
);
create index if not exists idx_votes_passage on public.votes(passage_id);
create index if not exists idx_passages_event on public.passages(event_id);

-- Pondération calculée CÔTÉ SERVEUR : ×2 si la discipline du juge = celle du passage
create or replace function public.set_vote_weight()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_passage_cat uuid; v_season uuid; v_judge_cat uuid;
begin
  select p.category_id, e.season_id into v_passage_cat, v_season
    from public.passages p join public.events e on e.id = p.event_id
    where p.id = new.passage_id;
  select sj.category_id into v_judge_cat
    from public.season_judges sj
    where sj.judge_id = new.judge_id and sj.season_id = v_season;
  new.weight := case when v_judge_cat is not null and v_judge_cat = v_passage_cat then 2 else 1 end;
  return new;
end; $$;
drop trigger if exists trg_set_vote_weight on public.votes;
create trigger trg_set_vote_weight before insert on public.votes
  for each row execute function public.set_vote_weight();

-- RLS
alter table public.season_judges enable row level security;
alter table public.passages      enable row level security;
alter table public.votes         enable row level security;

-- Juges de saison : lisibles par tous les connectés ; gérés par l'admin
drop policy if exists "sj_read" on public.season_judges;
create policy "sj_read" on public.season_judges for select to authenticated using (true);
drop policy if exists "sj_admin" on public.season_judges;
create policy "sj_admin" on public.season_judges for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Passages : lisibles par tous (résultats live) ; créés/pilotés par l'admin (régie/MC)
drop policy if exists "passages_read" on public.passages;
create policy "passages_read" on public.passages for select to authenticated using (true);
drop policy if exists "passages_admin" on public.passages;
create policy "passages_admin" on public.passages for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Votes : un juge insère SON vote sur un passage OUVERT ; lecture par admin + le juge lui-même
drop policy if exists "votes_insert_judge" on public.votes;
create policy "votes_insert_judge" on public.votes for insert to authenticated
  with check (
    judge_id = auth.uid() and public.is_judge()
    and exists (select 1 from public.passages p where p.id = passage_id and p.status = 'open')
  );
drop policy if exists "votes_read" on public.votes;
create policy "votes_read" on public.votes for select to authenticated
  using (judge_id = auth.uid() or public.is_admin());

-- ============================================================
-- 11) BRACKET — arbre de tournoi + avancement auto du gagnant
-- ============================================================
create table if not exists public.brackets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  title text,
  size int not null default 8,       -- 8 | 16 | 32
  created_at timestamptz not null default now()
);

-- Colonnes bracket sur les passages
alter table public.passages add column if not exists bracket_id uuid references public.brackets(id) on delete cascade;
alter table public.passages add column if not exists round_no int;
alter table public.passages add column if not exists position int;
alter table public.passages add column if not exists next_passage_id uuid references public.passages(id) on delete set null;
alter table public.passages add column if not exists next_slot text; -- 'a' | 'b'
create index if not exists idx_passages_bracket on public.passages(bracket_id);

-- Avancement auto : quand un gagnant est révélé, il monte dans le passage suivant
create or replace function public.advance_winner() returns trigger
language plpgsql security definer set search_path=public as $$
declare w_name text; w_photo text;
begin
  if new.winner in ('a','b')
     and (old.winner is distinct from new.winner)
     and new.next_passage_id is not null then
    if new.winner='a' then w_name := new.side_a_name; w_photo := new.side_a_photo;
    else w_name := new.side_b_name; w_photo := new.side_b_photo; end if;
    if new.next_slot='a' then
      update public.passages set side_a_name=w_name, side_a_photo=w_photo where id=new.next_passage_id;
    else
      update public.passages set side_b_name=w_name, side_b_photo=w_photo where id=new.next_passage_id;
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists trg_advance_winner on public.passages;
create trigger trg_advance_winner after update on public.passages
  for each row execute function public.advance_winner();

alter table public.brackets enable row level security;
drop policy if exists "brackets_read" on public.brackets;
create policy "brackets_read" on public.brackets for select to authenticated using (true);
drop policy if exists "brackets_admin" on public.brackets;
create policy "brackets_admin" on public.brackets for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- 12) PAYS PAR CÔTÉ (drapeaux) — suit le gagnant à l'avancement
-- ============================================================
alter table public.passages add column if not exists side_a_country text; -- code ISO 2 lettres (FR, GB…)
alter table public.passages add column if not exists side_b_country text;

create or replace function public.advance_winner() returns trigger
language plpgsql security definer set search_path=public as $$
declare w_name text; w_photo text; w_country text;
begin
  if new.winner in ('a','b')
     and (old.winner is distinct from new.winner)
     and new.next_passage_id is not null then
    if new.winner='a' then
      w_name:=new.side_a_name; w_photo:=new.side_a_photo; w_country:=new.side_a_country;
    else
      w_name:=new.side_b_name; w_photo:=new.side_b_photo; w_country:=new.side_b_country;
    end if;
    if new.next_slot='a' then
      update public.passages set side_a_name=w_name, side_a_photo=w_photo, side_a_country=w_country
        where id=new.next_passage_id;
    else
      update public.passages set side_b_name=w_name, side_b_photo=w_photo, side_b_country=w_country
        where id=new.next_passage_id;
    end if;
  end if;
  return new;
end; $$;

-- ============================================================
-- 13) RÉPERTOIRE D'ÉQUIPES — réutilisables d'une présélection à la finale
-- ============================================================
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  season_id uuid references public.seasons(id) on delete set null,
  name text not null,
  country text,            -- code ISO 2 lettres
  photo_url text,
  created_at timestamptz not null default now()
);
create index if not exists idx_teams_name on public.teams(name);

alter table public.teams enable row level security;
drop policy if exists "teams_read" on public.teams;
create policy "teams_read" on public.teams for select to authenticated using (true);
drop policy if exists "teams_admin" on public.teams;
create policy "teams_admin" on public.teams for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- 14) BILLETS — portefeuille QR + contrôle d'entrée
-- ============================================================
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  type text not null default 'spectator',       -- spectator | participant | day | full | vip
  status text not null default 'active',         -- active | used | cancelled
  qr_token text not null unique default gen_random_uuid()::text,
  payment_method text,                           -- free | cash | online
  created_at timestamptz not null default now(),
  used_at timestamptz,
  scanned_by uuid references public.profiles(id) on delete set null,
  unique (event_id, profile_id, type)
);
create index if not exists idx_tickets_profile on public.tickets(profile_id);
create index if not exists idx_tickets_token on public.tickets(qr_token);

alter table public.tickets enable row level security;
-- Chacun voit et crée ses billets
drop policy if exists "tickets_read_own" on public.tickets;
create policy "tickets_read_own" on public.tickets for select to authenticated using (profile_id = auth.uid());
-- Un utilisateur ne peut s'auto-créer QU'un billet spectateur gratuit.
-- Les billets payants (day/full/vip) sont créés côté serveur après paiement (Stripe), jamais depuis le client.
drop policy if exists "tickets_insert_own" on public.tickets;
create policy "tickets_insert_own" on public.tickets for insert to authenticated
  with check (
    profile_id = auth.uid()
    and type = 'spectator'
    and coalesce(payment_method, 'free') = 'free'
    and exists (select 1 from public.events e where e.id = event_id and e.tickets_open = true)
  );
-- Le staff/admin lit et met à jour tous les billets (scanner d'entrée)
drop policy if exists "tickets_admin_all" on public.tickets;
create policy "tickets_admin_all" on public.tickets for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Rôle « scanner » dédié : contrôle d'entrée (lecture + validation des billets) sans autres pouvoirs staff.
create or replace function public.is_scanner()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and roles && array['scanner', 'staff', 'organizer', 'admin']::text[]
  );
$$;
drop policy if exists "tickets_scan_read" on public.tickets;
create policy "tickets_scan_read" on public.tickets for select to authenticated
  using (public.is_scanner());
drop policy if exists "tickets_scan_update" on public.tickets;
create policy "tickets_scan_update" on public.tickets for update to authenticated
  using (public.is_scanner()) with check (public.is_scanner());

-- ============================================================
-- 15) JD SCHOOL — dispo des danseurs/finalistes pour donner des stages
-- ============================================================
alter table public.profiles add column if not exists available_for_school boolean not null default false;
alter table public.profiles add column if not exists school_note text;
create index if not exists idx_profiles_school on public.profiles(available_for_school) where available_for_school;

-- ============================================================
-- 16) ÉVÉNEMENTS — création / gestion in-app (admin ou organisateur)
--     La lecture reste publique (policy events_read). Ici on ouvre l'écriture.
-- ============================================================
-- Un admin gère tous les événements ; un organisateur gère les siens.
drop policy if exists "events_write" on public.events;
create policy "events_write" on public.events
  for all to authenticated
  using (public.is_admin() or organizer_id = auth.uid())
  with check (public.is_admin() or organizer_id = auth.uid());

-- Rattachement des disciplines à un événement : même règle que l'événement parent.
drop policy if exists "event_categories_write" on public.event_categories;
create policy "event_categories_write" on public.event_categories
  for all to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid())
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid())
  );

-- ============================================================
-- 17) VOTE DU PUBLIC / SPECTATEURS — séparé du vote officiel des juges.
--     Sert d'engagement live et de départage (tie-break) en cas d'égalité.
--     1 voix par personne et par passage. Non pondéré (contrairement aux juges).
-- ============================================================
create table if not exists public.public_votes (
  id uuid primary key default gen_random_uuid(),
  passage_id uuid not null references public.passages(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  choice text not null check (choice in ('a', 'b')),
  created_at timestamptz not null default now(),
  unique (passage_id, profile_id)
);
create index if not exists idx_public_votes_passage on public.public_votes(passage_id);

alter table public.public_votes enable row level security;

-- Le public peut voter uniquement quand le passage est OUVERT, pour lui-même, une seule fois.
drop policy if exists "public_votes_insert" on public.public_votes;
create policy "public_votes_insert" on public.public_votes
  for insert to authenticated
  with check (
    profile_id = auth.uid()
    and exists (select 1 from public.passages p where p.id = passage_id and p.status = 'open')
  );

-- Chacun peut changer d'avis tant que le passage est ouvert.
drop policy if exists "public_votes_update" on public.public_votes;
create policy "public_votes_update" on public.public_votes
  for update to authenticated
  using (profile_id = auth.uid())
  with check (
    profile_id = auth.uid()
    and exists (select 1 from public.passages p where p.id = passage_id and p.status = 'open')
  );

-- Lecture ouverte à tous les connectés (baromètre spectateurs en direct).
drop policy if exists "public_votes_read" on public.public_votes;
create policy "public_votes_read" on public.public_votes
  for select to authenticated using (true);

-- ============================================================
-- 18) PALMARÈS — lien passages ↔ danseurs (gamification compétitive).
--     Permet le vrai palmarès (V/D/titres), le classement et les confrontations.
-- ============================================================
create table if not exists public.passage_participants (
  passage_id uuid references public.passages(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  side text not null check (side in ('a', 'b')),
  primary key (passage_id, profile_id)
);
create index if not exists idx_pp_profile on public.passage_participants(profile_id);
create index if not exists idx_pp_passage on public.passage_participants(passage_id);

alter table public.passage_participants enable row level security;

-- Lecture ouverte (palmarès public).
drop policy if exists "pp_read" on public.passage_participants;
create policy "pp_read" on public.passage_participants
  for select to authenticated using (true);

-- Écriture réservée à l'admin ou à l'organisateur de l'événement du passage.
drop policy if exists "pp_write" on public.passage_participants;
create policy "pp_write" on public.passage_participants
  for all to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.passages p
      join public.events e on e.id = p.event_id
      where p.id = passage_id and e.organizer_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.passages p
      join public.events e on e.id = p.event_id
      where p.id = passage_id and e.organizer_id = auth.uid()
    )
  );

-- Classement agrégé (victoires / défaites / titres). Un « titre » = victoire en Finale.
create or replace function public.jd_leaderboard()
returns table (
  profile_id uuid,
  alias text,
  full_name text,
  photo_url text,
  country text,
  wins bigint,
  losses bigint,
  titles bigint,
  matches bigint
)
language sql security definer stable set search_path = public as $$
  select
    pr.id, pr.alias, pr.full_name, pr.photo_url, pr.country,
    count(*) filter (where p.status = 'revealed' and p.winner = pp.side) as wins,
    count(*) filter (where p.status = 'revealed' and p.winner in ('a', 'b') and p.winner <> pp.side) as losses,
    count(*) filter (where p.status = 'revealed' and p.winner = pp.side and p.round = 'Finale') as titles,
    count(*) filter (where p.status = 'revealed' and p.winner in ('a', 'b')) as matches
  from public.passage_participants pp
  join public.passages p on p.id = pp.passage_id
  join public.profiles pr on pr.id = pp.profile_id
  group by pr.id
  having count(*) filter (where p.status = 'revealed' and p.winner in ('a', 'b')) > 0
  order by titles desc, wins desc, matches desc
  limit 100;
$$;

-- ============================================================
-- 19) JD LIVE+ — dispositif média (direct commenté, pronostics, notes)
-- ============================================================
-- Rôle commentateur (comme is_judge / is_admin).
create or replace function public.is_commentator()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and roles && array['commentator', 'organizer', 'staff', 'admin']::text[]
  );
$$;

-- a) Fil de commentaires (direct minute par minute)
create table if not exists public.commentaries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  passage_id uuid references public.passages(id) on delete set null,
  author_id uuid references public.profiles(id) on delete set null,
  kind text not null default 'mc',   -- mc | ai | system
  tag text,                          -- start | highlight | tie | reveal | upset | info
  text text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_comm_event on public.commentaries(event_id, created_at);
create index if not exists idx_comm_passage on public.commentaries(passage_id);
alter table public.commentaries enable row level security;
drop policy if exists "comm_read" on public.commentaries;
create policy "comm_read" on public.commentaries for select to authenticated using (true);
drop policy if exists "comm_write" on public.commentaries;
create policy "comm_write" on public.commentaries for insert to authenticated
  with check (public.is_commentator() and author_id = auth.uid());
drop policy if exists "comm_delete" on public.commentaries;
create policy "comm_delete" on public.commentaries for delete to authenticated
  using (public.is_commentator());

-- b) Pronostics (avant-match)
create table if not exists public.predictions (
  passage_id uuid references public.passages(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  choice text not null check (choice in ('a', 'b')),
  created_at timestamptz not null default now(),
  primary key (passage_id, profile_id)
);
create index if not exists idx_pred_passage on public.predictions(passage_id);
alter table public.predictions enable row level security;
drop policy if exists "pred_write" on public.predictions;
create policy "pred_write" on public.predictions for all to authenticated
  using (profile_id = auth.uid())
  with check (
    profile_id = auth.uid()
    and exists (select 1 from public.passages p where p.id = passage_id and p.status in ('draft', 'open'))
  );
drop policy if exists "pred_read" on public.predictions;
create policy "pred_read" on public.predictions for select to authenticated using (true);

-- c) Notes d'après-match (spectacle / MVP)
create table if not exists public.ratings (
  passage_id uuid references public.passages(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  stars int not null check (stars between 1 and 5),
  mvp_side text check (mvp_side in ('a', 'b')),
  created_at timestamptz not null default now(),
  primary key (passage_id, profile_id)
);
create index if not exists idx_ratings_passage on public.ratings(passage_id);
alter table public.ratings enable row level security;
drop policy if exists "ratings_write" on public.ratings;
create policy "ratings_write" on public.ratings for all to authenticated
  using (profile_id = auth.uid())
  with check (
    profile_id = auth.uid()
    and exists (select 1 from public.passages p where p.id = passage_id and p.status = 'revealed')
  );
drop policy if exists "ratings_read" on public.ratings;
create policy "ratings_read" on public.ratings for select to authenticated using (true);

-- Temps réel : diffuser le fil de commentaires en direct (idempotent).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'commentaries'
  ) then
    alter publication supabase_realtime add table public.commentaries;
  end if;
end $$;

-- ============================================================
-- 20) PRONOSTICS « CHAMPION » — prédire le vainqueur d'une discipline
--     (avant/pendant le bracket) + start-list publique + classement pronostiqueurs.
-- ============================================================
create table if not exists public.champion_predictions (
  event_id uuid references public.events(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade,
  predictor_id uuid references public.profiles(id) on delete cascade,
  pick_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, category_id, predictor_id)
);
create index if not exists idx_champ_event on public.champion_predictions(event_id, category_id);
alter table public.champion_predictions enable row level security;

drop policy if exists "champ_read" on public.champion_predictions;
create policy "champ_read" on public.champion_predictions for select to authenticated using (true);

-- Pronostic possible tant que la finale de la discipline n'est pas révélée.
drop policy if exists "champ_write" on public.champion_predictions;
create policy "champ_write" on public.champion_predictions for all to authenticated
  using (predictor_id = auth.uid())
  with check (
    predictor_id = auth.uid()
    and not exists (
      select 1 from public.passages p
      where p.event_id = champion_predictions.event_id
        and p.category_id = champion_predictions.category_id
        and p.round = 'Finale' and p.status = 'revealed'
    )
    -- Verrou robuste : un événement terminé fige tous les pronostics (couvre les disciplines sans passage "Finale").
    and not exists (
      select 1 from public.events e
      where e.id = champion_predictions.event_id and e.status = 'done'
    )
  );

-- Start-list publique (danseurs inscrits par discipline) — expose UNIQUEMENT des champs publics.
create or replace function public.jd_startlist(p_event uuid)
returns table (
  category_id uuid, category_name text,
  profile_id uuid, alias text, full_name text, country text, photo_url text
)
language sql security definer stable set search_path = public as $$
  select c.id, c.name, pr.id, pr.alias, pr.full_name, pr.country, pr.photo_url
  from public.registrations r
  join public.categories c on c.id = r.category_id
  join public.profiles pr on pr.id = r.profile_id
  where r.event_id = p_event and r.type = 'dancer'
  order by c.sort_order, coalesce(pr.alias, pr.full_name);
$$;

-- Vainqueurs de finale par discipline (participants du côté gagnant).
create or replace function public.jd_finale_winners(p_event uuid)
returns table (category_id uuid, profile_id uuid)
language sql security definer stable set search_path = public as $$
  select p.category_id, pp.profile_id
  from public.passages p
  join public.passage_participants pp on pp.passage_id = p.id and pp.side = p.winner
  where p.event_id = p_event and p.round = 'Finale' and p.status = 'revealed'
    and p.winner in ('a', 'b');
$$;

-- Score « champion » de l'utilisateur courant (pour les points).
create or replace function public.jd_my_champion_score()
returns table (total bigint, correct bigint)
language sql security definer stable set search_path = public as $$
  with finals as (
    select p.event_id, p.category_id, pp.profile_id as winner_id
    from public.passages p
    join public.passage_participants pp on pp.passage_id = p.id and pp.side = p.winner
    where p.round = 'Finale' and p.status = 'revealed' and p.winner in ('a', 'b')
  ),
  mine as (
    select
      exists (select 1 from finals f where f.event_id = cp.event_id and f.category_id = cp.category_id) as resolved,
      exists (select 1 from finals f where f.event_id = cp.event_id and f.category_id = cp.category_id and f.winner_id = cp.pick_id) as hit
    from public.champion_predictions cp
    where cp.predictor_id = auth.uid()
  )
  select count(*) filter (where resolved) as total, count(*) filter (where hit) as correct from mine;
$$;

-- Classement des pronostiqueurs (précision sur les pronostics de passages).
create or replace function public.jd_pronostiqueurs()
returns table (
  profile_id uuid, alias text, full_name text, photo_url text, correct bigint, total bigint
)
language sql security definer stable set search_path = public as $$
  select pr.id, pr.alias, pr.full_name, pr.photo_url,
    count(*) filter (where p.winner = pd.choice) as correct,
    count(*) as total
  from public.predictions pd
  join public.passages p on p.id = pd.passage_id and p.status = 'revealed' and p.winner in ('a', 'b')
  join public.profiles pr on pr.id = pd.profile_id
  group by pr.id
  having count(*) > 0
  order by correct desc, total asc
  limit 100;
$$;

-- ============================================================
-- 21) CERTIFICATIONS — badges officiels vérifiés (attribués par JD).
--     Ex. Prof certifié JD, Vainqueur, Finaliste, Diplômé JD School, Juge.
--     Lecture publique (badges affichés) ; écriture réservée aux admins.
-- ============================================================
create table if not exists public.certifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('prof_certifie', 'vainqueur', 'finaliste', 'diplome_school', 'juge')),
  label text,                                   -- précision : discipline / école / mention
  event_id uuid references public.events(id) on delete set null,
  year int,
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now()
);
create index if not exists idx_cert_profile on public.certifications(profile_id);
-- Un même badge (type + précision + année) n'est délivré qu'une fois par personne.
create unique index if not exists uq_cert on public.certifications
  (profile_id, kind, coalesce(label, ''), coalesce(year, 0));

alter table public.certifications enable row level security;

drop policy if exists "cert_read" on public.certifications;
create policy "cert_read" on public.certifications for select to authenticated using (true);

drop policy if exists "cert_write" on public.certifications;
create policy "cert_write" on public.certifications for insert to authenticated
  with check (public.is_admin() and granted_by = auth.uid());

drop policy if exists "cert_delete" on public.certifications;
create policy "cert_delete" on public.certifications for delete to authenticated
  using (public.is_admin());

-- ============================================================
-- 22) MESSAGERIE — conversations privées (1:1) entre membres + temps réel.
-- ============================================================
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles(id) on delete set null,
  is_group boolean not null default false,
  title text,
  last_message text,
  last_message_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid references public.conversations(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);
create index if not exists idx_convmem_profile on public.conversation_members(profile_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists idx_msg_conv on public.messages(conversation_id, created_at);

-- Helper anti-récursion RLS : suis-je membre de la conversation ?
create or replace function public.is_conv_member(p_conv uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.conversation_members m
    where m.conversation_id = p_conv and m.profile_id = auth.uid()
  );
$$;

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

drop policy if exists "conv_read" on public.conversations;
create policy "conv_read" on public.conversations for select to authenticated
  using (public.is_conv_member(id));
drop policy if exists "conv_insert" on public.conversations;
create policy "conv_insert" on public.conversations for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists "convmem_read" on public.conversation_members;
create policy "convmem_read" on public.conversation_members for select to authenticated
  using (public.is_conv_member(conversation_id));
drop policy if exists "convmem_insert" on public.conversation_members;
create policy "convmem_insert" on public.conversation_members for insert to authenticated
  with check (
    profile_id = auth.uid()
    -- Le créateur ne peut ajouter des tiers QUE dans un groupe (is_group), pas dans un DM 1:1
    -- (sinon vecteur de spam : ajouter une victime arbitraire à une conversation). Les DM passent par get_or_create_dm.
    or exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.created_by = auth.uid() and c.is_group = true
    )
  );
drop policy if exists "convmem_update" on public.conversation_members;
create policy "convmem_update" on public.conversation_members for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists "msg_read" on public.messages;
create policy "msg_read" on public.messages for select to authenticated
  using (public.is_conv_member(conversation_id));
drop policy if exists "msg_insert" on public.messages;
create policy "msg_insert" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_conv_member(conversation_id));

-- Met à jour l'aperçu de la conversation à chaque message.
create or replace function public.bump_conversation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations
    set last_message = left(new.body, 140), last_message_at = new.created_at
    where id = new.conversation_id;
  return new;
end $$;
drop trigger if exists trg_bump_conv on public.messages;
create trigger trg_bump_conv after insert on public.messages
  for each row execute function public.bump_conversation();

-- Ouvre (ou récupère) la conversation 1:1 entre l'utilisateur et un autre membre.
create or replace function public.get_or_create_dm(p_other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); v_conv uuid;
begin
  if v_me is null or p_other is null or p_other = v_me then
    raise exception 'Destinataire invalide';
  end if;
  select c.id into v_conv
  from public.conversations c
  join public.conversation_members m1 on m1.conversation_id = c.id and m1.profile_id = v_me
  join public.conversation_members m2 on m2.conversation_id = c.id and m2.profile_id = p_other
  where c.is_group = false
  limit 1;
  if v_conv is not null then return v_conv; end if;
  insert into public.conversations (created_by, is_group) values (v_me, false) returning id into v_conv;
  insert into public.conversation_members (conversation_id, profile_id) values (v_conv, v_me), (v_conv, p_other);
  return v_conv;
end $$;

-- Liste enrichie de mes conversations (autre participant + non-lus).
create or replace function public.my_conversations()
returns table (
  id uuid, is_group boolean, title text, last_message text, last_message_at timestamptz,
  other_id uuid, other_alias text, other_name text, other_photo text, unread int
)
language sql security definer stable set search_path = public as $$
  select c.id, c.is_group, c.title, c.last_message, c.last_message_at,
    o.id, o.alias, o.full_name, o.photo_url,
    (select count(*) from public.messages msg
       where msg.conversation_id = c.id
         and msg.sender_id <> auth.uid()
         and msg.created_at > coalesce(mm.last_read_at, 'epoch'::timestamptz))::int as unread
  from public.conversation_members mm
  join public.conversations c on c.id = mm.conversation_id
  left join lateral (
    select p.id, p.alias, p.full_name, p.photo_url
    from public.conversation_members m2
    join public.profiles p on p.id = m2.profile_id
    where m2.conversation_id = c.id and m2.profile_id <> auth.uid()
    limit 1
  ) o on true
  where mm.profile_id = auth.uid()
  order by c.last_message_at desc nulls last;
$$;

-- Temps réel : diffuser les nouveaux messages (idempotent).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- ============================================================
-- 23) GÉOLOCALISATION (opt-in) + PUSH — « les danseurs autour de toi ».
--     Données sensibles isolées dans une table privée (lisible par soi seul).
--     Position stockée APPROXIMATIVE (arrondie côté app ~1 km) — RGPD.
-- ============================================================
create table if not exists public.profile_location (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  share_location boolean not null default false,
  lat double precision,
  lng double precision,
  updated_at timestamptz,
  push_token text
);
alter table public.profile_location enable row level security;

-- Chacun ne lit/écrit QUE sa propre ligne (position + token jamais exposés aux autres).
drop policy if exists "loc_self" on public.profile_location;
create policy "loc_self" on public.profile_location for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Danseurs proches : renvoie UNIQUEMENT une distance (jamais les coordonnées brutes).
create or replace function public.dancers_nearby(p_radius_km double precision default 150)
returns table (
  id uuid, alias text, full_name text, country text, city text,
  photo_url text, styles text[], level text, distance_km double precision
)
language sql security definer stable set search_path = public as $$
  with me as (
    select lat, lng from public.profile_location
    where profile_id = auth.uid() and share_location = true and lat is not null
  )
  select q.* from (
    select p.id, p.alias, p.full_name, p.country, p.city, p.photo_url, p.styles, p.level,
      2 * 6371 * asin(sqrt(
        power(sin(radians(l.lat - me.lat) / 2), 2) +
        cos(radians(me.lat)) * cos(radians(l.lat)) *
        power(sin(radians(l.lng - me.lng) / 2), 2)
      )) as distance_km
    from public.profile_location l
    join public.profiles p on p.id = l.profile_id
    cross join me
    where l.profile_id <> auth.uid()
      and l.share_location = true
      and l.lat is not null and l.lng is not null
  ) q
  where q.distance_km <= p_radius_km
  order by q.distance_km asc
  limit 100;
$$;

-- ============================================================
-- 24) JD COINS — fidélité partagée avec JD School (ledger jd_points_ledger).
--     Le solde = somme des delta (source_app 'school' + 'juste-debout').
--     Crédit UNIQUEMENT côté serveur (triggers) : impossible à s'auto-attribuer.
-- ============================================================

-- Ledger de fidélité (partagé cross-app). RLS : lecture de ses propres lignes uniquement.
-- AUCUNE policy insert/update/delete : le crédit passe exclusivement par jd_credit_coins
-- (security definer, qui bypasse la RLS). Tout insert direct depuis l'app est donc refusé.
create table if not exists public.jd_points_ledger (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  delta int not null,
  reason text,
  source_app text not null default 'juste-debout' check (source_app in ('juste-debout', 'school')),
  created_at timestamptz not null default now()
);
create index if not exists idx_ledger_profile on public.jd_points_ledger(profile_id);
alter table public.jd_points_ledger enable row level security;
drop policy if exists "ledger_read_own" on public.jd_points_ledger;
create policy "ledger_read_own" on public.jd_points_ledger
  for select to authenticated using (profile_id = auth.uid());

-- Multiplicateur de palier (Basic ×1 · Foundation ×1.1 · Rise&Shine ×1.25 · Full Out ×1.5).
create or replace function public.jd_coins_multiplier(p_balance int)
returns numeric language sql immutable as $$
  select case
    when p_balance >= 10000 then 1.5
    when p_balance >= 5000  then 1.25
    when p_balance >= 1000  then 1.1
    else 1.0
  end;
$$;

-- Solde cumulé de l'utilisateur (toutes apps confondues).
create or replace function public.jd_coins_balance(p_profile uuid default null)
returns integer language sql security definer stable set search_path = public as $$
  select coalesce(sum(delta), 0)::int
  from public.jd_points_ledger
  where profile_id = coalesce(p_profile, auth.uid());
$$;

-- Répartition du solde par application (pour l'affichage Juste Debout / JD School).
create or replace function public.jd_coins_by_app()
returns table (source_app text, total int)
language sql security definer stable set search_path = public as $$
  select source_app, coalesce(sum(delta), 0)::int
  from public.jd_points_ledger
  where profile_id = auth.uid()
    and source_app in ('juste-debout', 'school')
  group by source_app;
$$;

-- Crédit interne (base × multiplicateur courant). NON exposé à l'app (revoke ci-dessous).
create or replace function public.jd_credit_coins(p_profile uuid, p_base int, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_bal int; v_mult numeric; v_delta int;
begin
  if p_profile is null or coalesce(p_base, 0) = 0 then return; end if;
  -- Sérialise les crédits concurrents du même profil (évite un multiplicateur lu sur un solde périmé au franchissement de palier).
  perform pg_advisory_xact_lock(hashtext(p_profile::text));
  select coalesce(sum(delta), 0)::int into v_bal
    from public.jd_points_ledger where profile_id = p_profile;
  v_mult := public.jd_coins_multiplier(v_bal);
  v_delta := round(p_base * v_mult);
  insert into public.jd_points_ledger (profile_id, delta, reason, source_app)
  values (p_profile, v_delta, p_reason, 'juste-debout');
end $$;
-- Empêche tout appel direct depuis l'app (seuls les triggers l'utilisent).
revoke execute on function public.jd_credit_coins(uuid, int, text) from anon, authenticated;

-- Crédit à l'inscription (danseur ou spectateur).
create or replace function public.trg_coins_registration()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.jd_credit_coins(
    new.profile_id,
    case when new.type = 'dancer' then 15 else 10 end,
    case when new.type = 'dancer' then 'Inscription danseur' else 'Inscription spectateur' end
  );
  return new;
end $$;
drop trigger if exists trg_coins_reg on public.registrations;
create trigger trg_coins_reg after insert on public.registrations
  for each row execute function public.trg_coins_registration();

-- Crédit à la présence vérifiée (billet scanné : used_at passe de null à renseigné).
create or replace function public.trg_coins_attendance()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.used_at is not null and old.used_at is null and new.profile_id is not null then
    perform public.jd_credit_coins(new.profile_id, 25, 'Présence vérifiée');
  end if;
  return new;
end $$;
drop trigger if exists trg_coins_att on public.tickets;
create trigger trg_coins_att after update on public.tickets
  for each row execute function public.trg_coins_attendance();

-- ============================================================
-- 25) CLASSEMENT PONDÉRÉ — score juste (tour × taille de plateau × tier).
--     Officiel JD > présélection > partenaire. Remplace jd_leaderboard().
-- ============================================================

-- Niveau de l'événement (pour la pondération). Officiel par défaut.
alter table public.events add column if not exists tier text not null default 'official';
  -- valeurs : 'official' | 'preselection' | 'partner'

-- Poids d'un tour (Finale la plus forte). Insensible à la casse / au format.
create or replace function public.jd_round_weight(p_round text)
returns numeric language sql immutable as $$
  select case
    when p_round is null then 6
    when p_round ilike '%demi%' or p_round ilike '%1/2%' or p_round ilike '%semi%' then 60
    when p_round ilike '%finale%' then 100
    when p_round ilike '%1/4%' or p_round ilike '%quart%' or p_round ilike '%top 8%' then 36
    when p_round ilike '%1/8%' or p_round ilike '%top 16%' then 22
    when p_round ilike '%1/16%' or p_round ilike '%top 32%' then 14
    when p_round ilike '%1/32%' or p_round ilike '%top 64%' then 9
    else 6
  end;
$$;

-- Classement mondial pondéré. Le score récompense la profondeur de parcours,
-- la taille du plateau et le niveau de l'événement (anti-inflation des petits events).
drop function if exists public.jd_leaderboard();
create or replace function public.jd_leaderboard()
returns table (
  profile_id uuid, alias text, full_name text, photo_url text, country text,
  wins bigint, losses bigint, titles bigint, matches bigint, score numeric
)
language sql security definer stable set search_path = public as $$
  with field as (
    select event_id, category_id, count(distinct profile_id)::numeric as n
    from public.registrations
    where type = 'dancer'
    group by event_id, category_id
  ),
  decided as (
    select
      pp.profile_id, pp.side, p.winner, p.round,
      coalesce(f.n, 8) as field_n,
      case when e.tier = 'partner' then 0.6
           when e.tier = 'preselection' then 0.85
           else 1.0 end as tier_w
    from public.passage_participants pp
    join public.passages p on p.id = pp.passage_id
    join public.events e on e.id = p.event_id
    left join field f on f.event_id = p.event_id and f.category_id = p.category_id
    where p.status = 'revealed' and p.winner in ('a', 'b')
  )
  select
    pr.id, pr.alias, pr.full_name, pr.photo_url, pr.country,
    count(*) filter (where d.winner = d.side) as wins,
    count(*) filter (where d.winner <> d.side) as losses,
    count(*) filter (where d.winner = d.side and public.jd_round_weight(d.round) >= 100) as titles,
    count(*) as matches,
    round((coalesce(sum(
      case when d.winner = d.side
        then public.jd_round_weight(d.round) * d.tier_w * (ln(greatest(d.field_n, 2)) / ln(16))
        else 0 end
    ), 0))::numeric, 1) as score
  from decided d
  join public.profiles pr on pr.id = d.profile_id
  group by pr.id
  having count(*) > 0
  order by score desc, titles desc, wins desc
  limit 100;
$$;

-- ============================================================
-- 26) ÉVÉNEMENTS PARTENAIRES + MODÉRATION.
--     Un membre non-staff peut proposer un événement : il est marqué
--     'partner' + 'pending' et n'est public qu'après validation d'un admin.
-- ============================================================

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

-- ============================================================
-- 27) LIVE STREAMING — diffusion in-app (Bunny Stream, ingest RTMP → HLS).
--     L'app lit l'URL HLS (playback_url). Le broadcast se fait via encodeur
--     externe (OBS / Larix) vers l'ingest RTMP de Bunny. Écriture réservée staff.
-- ============================================================
create table if not exists public.live_streams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete set null,
  title text not null default 'Direct Juste Debout',
  provider text not null default 'bunny',
  playback_url text,                       -- URL HLS (.m3u8) de lecture
  status text not null default 'idle',     -- idle | live | ended
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

-- Le direct actuellement en cours (le plus récent).
create or replace function public.active_live()
returns setof public.live_streams
language sql security definer stable set search_path = public as $$
  select * from public.live_streams
  where status = 'live'
  order by started_at desc nulls last
  limit 1;
$$;

-- Temps réel : notifier passage en direct / fin (idempotent).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'live_streams'
  ) then
    alter publication supabase_realtime add table public.live_streams;
  end if;
end $$;

-- ============================================================
-- 28) PUSH PLANIFIÉ « X danseurs près de toi ».
--     Une Edge Function (cron) calcule pour chaque membre opt-in le nombre
--     de danseurs proches et envoie une notif (anti-spam via cooldown).
--     Le champ `lang` permet de notifier dans la langue du membre.
-- ============================================================
alter table public.profile_location add column if not exists last_nearby_push_at timestamptz;
alter table public.profile_location add column if not exists lang text;

create or replace function public.nearby_push_targets(
  p_radius_km double precision default 50, p_min int default 3, p_cooldown_hours int default 20
)
returns table (profile_id uuid, push_token text, lang text, nearby int)
language sql security definer stable set search_path = public as $$
  select q.* from (
    select me.profile_id, me.push_token, coalesce(me.lang, 'en') as lang,
      (select count(*)::int from public.profile_location o
        where o.profile_id <> me.profile_id and o.share_location = true and o.lat is not null
          and 2 * 6371 * asin(sqrt(
            power(sin(radians(o.lat - me.lat) / 2), 2)
            + cos(radians(me.lat)) * cos(radians(o.lat)) * power(sin(radians(o.lng - me.lng) / 2), 2)
          )) <= p_radius_km
      ) as nearby
    from public.profile_location me
    where me.share_location = true and me.lat is not null and me.push_token is not null
      and (me.last_nearby_push_at is null or me.last_nearby_push_at < now() - make_interval(hours => p_cooldown_hours))
  ) q
  where q.nearby >= p_min;
$$;
revoke execute on function public.nearby_push_targets(double precision, int, int) from anon, authenticated;

create or replace function public.mark_nearby_pushed(p_ids uuid[])
returns void language sql security definer set search_path = public as $$
  update public.profile_location set last_nearby_push_at = now() where profile_id = any(p_ids);
$$;
revoke execute on function public.mark_nearby_pushed(uuid[]) from anon, authenticated;

-- ============================================================
-- 28) BOUTIQUE — COMMANDES (adresse de livraison + réception temps réel)
-- ============================================================
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending', -- pending | paid | shipped | delivered | cancelled
  currency text not null default 'EUR',
  total int not null default 0,           -- centimes
  full_name text not null,
  phone text,
  address_line1 text not null,
  address_line2 text,
  postal_code text not null,
  city text not null,
  country text not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_orders_profile on public.orders(profile_id);
create index if not exists idx_orders_created on public.orders(created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null,        -- snapshot du nom du produit
  unit_price int not null,   -- centimes, snapshot
  quantity int not null default 1
);
create index if not exists idx_order_items_order on public.order_items(order_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- L'acheteur gère ses commandes ; le staff/admin voit et gère TOUT (réception temps réel)
drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own" on public.orders for insert to authenticated
  with check (profile_id = auth.uid());
drop policy if exists "orders_read" on public.orders;
create policy "orders_read" on public.orders for select to authenticated
  using (profile_id = auth.uid() or public.is_staff());
drop policy if exists "orders_staff_update" on public.orders;
create policy "orders_staff_update" on public.orders for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists "order_items_insert_own" on public.order_items;
create policy "order_items_insert_own" on public.order_items for insert to authenticated
  with check (exists (select 1 from public.orders o where o.id = order_id and o.profile_id = auth.uid()));
drop policy if exists "order_items_read" on public.order_items;
create policy "order_items_read" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (o.profile_id = auth.uid() or public.is_staff())));

-- Réception temps réel (le staff s'abonne aux nouvelles commandes)
alter publication supabase_realtime add table public.orders;

-- ============================================================
-- « TON MOMENT » (backend prêt — UI activée à la sortie officielle)
--   source 'upload' = clip posté par le danseur (Phase 1 · TOTF)
--   source 'official' = captation JD auto-attribuée via passage_participants (Phase 2 · JD)
-- ============================================================
create table if not exists public.moments (
  id uuid primary key default gen_random_uuid(),
  dancer_id uuid references public.profiles(id) on delete cascade,
  passage_id uuid references public.passages(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  source text not null default 'upload',
  video_url text,
  highlight_url text,
  discipline text,
  status text not null default 'pending', -- pending | approved | published | rejected
  created_at timestamptz not null default now()
);
create index if not exists idx_moments_dancer on public.moments(dancer_id);
alter table public.moments enable row level security;
drop policy if exists "moments_read" on public.moments;
create policy "moments_read" on public.moments for select to authenticated
  using (status = 'published' or dancer_id = auth.uid());
drop policy if exists "moments_insert_own" on public.moments;
create policy "moments_insert_own" on public.moments for insert to authenticated
  with check (dancer_id = auth.uid() and source = 'upload');
