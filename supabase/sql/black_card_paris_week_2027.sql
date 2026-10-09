-- Black Card: canonical 11–14 March access plus published JD Paris week events.
-- Prices, annual membership duration and the existing QR tokens are unchanged.
alter table public.black_card_event_access add column if not exists auto_managed boolean not null default false;

create or replace function public.sync_black_card_paris_week_2027_access()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.id='eb0025ca-b597-4708-9d47-b24ebbf507b5'::uuid then return new; end if;
 -- Do not turn imported aliases of the two finals into separate admissions.
 if lower(trim(coalesce(new.city,'')))='paris'
 and new.starts_on >= date '2027-03-06' and new.ends_on <= date '2027-03-14'
 and new.ends_on >= new.starts_on and new.moderation='approved'
 and new.status in ('upcoming','ongoing','live')
 and (new.season_id='00000000-0000-0000-0000-000000000026'::uuid
      or new.title ~* '(^JD[ ·:-]|Juste[ -]?Debout|Hip[ -]?Hop Dance Week)')
 and new.title !~* '^(JD · Paris · (13|14) mars 2027|Juste Debout · Paris · 2027-03-(13|14))$'
 then
  insert into public.black_card_event_access(event_id,active,access_start_date,access_end_date,auto_managed)
  values(new.id,true,new.starts_on,new.ends_on,true)
  on conflict(event_id) do update set active=true,access_start_date=excluded.access_start_date,
    access_end_date=excluded.access_end_date,auto_managed=true
  where black_card_event_access.auto_managed;
 else
  update public.black_card_event_access set active=false where event_id=new.id and auto_managed;
 end if;
 return new;
end $$;
revoke all on function public.sync_black_card_paris_week_2027_access() from public,anon,authenticated;
drop trigger if exists sync_black_card_paris_week_2027_access on public.events;
create trigger sync_black_card_paris_week_2027_access after insert or update of city,starts_on,ends_on,title,season_id,status,moderation
on public.events for each row execute function public.sync_black_card_paris_week_2027_access();

update public.ticket_products set access_days=4,access_start_date='2027-03-11',access_date=null
where event_id='eb0025ca-b597-4708-9d47-b24ebbf507b5' and code='black_card';
update public.ticket_order_items i set access_days=4
from public.ticket_products p where i.product_id=p.id and p.code='black_card'
and p.event_id='eb0025ca-b597-4708-9d47-b24ebbf507b5' and i.access_days<>4;
insert into public.black_card_event_access(event_id,active,access_start_date,access_end_date)
values('eb0025ca-b597-4708-9d47-b24ebbf507b5',true,'2027-03-11','2027-03-14')
on conflict(event_id) do update set active=true,access_start_date=excluded.access_start_date,access_end_date=excluded.access_end_date;
-- Reconcile existing eligible events without modifying their dates or publication state.
update public.events set city=city where lower(trim(city))='paris'
and starts_on >= '2027-03-06' and ends_on <= '2027-03-14'
and id<>'eb0025ca-b597-4708-9d47-b24ebbf507b5';

-- Keep the membership QR usable for the other included events after all finals scans.
-- Only change this condition in the audited canonical scanner implementation.
do $$ declare body text; old_condition text := 'if real_date>=last_day or coalesce(v.access_days,1)<=1 or n>=coalesce(v.access_days,1) then'; begin
 body:=pg_get_functiondef('public.scan_ticket(uuid,date)'::regprocedure);
 if position(old_condition in body)=0 then raise exception 'Unexpected canonical scanner definition'; end if;
 body:=replace(body,old_condition,'if v.product_code is distinct from ''black_card'' and (real_date>=last_day or coalesce(v.access_days,1)<=1 or n>=coalesce(v.access_days,1)) then');
 execute body;
end $$;

create or replace function public.scan_ticket_at_event(p_ticket uuid,p_event uuid) returns json
language plpgsql security definer set search_path=public as $$
declare tk public.tickets%rowtype; bc public.black_cards%rowtype; rule public.black_card_event_access%rowtype;
 day date; previous timestamptz; cap int; used int;
begin
 if not public.is_scanner() then return json_build_object('ok',false,'error','scanner_forbidden'); end if;
 perform 1 from public.events where id=p_event for update;
 if not found then return json_build_object('ok',false,'error','event_not_found'); end if;
 select * into tk from public.tickets where id=p_ticket for update;
 if not found then return json_build_object('ok',false,'error','not_found'); end if;
 if tk.status in ('cancelled','refunded') then return json_build_object('ok',false,'error','cancelled'); end if;
 select * into bc from public.black_cards where ticket_id=p_ticket for update;
 if found then
  if bc.profile_id is distinct from tk.profile_id then return json_build_object('ok',false,'error','membership_holder_mismatch'); end if;
  if bc.status<>'active' or now()<bc.valid_from or now()>=bc.valid_until then return json_build_object('ok',false,'error','membership_not_active'); end if;
 end if;
 -- Canonical daily scans continue to feed the existing supervision counters.
 if tk.event_id=p_event then return public.scan_ticket(p_ticket); end if;
 if bc.id is null then return json_build_object('ok',false,'error','wrong_event'); end if;
 if tk.status not in ('active','used') then return json_build_object('ok',false,'error','not_active'); end if;
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
