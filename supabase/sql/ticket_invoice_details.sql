begin;
create table public.ticket_invoice_details_requests (
 email text not null,
 event_id uuid not null references public.events(id),
 created_at timestamptz not null default now(),
 attempts integer not null default 0,
 next_attempt_at timestamptz not null default now(),
 lease_token uuid,
 lease_until timestamptz,
 sent_at timestamptz,
 provider_message_id text,
 last_error text,
 primary key(event_id,email)
);
alter table public.ticket_invoice_details_requests enable row level security;
revoke all on public.ticket_invoice_details_requests from public,anon,authenticated;
grant all on public.ticket_invoice_details_requests to service_role;

create function public.complete_my_ticket_invoice_details(p_name text,p_address jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); o record; n integer:=0; clean jsonb;
begin
 if uid is null or not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null) then raise exception 'verified_account_required';end if;
 if length(trim(p_name)) not between 2 and 160 or p_name is null
 or jsonb_typeof(p_address) is distinct from 'object' or length(p_address::text)>5000
 or coalesce(length(trim(p_address->>'line1')),0) not between 2 and 240
 or coalesce(length(trim(p_address->>'city')),0) not between 1 and 120
 or coalesce(p_address->>'country','') !~ '^[A-Za-z]{2}$'
 or (upper(p_address->>'country')='FR' and coalesce(trim(p_address->>'postal_code'),'') !~ '^[0-9]{5}$')
 then raise exception 'invalid_billing_details';end if;
 clean:=jsonb_build_object('line1',trim(p_address->>'line1'),'line2',left(trim(p_address->>'line2'),240),
  'postal_code',left(trim(p_address->>'postal_code'),30),'city',trim(p_address->>'city'),
  'state',left(trim(p_address->>'state'),120),'country',upper(p_address->>'country'));
 for o in select ord.id from public.ticket_orders ord
  where ord.user_id=uid and ord.event_id='eb0025ca-b597-4708-9d47-b24ebbf507b5'
  and ord.status in ('paid','refunded') and ord.paid_at>='2026-10-08T19:00:00Z'
  and not exists(select 1 from public.ticket_invoices i where i.order_id=ord.id)
  and (nullif(trim(ord.billing_address->>'line1'),'') is null or nullif(trim(ord.billing_address->>'country'),'') is null or nullif(trim(ord.customer_name),'') is null)
  and not exists(select 1 from ticket_order_items i where i.order_id=ord.id and i.product_code ~ '^(internal_|test_)')
  order by ord.id for update of ord
 loop
  update public.ticket_orders set customer_name=trim(p_name),billing_address=clean where id=o.id;
  n:=n+1;
 end loop;
 return jsonb_build_object('ok',true,'queued',n);
end $$;
revoke all on function public.complete_my_ticket_invoice_details(text,jsonb) from public,anon;
grant execute on function public.complete_my_ticket_invoice_details(text,jsonb) to authenticated,service_role;

create function public.claim_invoice_details_request() returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.ticket_invoice_details_requests; token uuid:=gen_random_uuid();
begin
 select * into r from public.ticket_invoice_details_requests
 where sent_at is null and next_attempt_at<=now() and (lease_until is null or lease_until<now())
 order by created_at for update skip locked limit 1;
 if not found then return null;end if;
 -- If all missing details have already been completed, suppress the request.
 if not exists(select 1 from public.ticket_orders o where o.event_id=r.event_id and lower(o.customer_email)=r.email
  and o.paid_at>='2026-10-08T19:00:00Z' and o.status in ('paid','refunded')
  and (nullif(trim(o.billing_address->>'line1'),'') is null or nullif(trim(o.billing_address->>'country'),'') is null)
  and not exists(select 1 from ticket_order_items i where i.order_id=o.id and i.product_code ~ '^(internal_|test_)')) then
  update public.ticket_invoice_details_requests set sent_at=now(),last_error=null where event_id=r.event_id and email=r.email;
  return null;
 end if;
 update public.ticket_invoice_details_requests set lease_token=token,lease_until=now()+interval '5 minutes',attempts=attempts+1
 where event_id=r.event_id and email=r.email;
 return jsonb_build_object('email',r.email,'event_id',r.event_id,'lease_token',token);
end $$;
revoke all on function public.claim_invoice_details_request() from public,anon,authenticated;
grant execute on function public.claim_invoice_details_request() to service_role;

create function public.finish_invoice_details_request(p_event uuid,p_email text,p_token uuid,p_provider text,p_error text)
returns void language plpgsql security definer set search_path=public as $$
begin
 update public.ticket_invoice_details_requests set lease_token=null,lease_until=null,last_error=left(p_error,250),
  sent_at=case when p_error is null then now() else null end,provider_message_id=p_provider,
  next_attempt_at=now()+make_interval(secs=>least(3600,30*power(2,least(attempts,7)))::integer)
 where event_id=p_event and email=p_email and lease_token=p_token;
end $$;
revoke all on function public.finish_invoice_details_request(uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.finish_invoice_details_request(uuid,text,uuid,text,text) to service_role;
commit;
