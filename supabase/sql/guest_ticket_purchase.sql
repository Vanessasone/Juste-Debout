-- Achat sans compte. Aucune lecture publique des commandes ou des QR.
alter table public.ticket_orders alter column user_id drop not null;
alter table public.ticket_orders add column customer_name text;
alter table public.ticket_orders add column customer_locale text not null default 'fr';
alter table public.ticket_orders add constraint ticket_guest_email_required check (user_id is not null or (customer_email is not null and length(btrim(customer_email))>3));
revoke all on function public.create_ticket_order_reserved(uuid,uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.create_ticket_order_reserved(uuid,uuid,text,jsonb,text) to service_role;

create table public.guest_ticket_rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  requests integer not null default 1,
  primary key(bucket,window_start)
);
alter table public.guest_ticket_rate_limits enable row level security;
revoke all on public.guest_ticket_rate_limits from public,anon,authenticated;
grant all on public.guest_ticket_rate_limits to service_role;
create function public.consume_guest_ticket_limit(p_bucket text, p_limit integer) returns boolean
language plpgsql security definer set search_path=public as $$
declare n integer; w timestamptz:=to_timestamp(floor(extract(epoch from now())/1800)*1800);
begin
  if length(p_bucket)<>64 or p_limit not between 1 and 30 then return false; end if;
  insert into public.guest_ticket_rate_limits(bucket,window_start) values(p_bucket,w)
  on conflict(bucket,window_start) do update set requests=guest_ticket_rate_limits.requests+1
  returning requests into n;
  return n<=p_limit;
end $$;
revoke all on function public.consume_guest_ticket_limit(text,integer) from public,anon,authenticated;
grant execute on function public.consume_guest_ticket_limit(text,integer) to service_role;

-- La Black Card d'un achat invité est émise lors du rattachement au compte.
create or replace function public.issue_black_card_for_ticket() returns trigger
language plpgsql security definer set search_path=public as $$
declare code text; n bigint; started timestamptz;
begin
  if new.profile_id is null then return new; end if;
  select tp.code into code from public.ticket_products tp where tp.id=new.ticket_product_id;
  if code='black_card' and not exists(select 1 from public.black_cards where ticket_id=new.id) then
    n:=nextval('public.black_card_number_seq');
    if n>70 then raise exception 'black_card_sold_out'; end if;
    select paid_at into started from public.ticket_orders where id=new.order_id;
    started:=coalesce(started,now());
    insert into public.black_cards(ticket_id,profile_id,card_number,valid_from,valid_until)
    values(new.id,new.profile_id,'2026-'||to_char(n,'FM0000'),started,started+interval '1 year')
    on conflict(ticket_id) do nothing;
  end if;
  return new;
end $$;
create trigger issue_guest_black_card_on_claim after update of profile_id on public.tickets
for each row when (old.profile_id is null and new.profile_id is not null)
execute function public.issue_black_card_for_ticket();

create function public.claim_guest_ticket_orders() returns jsonb
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); mail text; oid uuid; claimed integer:=0;
begin
  if uid is null then raise exception 'authentication_required'; end if;
  select lower(btrim(email)) into mail from auth.users where id=uid and email_confirmed_at is not null;
  if mail is null then raise exception 'verified_email_required'; end if;
  if not exists(select 1 from public.profiles where id=uid) then raise exception 'profile_required'; end if;
  for oid in select id from public.ticket_orders where user_id is null and status='paid'
    and lower(btrim(customer_email))=mail order by id for update loop
    update public.ticket_orders set user_id=uid,updated_at=now() where id=oid;
    update public.tickets t set profile_id=uid,purchaser_id=uid,
      holder_name=coalesce(t.holder_name,o.customer_name)
      from public.ticket_orders o where t.order_id=oid and o.id=oid
      and t.profile_id is null and t.purchaser_id is null;
    claimed:=claimed+1;
  end loop;
  return jsonb_build_object('ok',true,'orders_claimed',claimed);
end $$;
revoke all on function public.claim_guest_ticket_orders() from public,anon;
grant execute on function public.claim_guest_ticket_orders() to authenticated;
revoke all on function public.issue_black_card_for_ticket() from public,anon,authenticated;
