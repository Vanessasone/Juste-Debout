-- Juste Debout — Cadeaux live (à lancer dans Supabase → SQL Editor). Idempotent.

-- 27) CADEAUX LIVE — envoi de cadeaux payants pendant les directs.
--     Monnaie = JD Coins (jd_points_ledger, solde = somme des deltas).
--     Coins ACHETÉS ("cash-backed") → rémunèrent le danseur (50% de 0,01€/coin).
--     Coins gagnés (fidélité) ou bonus → soutien/animation, AUCUNE dette réelle.
--     Attribution par CÔTÉ de passage ; les gains sont répartis entre les
--     danseurs du côté (binôme = 50/50 entre les deux), via passage_participants.
-- ============================================================

alter table public.profiles add column if not exists coins_cashbacked int not null default 0;

create table if not exists public.gifts (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  emoji text not null,
  name text not null,
  cost_coins int not null check (cost_coins > 0),
  tier text not null default 'mid',   -- entry | mid | hero
  sort int not null default 0,
  active boolean not null default true
);
alter table public.gifts enable row level security;
drop policy if exists "gifts_read" on public.gifts;
create policy "gifts_read" on public.gifts for select to authenticated using (active);

insert into public.gifts (code, emoji, name, cost_coins, tier, sort) values
  ('clap','👏','Clap',1,'entry',10),
  ('rose','🌹','Rose',50,'entry',20),
  ('sneaker','👟','Basket',100,'mid',30),
  ('fire','🔥','Flamme',200,'mid',40),
  ('cap','🧢','Casquette JD',500,'mid',50),
  ('crown','👑','Couronne',1000,'hero',60),
  ('bolt','⚡','Éclair',2000,'hero',70),
  ('trophy','🏆','Trophée',5000,'hero',80)
on conflict (code) do update set
  emoji = excluded.emoji, name = excluded.name, cost_coins = excluded.cost_coins,
  tier = excluded.tier, sort = excluded.sort, active = true;

create table if not exists public.gift_sends (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  passage_id uuid references public.passages(id) on delete set null,
  gift_id uuid not null references public.gifts(id),
  dancer_profile_id uuid references public.profiles(id) on delete set null, -- indicatif (1er du côté)
  dancer_side text,                    -- 'a' | 'b' : clé de répartition des gains
  coins_spent int not null,
  cash_coins int not null default 0,   -- portion cash-backed → base du reversement
  created_at timestamptz not null default now()
);
create index if not exists idx_gift_sends_side on public.gift_sends(passage_id, dancer_side);
create index if not exists idx_gift_sends_event on public.gift_sends(event_id, created_at);
alter table public.gift_sends enable row level security;
drop policy if exists "gift_sends_read_own" on public.gift_sends;
create policy "gift_sends_read_own" on public.gift_sends for select to authenticated
  using (sender_id = auth.uid() or dancer_profile_id = auth.uid() or public.is_admin());

create or replace function public.coins_balance(p_profile uuid)
returns int language sql security definer set search_path = public as $$
  select coalesce(sum(delta),0)::int from public.jd_points_ledger
    where profile_id = coalesce(p_profile, auth.uid());
$$;

-- Achat de coins — MODE TEST (à remplacer par le webhook Stripe avant lancement).
create or replace function public.buy_coins(p_base int, p_bonus int, p_ref text)
returns int language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  if coalesce(p_base,0) < 0 or coalesce(p_bonus,0) < 0 then raise exception 'bad amount'; end if;
  insert into public.jd_points_ledger (profile_id, delta, reason, source_app)
    values (auth.uid(), coalesce(p_base,0) + coalesce(p_bonus,0), 'purchase:' || coalesce(p_ref,'test'), 'juste-debout');
  update public.profiles set coins_cashbacked = coins_cashbacked + coalesce(p_base,0) where id = auth.uid();
  return public.coins_balance(auth.uid());
end; $$;

