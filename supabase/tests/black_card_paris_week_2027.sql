-- Run with the migration. Every simulated scan and fixture is rolled back in
-- the caught subtransaction; the production scanner clock is never replaced.
do $$
declare
 ev uuid; tk uuid; bc uuid; tk2 uuid; refunded uuid; staff uuid;
 canonical text; cross_event text; stamp text; day integer; response json;
 qr_before text; scans_before bigint; events_before bigint; count_after bigint;
begin
 select count(*) into scans_before from public.ticket_scans;
 select count(*) into events_before from public.events;
 select t.id,b.id,t.qr_token into tk,bc,qr_before from public.tickets t
 join public.black_cards b on b.ticket_id=t.id where b.status='active' and t.status='active' order by b.created_at limit 1;
 select b.ticket_id into tk2 from public.black_cards b where b.status='active' and b.ticket_id<>tk limit 1;
 select t.id into refunded from public.tickets t join public.ticket_products p on p.id=t.ticket_product_id where p.code='black_card' and t.status='refunded' limit 1;
 select id into staff from public.profiles where roles && array['scanner','staff','organizer','admin']::text[] limit 1;
 if tk is null or tk2 is null or staff is null then raise exception 'Missing isolated scanner test prerequisites'; end if;
 canonical:=replace(pg_get_functiondef('public.scan_ticket(uuid,date)'::regprocedure),'public.scan_ticket(', 'pg_temp.scan_ticket(');
 cross_event:=replace(replace(pg_get_functiondef('public.scan_ticket_at_event(uuid,uuid)'::regprocedure),'public.scan_ticket_at_event(', 'pg_temp.scan_ticket_at_event('),'public.scan_ticket(p_ticket)','pg_temp.scan_ticket(p_ticket)');
 begin
  create temporary table jd_black_card_scan_test_guard(id integer) on commit drop;
  perform set_config('request.jwt.claim.sub',staff::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',staff,'role','authenticated')::text,true);
  insert into public.events(title,city,starts_on,ends_on,capacity,status,moderation)
  values('JD · Paris · rollback access test '||gen_random_uuid(),'Paris','2027-03-08','2027-03-08',1,'upcoming','pending') returning id into ev;
  if exists(select 1 from public.black_card_event_access where event_id=ev and active) then raise exception 'Draft event granted access'; end if;
  update public.events set moderation='approved' where id=ev;
  if not exists(select 1 from public.black_card_event_access where event_id=ev and active and access_start_date='2027-03-08') then raise exception 'Published event missing automatic access'; end if;
  update public.events set city='Lyon' where id=ev;
  if exists(select 1 from public.black_card_event_access where event_id=ev and active) then raise exception 'Other city included'; end if;
  update public.events set city='Paris',starts_on='2027-03-15',ends_on='2027-03-15' where id=ev;
  if exists(select 1 from public.black_card_event_access where event_id=ev and active) then raise exception 'Out-of-week event included'; end if;
  update public.events set starts_on='2027-03-08',ends_on='2027-03-08' where id=ev;
  -- Canonical preselections and finals, with one scan per day.
  for day in 11..14 loop
   stamp:=quote_literal('2027-03-'||day||'T12:00:00+01:00')||'::timestamptz';
   execute replace(canonical,'now()',stamp);
   execute replace(cross_event,'now()',stamp);
   response:=pg_temp.scan_ticket_at_event(tk,'eb0025ca-b597-4708-9d47-b24ebbf507b5');
   if response->>'ok'<>'true' then raise exception 'Canonical day % refused: %',day,response; end if;
   response:=pg_temp.scan_ticket_at_event(tk,'eb0025ca-b597-4708-9d47-b24ebbf507b5');
   if response->>'error'<>'already_scanned_today' then raise exception 'Canonical duplicate accepted'; end if;
  end loop;
  if (select status from public.tickets where id=tk)<>'active' then raise exception 'Membership QR disabled after finals'; end if;
  if (select qr_token from public.tickets where id=tk) is distinct from qr_before then raise exception 'Membership QR changed'; end if;
  -- A separate event has its own daily scan and capacity check.
  stamp:=quote_literal('2027-03-08T12:00:00+01:00')||'::timestamptz';
  execute replace(cross_event,'now()',stamp);
  response:=pg_temp.scan_ticket_at_event(tk,ev);
  if response->>'ok'<>'true' then raise exception 'Week event refused: %',response; end if;
  response:=pg_temp.scan_ticket_at_event(tk,ev);
  if response->>'error'<>'already_scanned_today' then raise exception 'Week event duplicate accepted'; end if;
  response:=pg_temp.scan_ticket_at_event(tk2,ev);
  if response->>'error'<>'event_full' then raise exception 'Capacity not enforced: %',response; end if;
  if refunded is not null then
   response:=pg_temp.scan_ticket_at_event(refunded,ev);
   if response->>'error'<>'cancelled' then raise exception 'Refunded card accepted'; end if;
  end if;
  stamp:=quote_literal('2027-03-07T12:00:00+01:00')||'::timestamptz';
  execute replace(cross_event,'now()',stamp);
  response:=pg_temp.scan_ticket_at_event(tk,ev);
  if response->>'error'<>'wrong_day' then raise exception 'Wrong day accepted'; end if;
  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('request.jwt.claims','{}',true);
  response:=pg_temp.scan_ticket_at_event(tk,ev);
  if response->>'error'<>'scanner_forbidden' then raise exception 'Unauthorized scanner accepted'; end if;
  raise exception using errcode='ZX001',message='Successful simulations; rollback all fixtures and scans';
 exception when sqlstate 'ZX001' then null;
 end;
 select count(*) into count_after from public.ticket_scans;
 if count_after<>scans_before or (select count(*) from public.events)<>events_before then raise exception 'Test data persisted'; end if;
end $$;
