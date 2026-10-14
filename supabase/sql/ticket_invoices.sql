-- Apply before deploying checkout, webhook and email functions.
-- Issuer remains disabled until its VAT treatment has been confirmed.
begin;
alter table public.ticket_orders add column if not exists billing_address jsonb;

create table public.ticket_invoice_issuers (
 event_id uuid primary key references public.events(id),
 enabled boolean not null default false,
 legal_name text not null,
 address text not null,
 registration_number text not null,
 vat_number text,
 vat_rate_bps integer check (vat_rate_bps between 0 and 10000),
 exemption_note text,
 check (not enabled or (vat_rate_bps is not null and ((vat_rate_bps = 0 and nullif(trim(exemption_note),'') is not null)
   or (vat_rate_bps > 0 and nullif(trim(vat_number),'') is not null))))
);
insert into public.ticket_invoice_issuers(event_id,legal_name,address,registration_number)
select id,'JD EVENTS — Association loi 1901','3 rue de l’Est, 75020 Paris, France','SIRET 92464825600015'
from public.events where id='eb0025ca-b597-4708-9d47-b24ebbf507b5';

create table public.ticket_invoice_counters (
 year integer primary key,
 last_number integer not null check(last_number >= 0),
 last_issued_at timestamptz
);
create table public.ticket_invoices (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null unique references public.ticket_orders(id),
 number text not null unique,
 issued_at timestamptz not null default now(),
 snapshot jsonb not null,
 pdf_path text unique,
 ready_at timestamptz,
 email_sent_at timestamptz,
 provider_message_id text
);
create table public.ticket_invoice_jobs (
 order_id uuid primary key references public.ticket_orders(id),
 created_at timestamptz not null default now(),
 attempts integer not null default 0,
 next_attempt_at timestamptz not null default now(),
 lease_token uuid,
 lease_until timestamptz,
 done_at timestamptz,
 last_error text
);
create index ticket_invoice_pending on public.ticket_invoice_jobs(next_attempt_at) where done_at is null;