-- Envoi d'un cadeau vers un CÔTÉ (a/b) du passage. Débit atomique (cash-backed d'abord).
drop function if exists public.send_gift(uuid, uuid, uuid, uuid, text);
create or replace function public.send_gift(p_gift uuid, p_event uuid, p_passage uuid, p_side text)
returns json language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_cost int; v_bal int; v_cash int; v_use_cash int; v_first uuid;
begin
  if v_uid is null then raise exception 'auth required'; end if;
  select cost_coins into v_cost from public.gifts where id = p_gift and active;
  if v_cost is null then raise exception 'gift not found'; end if;
  perform pg_advisory_xact_lock(hashtext(v_uid::text));
  select coalesce(sum(delta),0)::int into v_bal from public.jd_points_ledger where profile_id = v_uid;
  if v_bal < v_cost then raise exception 'insufficient_coins'; end if;
  select coins_cashbacked into v_cash from public.profiles where id = v_uid for update;
  v_use_cash := least(coalesce(v_cash,0), v_cost);
  select profile_id into v_first from public.passage_participants
    where passage_id = p_passage and side = p_side order by profile_id limit 1;
  insert into public.jd_points_ledger (profile_id, delta, reason, source_app)
    values (v_uid, -v_cost, 'gift', 'juste-debout');
  update public.profiles set coins_cashbacked = coins_cashbacked - v_use_cash where id = v_uid;
  insert into public.gift_sends (sender_id, event_id, passage_id, gift_id, dancer_profile_id, dancer_side, coins_spent, cash_coins)
    values (v_uid, p_event, p_passage, p_gift, v_first, p_side, v_cost, v_use_cash);
  return json_build_object('ok', true, 'cost', v_cost, 'cash_coins', v_use_cash, 'balance', v_bal - v_cost);
end; $$;

-- Gains du danseur connecté : sa part = cash_coins/(nb danseurs du côté) × 0,005 €.
drop function if exists public.my_gift_earnings();
create or replace function public.my_gift_earnings()
returns table(gifts_received int, coins_received numeric, cash_coins numeric, earnings_eur numeric)
language sql security definer set search_path = public as $$
  with mine as (
    select gs.coins_spent, gs.cash_coins,
      greatest((select count(*) from public.passage_participants pp2
                 where pp2.passage_id = gs.passage_id and pp2.side = gs.dancer_side), 1) as n
    from public.gift_sends gs
    join public.passage_participants pp
      on pp.passage_id = gs.passage_id and pp.side = gs.dancer_side
    where pp.profile_id = auth.uid()
  )
  select count(*)::int,
         round(coalesce(sum(coins_spent::numeric / n),0), 1),
         round(coalesce(sum(cash_coins::numeric / n),0), 1),
         round(coalesce(sum(cash_coins::numeric / n),0) * 0.005, 2)
  from mine;
$$;

-- Admin : totaux (revenu = coins cash uniquement ; split 50/50).
drop function if exists public.admin_gift_stats();
create or replace function public.admin_gift_stats()
returns table(total_gifts int, total_coins int, cash_coins int, gross_eur numeric, dancers_eur numeric, jd_eur numeric)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query select
    count(*)::int,
    coalesce(sum(coins_spent),0)::int,
    coalesce(sum(gs.cash_coins),0)::int,
    round(coalesce(sum(gs.cash_coins),0) * 0.01, 2),
    round(coalesce(sum(gs.cash_coins),0) * 0.005, 2),
    round(coalesce(sum(gs.cash_coins),0) * 0.005, 2)
  from public.gift_sends gs;
end; $$;

-- Admin : gains par danseur (répartis par côté), € à reverser.
drop function if exists public.admin_dancer_earnings();
create or replace function public.admin_dancer_earnings()
returns table(profile_id uuid, dancer text, gifts_received int, cash_coins numeric, earnings_eur numeric)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
  with split as (
    select pp.profile_id,
      gs.coins_spent, gs.cash_coins,
      greatest((select count(*) from public.passage_participants pp2
                 where pp2.passage_id = gs.passage_id and pp2.side = gs.dancer_side), 1) as n
    from public.gift_sends gs
    join public.passage_participants pp
      on pp.passage_id = gs.passage_id and pp.side = gs.dancer_side
  )
  select s.profile_id,
    coalesce(p.alias, p.full_name, 'Danseur'),
    count(*)::int,
    round(coalesce(sum(s.cash_coins::numeric / s.n),0), 1),
    round(coalesce(sum(s.cash_coins::numeric / s.n),0) * 0.005, 2)
  from split s left join public.profiles p on p.id = s.profile_id
  group by s.profile_id, p.alias, p.full_name
  order by 5 desc;
end; $$;
