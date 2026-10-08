create schema auth;
create function auth.role() returns text language sql as $$ select 'service_role'::text $$;
create table public.profiles(id uuid primary key,roles text[]);
create table public.event_daily_capacity(event_id uuid not null, access_date date not null, capacity integer not null);
create table public.events(id uuid default gen_random_uuid() not null, season_id uuid, title text not null, city text, country text, venue text, starts_on date, ends_on date, organizer_id uuid, capacity integer, status text default 'upcoming'::text not null, created_at timestamp with time zone default now() not null, grants_school_eligibility boolean default false not null, tier text default 'official'::text not null, tickets_open boolean default false not null, hub_date_id uuid, moderation text default 'approved'::text not null, address text, primary key(id));
create table public.ticket_order_items(id uuid default gen_random_uuid() not null, order_id uuid not null, product_id uuid not null, product_code text not null, product_name text not null, unit_price_cents integer not null, quantity integer not null, created_at timestamp with time zone default now() not null, group_size integer default 1 not null, access_days integer default 1 not null, access_date date, primary key(id));
create table public.ticket_orders(id uuid default gen_random_uuid() not null, user_id uuid not null, event_id uuid not null, status text default 'pending'::text not null, currency text default 'EUR'::text not null, subtotal_cents integer default 0 not null, total_cents integer default 0 not null, stripe_checkout_session_id text, stripe_payment_intent_id text, customer_email text, created_at timestamp with time zone default now() not null, paid_at timestamp with time zone, updated_at timestamp with time zone default now() not null, promotion_id uuid, promo_code text, discount_cents integer default 0 not null, primary key(id));
create table public.ticket_products(id uuid default gen_random_uuid() not null, event_id uuid not null, code text not null, name text not null, description text, price_cents integer not null, currency text default 'EUR'::text not null, active boolean default true not null, sales_start timestamp with time zone, sales_end timestamp with time zone, max_per_order integer default 10 not null, stock_total integer, sold_count integer default 0 not null, reserved_count integer default 0 not null, sort_order integer default 0 not null, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null, access_days integer default 1 not null, group_size integer default 1 not null, audience text default 'general'::text not null, promo_eligible boolean default true not null, access_date date, min_per_order integer default 1 not null, access_start_date date, primary key(id));
create table public.ticket_promotion_products(promotion_id uuid not null, product_id uuid not null, discount_value integer);
create table public.ticket_promotions(id uuid default gen_random_uuid() not null, code text not null, description text, discount_type text not null, discount_value integer not null, starts_at timestamp with time zone not null, ends_at timestamp with time zone not null, active boolean default true not null, created_at timestamp with time zone default now() not null, primary key(id));
CREATE OR REPLACE FUNCTION public.create_ticket_order_reserved(p_user uuid, p_event uuid, p_email text, p_items jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_event public.events%rowtype;
  v_order uuid;
  v_currency text := null;
  v_total integer := 0;
  v_item jsonb;
  v_product public.ticket_products%rowtype;
  v_qty integer;
begin
  select * into v_event from public.events where id = p_event for share;
  if not found then return json_build_object('ok',false,'error','event_not_found'); end if;
  if not v_event.tickets_open then return json_build_object('ok',false,'error','ticket_sales_closed'); end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return json_build_object('ok',false,'error','invalid_cart');
  end if;

  insert into public.ticket_orders(user_id,event_id,status,currency,subtotal_cents,total_cents,customer_email)
  values(p_user,p_event,'pending','EUR',0,0,p_email)
  returning id into v_order;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := greatest(0, floor(coalesce((v_item->>'quantity')::numeric,0)))::int;
    if v_qty < 1 then raise exception 'invalid_quantity'; end if;

    select * into v_product from public.ticket_products
    where id = (v_item->>'productId')::uuid for update;

    if not found or v_product.event_id <> p_event or not v_product.active then raise exception 'invalid_product'; end if;
    if v_product.sales_start is not null and v_product.sales_start > now() then raise exception 'sales_not_started'; end if;
    if v_product.sales_end is not null and v_product.sales_end < now() then raise exception 'sales_ended'; end if;
    if v_qty > v_product.max_per_order then raise exception 'quantity_too_high'; end if;
    if v_product.stock_total is not null and (v_product.sold_count + v_product.reserved_count + v_qty) > v_product.stock_total then
      raise exception 'sold_out';
    end if;
    if v_currency is null then v_currency := v_product.currency;
    elsif v_currency <> v_product.currency then raise exception 'mixed_currency'; end if;

    insert into public.ticket_order_items(order_id,product_id,product_code,product_name,unit_price_cents,quantity)
    values(v_order,v_product.id,v_product.code,v_product.name,v_product.price_cents,v_qty);
    update public.ticket_products set reserved_count = reserved_count + v_qty, updated_at = now() where id = v_product.id;
    v_total := v_total + (v_product.price_cents * v_qty);
  end loop;

  update public.ticket_orders
  set currency = coalesce(v_currency,'EUR'), subtotal_cents = v_total, total_cents = v_total, updated_at = now()
  where id = v_order;

  return json_build_object('ok',true,'order_id',v_order,'currency',coalesce(v_currency,'EUR'),'total_cents',v_total);
end $function$
;
CREATE OR REPLACE FUNCTION public.create_ticket_order_reserved(p_user uuid, p_event uuid, p_email text, p_items jsonb, p_promo_code text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ declare ev public.events%rowtype; oid uuid; cur text:='EUR'; sub integer:=0; disc integer:=0; it jsonb; pr public.ticket_products%rowtype; qty integer; promo public.ticket_promotions%rowtype; promo_ok boolean:=false; line_disc integer; override_disc integer; d date; cap integer; used integer; units integer; begin select * into ev from public.events where id=p_event for update; if not found then return json_build_object('ok',false,'error','event_not_found'); end if; if not ev.tickets_open then return json_build_object('ok',false,'error','ticket_sales_closed'); end if; if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then return json_build_object('ok',false,'error','invalid_cart'); end if; perform 1 from public.event_daily_capacity where event_id=p_event order by access_date for update; if p_promo_code is not null and btrim(p_promo_code)<>'' then select * into promo from public.ticket_promotions where upper(code)=upper(btrim(p_promo_code)) and active=true and starts_at<=now() and ends_at>=now() limit 1; if not found then return json_build_object('ok',false,'error','invalid_or_expired_promo'); end if; promo_ok:=true; end if; insert into public.ticket_orders(user_id,event_id,status,currency,subtotal_cents,total_cents,customer_email,promotion_id,promo_code,discount_cents) values(p_user,p_event,'pending','EUR',0,0,p_email,case when promo_ok then promo.id end,case when promo_ok then promo.code end,0) returning id into oid; for it in select * from jsonb_array_elements(p_items) loop qty:=greatest(0,floor(coalesce((it->>'quantity')::numeric,0)))::int; if qty<1 then raise exception 'invalid_quantity'; end if; select * into pr from public.ticket_products where id=(it->>'productId')::uuid for update; if not found or pr.event_id<>p_event or not pr.active then raise exception 'invalid_product'; end if; if pr.sales_start is not null and pr.sales_start>now() then raise exception 'sales_not_started'; end if; if pr.sales_end is not null and pr.sales_end<now() then raise exception 'sales_ended'; end if; if qty<pr.min_per_order then raise exception 'minimum_quantity_not_met'; end if; if qty>pr.max_per_order then raise exception 'quantity_too_high'; end if; units:=qty*greatest(pr.group_size,1); if pr.stock_total is not null and pr.sold_count+pr.reserved_count+units>pr.stock_total then raise exception 'sold_out'; end if; for d in select access_date from public.event_daily_capacity where event_id=p_event and public.ticket_product_covers_day(pr.access_date,pr.access_start_date,pr.access_days,ev.starts_on,access_date) order by access_date loop select capacity into cap from public.event_daily_capacity where event_id=p_event and access_date=d; select coalesce(sum(oi.quantity*oi.group_size),0) into used from public.ticket_order_items oi join public.ticket_orders o on o.id=oi.order_id join public.ticket_products tp on tp.id=oi.product_id where o.event_id=p_event and o.status in ('pending','paid') and public.ticket_product_covers_day(tp.access_date,tp.access_start_date,tp.access_days,ev.starts_on,d); if used+units>cap then raise exception 'sold_out_for_day'; end if; end loop; line_disc:=0; if promo_ok and pr.promo_eligible then select x.discount_value into override_disc from public.ticket_promotion_products x where x.promotion_id=promo.id and x.product_id=pr.id; if found and promo.discount_type='fixed_per_unit' then line_disc:=least(pr.price_cents,coalesce(override_disc,promo.discount_value))*qty; end if; end if; insert into public.ticket_order_items(order_id,product_id,product_code,product_name,unit_price_cents,quantity,group_size,access_days,access_date) values(oid,pr.id,pr.code,pr.name,pr.price_cents,qty,pr.group_size,pr.access_days,pr.access_date); update public.ticket_products set reserved_count=reserved_count+units,updated_at=now() where id=pr.id; sub:=sub+pr.price_cents*qty; disc:=disc+line_disc; end loop; update public.ticket_orders set subtotal_cents=sub,discount_cents=disc,total_cents=greatest(0,sub-disc),updated_at=now() where id=oid; return json_build_object('ok',true,'order_id',oid,'currency',cur,'subtotal_cents',sub,'discount_cents',disc,'total_cents',greatest(0,sub-disc)); exception when others then if oid is not null then perform public.release_ticket_order(oid,'cancelled'); end if; return json_build_object('ok',false,'error',sqlerrm); end $function$
;
CREATE OR REPLACE FUNCTION public.enforce_ticket_daily_capacity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare tp public.ticket_products%rowtype; o public.ticket_orders%rowtype; d date; cap integer; occupied integer; units integer; ev_start date;
begin
 select * into o from public.ticket_orders where id=new.order_id;
 select * into tp from public.ticket_products where id=new.product_id;
 if o.event_id is null or tp.id is null then raise exception 'invalid_ticket_order'; end if;
 select starts_on into ev_start from public.events where id=o.event_id;
 units:=new.quantity*greatest(new.group_size,1);
 perform pg_advisory_xact_lock(hashtext(o.event_id::text));
 for d,cap in select c.access_date,c.capacity from public.event_daily_capacity c
 where c.event_id=o.event_id and public.ticket_product_covers_day(tp.access_date,tp.access_start_date,tp.access_days,ev_start,c.access_date)
 order by c.access_date loop
  select coalesce(sum(oi.quantity*oi.group_size),0) into occupied
  from public.ticket_order_items oi
  join public.ticket_orders oo on oo.id=oi.order_id
  join public.ticket_products pp on pp.id=oi.product_id
  where oo.event_id=o.event_id and oo.status in ('pending','paid')
  and oi.id<>coalesce(new.id,'00000000-0000-0000-0000-000000000000'::uuid)
  and public.ticket_product_covers_day(pp.access_date,pp.access_start_date,pp.access_days,ev_start,d);
  if occupied+units>cap then raise exception 'daily_capacity_exceeded:%',d; end if;
 end loop;
 return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.enforce_vip_daily_capacity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare ev uuid; pr record; d date; occupied integer; n integer; begin
 select event_id into ev from public.ticket_orders where id=new.order_id;
 select code,access_date,access_days into pr from public.ticket_products where id=new.product_id;
 if ev is null or pr.code not in ('vip_sat','vip_sun','vip_two_days') then return new; end if;
 perform pg_advisory_xact_lock(hashtext(ev::text));
 for d in select access_date from public.event_daily_capacity where event_id=ev
 and (access_date=pr.access_date or (pr.access_date is null and pr.access_days>1))
 order by access_date loop
  select coalesce(sum(oi.quantity*oi.group_size),0) into occupied
  from public.ticket_order_items oi
  join public.ticket_orders o on o.id=oi.order_id
  join public.ticket_products p on p.id=oi.product_id
  where o.event_id=ev and o.status in ('pending','paid')
  and p.code in ('vip_sat','vip_sun','vip_two_days')
  and (p.access_date=d or (p.access_date is null and p.access_days>1));
  n:=new.quantity*greatest(new.group_size,1);
  if occupied+n>112 then raise exception 'vip_sold_out_for_day:%',d; end if;
 end loop;
 return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.guard_internal_four_day_test_purchase()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_code text; v_user uuid;
begin
 select code into v_code from public.ticket_products where id=new.product_id;
 if v_code='internal_test_4days_1eur' then
  select user_id into v_user from public.ticket_orders where id=new.order_id;
  if new.quantity<>1 or new.group_size<>1 or not exists (
    select 1 from public.profiles where id=v_user and roles && array['admin','organizer']::text[]
  ) then raise exception 'internal_test_purchase_forbidden'; end if;
  if coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'internal_test_requires_server_checkout';
  end if;
 end if;
 return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.release_ticket_order(p_order uuid, p_status text DEFAULT 'expired'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_order public.ticket_orders%rowtype; v_item record;
begin
  select * into v_order from public.ticket_orders where id=p_order for update;
  if not found then return json_build_object('ok',false,'error','order_not_found'); end if;
  if v_order.status <> 'pending' then return json_build_object('ok',true,'already_closed',true,'status',v_order.status); end if;

  for v_item in select product_id,quantity,group_size from public.ticket_order_items where order_id=p_order loop
    update public.ticket_products
    set reserved_count=greatest(0,reserved_count-(v_item.quantity*v_item.group_size)), updated_at=now()
    where id=v_item.product_id;
  end loop;

  update public.ticket_orders set status=p_status,updated_at=now() where id=p_order;
  return json_build_object('ok',true);
end $function$
;
CREATE OR REPLACE FUNCTION public.ticket_product_covers_day(p_access_date date, p_access_start_date date, p_access_days integer, p_event_start date, p_day date)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
 select p_day between coalesce(p_access_start_date,p_access_date,p_event_start)
 and (case when p_access_start_date is not null then p_access_start_date+greatest(coalesce(p_access_days,1)-1,0)
 when p_access_date is not null then p_access_date
 else p_event_start+greatest(coalesce(p_access_days,1)-1,0) end)
$function$
;
create trigger trg_enforce_ticket_daily_capacity before insert or update of quantity,group_size,product_id on public.ticket_order_items for each row execute function public.enforce_ticket_daily_capacity();
create trigger trg_enforce_vip_daily_capacity before insert on public.ticket_order_items for each row execute function public.enforce_vip_daily_capacity();
create trigger trg_guard_internal_four_day_test before insert or update of product_id,quantity,group_size on public.ticket_order_items for each row execute function public.guard_internal_four_day_test_purchase();
