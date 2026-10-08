-- One membership QR; explicit event eligibility; no universal free admission.
create table if not exists public.black_card_event_access (
  event_id uuid primary key references public.events(id),
  active boolean not null default false,
  access_start_date date not null,
  access_end_date date not null,
  time_zone text not null default 'Europe/Paris',
  check(access_end_date >= access_start_date)
);
alter table public.black_card_event_access enable row level security;
revoke all on public.black_card_event_access from anon, authenticated;
grant select on public.black_card_event_access to authenticated;
grant all on public.black_card_event_access to service_role;
create policy black_card_event_access_read on public.black_card_event_access for select to authenticated
using (public.is_scanner() or exists(select 1 from public.black_cards b where b.profile_id=auth.uid() and b.status='active' and b.valid_until>now()));

create table if not exists public.black_card_event_scans (
  id uuid primary key default gen_random_uuid(),
  black_card_id uuid not null references public.black_cards(id),
  event_id uuid not null references public.events(id),
  access_date date not null,
  scanned_at timestamptz not null default now(),
  scanned_by uuid not null references public.profiles(id),
  unique(black_card_id,event_id,access_date)
);
alter table public.black_card_event_scans enable row level security;
revoke all on public.black_card_event_scans from anon, authenticated;
grant select on public.black_card_event_scans to authenticated;
grant all on public.black_card_event_scans to service_role;
create policy black_card_event_scans_read on public.black_card_event_scans for select to authenticated
using (public.is_scanner() or exists(select 1 from public.black_cards b where b.id=black_card_id and b.profile_id=auth.uid()));

insert into public.black_card_event_access(event_id,active,access_start_date,access_end_date)
values('eb0025ca-b597-4708-9d47-b24ebbf507b5',true,'2027-03-13','2027-03-14') on conflict(event_id) do nothing;

create or replace function public.scanner_events() returns jsonb
language plpgsql security definer set search_path=public as $$
begin
 if not public.is_scanner() then return jsonb_build_object('ok',false,'error','scanner_forbidden'); end if;
 return jsonb_build_object('ok',true,'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'title',e.title) order by e.starts_on)
 from public.events e where (e.tickets_open or exists(select 1 from public.black_card_event_access a where a.event_id=e.id and a.active)) and e.ends_on >= (now() at time zone 'Europe/Paris')::date),'[]'::jsonb));
end $$;
revoke all on function public.scanner_events() from public,anon;
grant execute on function public.scanner_events() to authenticated,service_role;

create or replace function public.scan_ticket_at_event(p_ticket uuid,p_event uuid) returns json
language plpgsql security definer set search_path=public as $$
declare tk public.tickets%rowtype; bc public.black_cards%rowtype; rule public.black_card_event_access%rowtype; day date; previous timestamptz; cap int; used int;
begin
 if not public.is_scanner() then return json_build_object('ok',false,'error','scanner_forbidden'); end if;
 perform 1 from public.events where id=p_event for update;
 if not found then return json_build_object('ok',false,'error','event_not_found'); end if;
 select * into tk from public.tickets where id=p_ticket for update;
 if not found then return json_build_object('ok',false,'error','not_found'); end if;
 -- Original Paris ticket remains on the canonical scanner and counters.
 if tk.event_id=p_event then return public.scan_ticket(p_ticket); end if;
 select * into bc from public.black_cards where ticket_id=p_ticket for update;
 if not found then return json_build_object('ok',false,'error','wrong_event'); end if;
 if tk.status='cancelled' then return json_build_object('ok',false,'error','cancelled'); end if;
 if bc.profile_id is distinct from tk.profile_id then return json_build_object('ok',false,'error','membership_holder_mismatch'); end if;
 if bc.status<>'active' or now()<bc.valid_from or now()>=bc.valid_until then return json_build_object('ok',false,'error','membership_not_active'); end if;
 select * into rule from public.black_card_event_access where event_id=p_event and active;
 if not found then return json_build_object('ok',false,'error','event_not_included'); end if;
 day:=(now() at time zone rule.time_zone)::date;
 if day<rule.access_start_date or day>rule.access_end_date then return json_build_object('ok',false,'error','wrong_day'); end if;
 select scanned_at into previous from public.black_card_event_scans where black_card_id=bc.id and event_id=p_event and access_date=day;
 if previous is not null then return json_build_object('ok',false,'error','already_scanned_today','scanned_at',previous,'category','Black Card','category_code','black_card'); end if;
 select coalesce((select capacity from public.event_daily_capacity where event_id=p_event and access_date=day),e.capacity) into cap from public.events e where e.id=p_event;
 if cap is null or cap<1 then return json_build_object('ok',false,'error','capacity_unconfigured'); end if;
 select (select count(*) from public.black_card_event_scans where event_id=p_event and access_date=day)+(select count(*) from public.ticket_scans s join public.tickets t on t.id=s.ticket_id where t.event_id=p_event and s.access_date=day) into used;
 if used>=cap then return json_build_object('ok',false,'error','event_full'); end if;
 insert into public.black_card_event_scans(black_card_id,event_id,access_date,scanned_by) values(bc.id,p_event,day,auth.uid()) returning scanned_at into previous;
 return json_build_object('ok',true,'category','Black Card','category_code','black_card','scanned_at',previous);
end $$;
revoke all on function public.scan_ticket_at_event(uuid,uuid) from public,anon;
grant execute on function public.scan_ticket_at_event(uuid,uuid) to authenticated,service_role;