alter table public.ticket_invoice_issuers enable row level security;
alter table public.ticket_invoice_counters enable row level security;
alter table public.ticket_invoices enable row level security;
alter table public.ticket_invoice_jobs enable row level security;
revoke all on public.ticket_invoice_issuers,public.ticket_invoice_counters,public.ticket_invoice_jobs from anon,authenticated;
revoke all on public.ticket_invoices from anon,authenticated;
grant select on public.ticket_invoices to authenticated;
grant all on public.ticket_invoice_issuers,public.ticket_invoice_counters,public.ticket_invoices,public.ticket_invoice_jobs to service_role;
create policy invoice_buyer_read on public.ticket_invoices for select to authenticated
using (exists(select 1 from public.ticket_orders o where o.id=order_id and o.user_id=auth.uid()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('ticket-invoices','ticket-invoices',false,10485760,array['application/pdf'])
on conflict(id) do nothing;
-- No client Storage policy: downloads are authorized by the Edge Function.

create function public.enqueue_ticket_invoice() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.paid_at is not null and new.status in ('paid','refunded') then
   insert into public.ticket_invoice_jobs(order_id) values(new.id) on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function public.enqueue_ticket_invoice() from public,anon,authenticated;
create trigger queue_ticket_invoice after insert or update of status,paid_at,billing_address on public.ticket_orders
for each row execute function public.enqueue_ticket_invoice();

create function public.protect_ticket_invoice() returns trigger language plpgsql as $$
begin
 if new.id is distinct from old.id or new.order_id is distinct from old.order_id
 or new.number is distinct from old.number or new.issued_at is distinct from old.issued_at
 or new.snapshot is distinct from old.snapshot
 or (old.pdf_path is not null and new.pdf_path is distinct from old.pdf_path)
 then raise exception 'issued_invoice_is_immutable'; end if;
 return new;
end $$;
create trigger protect_ticket_invoice before update on public.ticket_invoices
for each row execute function public.protect_ticket_invoice();

-- Number assignment and immutable snapshots happen in the same transaction.
-- Row locks serialize claims; retries reuse the original invoice and number.
create function public.claim_ticket_invoice() returns jsonb language plpgsql security definer set search_path=public as $$
declare
 j public.ticket_invoice_jobs; o public.ticket_orders; s public.ticket_invoice_issuers;
 inv public.ticket_invoices; ev public.events; lines jsonb; seq integer; yr integer;
 token uuid := gen_random_uuid(); stamp timestamptz := clock_timestamp(); gross bigint;
begin
 select q.* into j from public.ticket_invoice_jobs q
 join public.ticket_orders ord on ord.id=q.order_id
 join public.ticket_invoice_issuers issuer on issuer.event_id=ord.event_id and issuer.enabled
 where q.done_at is null and q.next_attempt_at <= now() and (q.lease_until is null or q.lease_until < now())
 and ord.paid_at is not null and ord.status in ('paid','refunded')
 and nullif(trim(ord.customer_name),'') is not null
 and nullif(trim(ord.customer_email),'') is not null
 and nullif(trim(ord.billing_address->>'line1'),'') is not null
 and nullif(trim(ord.billing_address->>'country'),'') is not null
 order by q.created_at for update of q skip locked limit 1;
 if not found then return null; end if;
 select * into o from public.ticket_orders where id=j.order_id for update;
 select * into s from public.ticket_invoice_issuers where event_id=o.event_id for share;
 if not s.enabled then return null; end if;
 select * into inv from public.ticket_invoices where order_id=o.id;
 if not found then
  select * into ev from public.events where id=o.event_id;
  select sum(unit_price_cents::bigint*quantity),jsonb_agg(jsonb_build_object(
    'name',product_name,'quantity',quantity,'unit_price_cents',unit_price_cents,
    'access_date',access_date,'access_days',access_days) order by created_at,id)
    into gross,lines from public.ticket_order_items where order_id=o.id;
  if lines is null or gross <> o.subtotal_cents or o.discount_cents < 0
    or o.total_cents <> o.subtotal_cents-o.discount_cents or o.total_cents <= 0 then
    update public.ticket_invoice_jobs set last_error='invoice_amount_mismatch',next_attempt_at=now()+interval '1 hour' where order_id=o.id;
    return null;
  end if;
  yr := extract(year from stamp at time zone 'Europe/Paris');
  insert into public.ticket_invoice_counters(year,last_number) values(yr,0) on conflict do nothing;
  update public.ticket_invoice_counters set last_number=last_number+1,
   last_issued_at=greatest(clock_timestamp(),last_issued_at)
   where year=yr returning last_number,last_issued_at into seq,stamp;
  insert into public.ticket_invoices(order_id,number,issued_at,snapshot)
  values(o.id,'JD-BIL-'||yr||'-'||lpad(seq::text, greatest(6,length(seq::text)), '0'),stamp,
   jsonb_build_object('order_id',o.id,'paid_at',o.paid_at,'currency',upper(o.currency),
    'subtotal_cents',o.subtotal_cents,'discount_cents',o.discount_cents,'total_cents',o.total_cents,
    'seller',jsonb_build_object('name',s.legal_name,'address',s.address,'registration',s.registration_number,
      'vat_number',s.vat_number,'vat_rate_bps',s.vat_rate_bps,'exemption_note',s.exemption_note),
    'buyer',jsonb_build_object('name',o.customer_name,'email',o.customer_email,'address',o.billing_address),
    'event',jsonb_build_object('title',ev.title,'starts_on',ev.starts_on,'ends_on',ev.ends_on),
    'items',lines)) returning * into inv;
 end if;
 update public.ticket_invoice_jobs set lease_token=token,lease_until=now()+interval '5 minutes',attempts=attempts+1 where order_id=o.id;
 return to_jsonb(inv)||jsonb_build_object('lease_token',token,'attempts',j.attempts+1);
end $$;
revoke all on function public.claim_ticket_invoice() from public,anon,authenticated;
grant execute on function public.claim_ticket_invoice() to service_role;

create function public.finish_ticket_invoice_job(p_order uuid,p_token uuid,p_error text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
 update public.ticket_invoice_jobs set lease_until=null,lease_token=null,
 done_at=case when p_error is null then now() else null end,
 last_error=left(p_error,250),
 next_attempt_at=now()+make_interval(secs=>least(3600,30*power(2,least(attempts,7)))::integer)
 where order_id=p_order and lease_token=p_token;
end $$;
revoke all on function public.finish_ticket_invoice_job(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.finish_ticket_invoice_job(uuid,uuid,text) to service_role;
commit;
