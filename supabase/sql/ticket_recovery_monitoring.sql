-- Explicit customer-requested re-sends; preserve the original confirmation record.
alter table public.ticket_email_outbox add column if not exists resend_request_id uuid;
drop index if exists public.ticket_email_unique_confirmation;
create unique index ticket_email_unique_confirmation on public.ticket_email_outbox(source_id,recipient_email)
where kind='confirmation' and resend_request_id is null;

create or replace function public.resend_my_ticket_confirmations() returns jsonb
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); mail text; o record; queued integer:=0;
begin
 if uid is null then raise exception 'authentication_required'; end if;
 select lower(btrim(email)) into mail from auth.users where id=uid and email_confirmed_at is not null;
 if mail is null then raise exception 'verified_email_required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('jd_confirmation_resend:'||uid::text,0));
 if exists(select 1 from ticket_email_outbox where recipient_email=mail and resend_request_id is not null and created_at>now()-interval '10 minutes') then
 return jsonb_build_object('ok',true,'queued',0,'cooldown',true); end if;
 for o in select id from ticket_orders where status='paid' and lower(btrim(customer_email))=mail
 and (user_id=uid or user_id is null) and event_id='eb0025ca-b597-4708-9d47-b24ebbf507b5'
 and exists(select 1 from ticket_order_items i where i.order_id=ticket_orders.id)
 and not exists(select 1 from ticket_order_items i where i.order_id=ticket_orders.id and i.product_code ~ '^(internal_|test_)')
 order by paid_at desc limit 10 for update loop
  if not exists(select 1 from ticket_email_outbox where source_id=o.id and kind='confirmation' and status in ('pending','processing')) then
   insert into ticket_email_outbox(kind,source_id,recipient_email,resend_request_id) values('confirmation',o.id,mail,gen_random_uuid());
   queued:=queued+1;
  end if;
 end loop;
 return jsonb_build_object('ok',true,'queued',queued,'cooldown',false);
end $$;
revoke all on function public.resend_my_ticket_confirmations() from public,anon;
grant execute on function public.resend_my_ticket_confirmations() to authenticated,service_role;

-- A transfer moves the membership, sets the verified recipient's name and
-- invalidates the former holder's QR. No actual tickets are transferred here.
create or replace function public.accept_ticket_transfer(p_token uuid) returns json
language plpgsql security definer set search_path=public as $$
declare v public.tickets%rowtype; em text; confirmed timestamptz; recipient_name text;
begin
 if auth.uid() is null then return json_build_object('ok',false,'error','unauthorized'); end if;
 select email,email_confirmed_at into em,confirmed from auth.users where id=auth.uid();
 if confirmed is null or nullif(trim(em),'') is null then return json_build_object('ok',false,'error','email_confirmation_required'); end if;
 select * into v from public.tickets where transfer_token=p_token for update;
 if not found then return json_build_object('ok',false,'error','transfer_not_found'); end if;
 if v.transfer_status is distinct from 'pending' or v.status is distinct from 'active' then return json_build_object('ok',false,'error','transfer_unavailable'); end if;
 if lower(em) is distinct from lower(v.transfer_email) then return json_build_object('ok',false,'error','wrong_recipient'); end if;
 select coalesce(nullif(btrim(full_name),''),nullif(btrim(alias),'')) into recipient_name from profiles where id=auth.uid();
 if recipient_name is null then return json_build_object('ok',false,'error','holder_name_required'); end if;
 update tickets set profile_id=auth.uid(),holder_email=em,holder_name=recipient_name,qr_token=gen_random_uuid()::text,
 transfer_status='accepted',transferred_at=now(),transfer_token=null where id=v.id;
 update black_cards set profile_id=auth.uid() where ticket_id=v.id;
 return json_build_object('ok',true,'ticket_id',v.id);
end $$;
revoke all on function public.accept_ticket_transfer(uuid) from public,anon;
grant execute on function public.accept_ticket_transfer(uuid) to authenticated,service_role;

-- Read-only operations check. No email addresses, QR codes, or tokens returned.
create or replace function public.ticketing_health_check(p_event uuid default 'eb0025ca-b597-4708-9d47-b24ebbf507b5') returns jsonb
language sql stable security definer set search_path=public as $$
 with eligible as (
 select o.* from ticket_orders o where o.event_id=p_event
 and exists(select 1 from ticket_order_items i where i.order_id=o.id)
 and not exists(select 1 from ticket_order_items i where i.order_id=o.id and i.product_code ~ '^(internal_|test_)')
 ), checked as (
 select o.id,o.status,o.paid_at,
 (select coalesce(sum(i.quantity*i.group_size),0) from ticket_order_items i where i.order_id=o.id) expected,
 (select count(*) from tickets t where t.order_id=o.id) generated,
 (select count(*) from tickets t where t.order_id=o.id and nullif(btrim(t.qr_token),'') is null) missing_qr,
 (select count(*) from tickets t where t.order_id=o.id and t.status in ('active','used')) usable,
 (select count(*) from tickets t where t.order_id=o.id and t.status='active' and t.profile_id is null) awaiting_wallet,
 (select e.status from ticket_email_outbox e where e.kind='confirmation' and e.source_id=o.id order by e.created_at desc limit 1) email_status,
 (select e.created_at from ticket_email_outbox e where e.kind='confirmation' and e.source_id=o.id order by e.created_at desc limit 1) email_created
 from eligible o
 ), anomalies as (
 select id,'ticket_count_mismatch' issue from checked where status='paid' and paid_at<now()-interval '10 minutes' and generated<>expected
 union all select id,'missing_qr' from checked where status='paid' and missing_qr>0
 union all select id,'refund_still_usable' from checked where status='refunded' and usable>0
 union all select id,'confirmation_failed' from checked where status='paid' and email_status='failed'
 union all select id,'confirmation_missing_or_stalled' from checked where status='paid' and paid_at<now()-interval '30 minutes'
 and (email_status is null or (email_status in ('pending','processing') and email_created<now()-interval '30 minutes'))
 )
 select jsonb_build_object('checked_at',now(),'event_id',p_event,'anomaly_count',(select count(*) from anomalies),
 'anomalies',coalesce((select jsonb_agg(jsonb_build_object('reference',upper(left(id::text,8)),'issue',issue)) from anomalies),'[]'::jsonb),
 'awaiting_wallet',(select coalesce(sum(awaiting_wallet),0) from checked where status='paid'),
 'membership_holder_mismatches',(select count(*) from black_cards b join tickets t on t.id=b.ticket_id where t.event_id=p_event and b.status='active' and b.profile_id is distinct from t.profile_id));
$$;
revoke all on function public.ticketing_health_check(uuid) from public,anon,authenticated;
grant execute on function public.ticketing_health_check(uuid) to service_role;
