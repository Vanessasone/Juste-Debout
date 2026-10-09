-- VIP weekend passes cover only their actual product dates, not every daily
-- capacity row introduced for preselections. Serialize all categories per event.
create or replace function public.enforce_vip_daily_capacity() returns trigger
language plpgsql set search_path=public as $$
declare ev uuid; pr ticket_products%rowtype; ev_start date; d date; occupied integer; n integer;
begin
 select event_id into ev from ticket_orders where id=new.order_id;
 select * into pr from ticket_products where id=new.product_id;
 if ev is null or pr.code not in ('vip_sat','vip_sun','vip_two_days') then return new; end if;
 select starts_on into ev_start from events where id=ev;
 perform pg_advisory_xact_lock(hashtext(ev::text));
 for d in select access_date from event_daily_capacity where event_id=ev
 and ticket_product_covers_day(pr.access_date,pr.access_start_date,pr.access_days,ev_start,access_date)
 order by access_date loop
  select coalesce(sum(oi.quantity*oi.group_size),0) into occupied
  from ticket_order_items oi join ticket_orders o on o.id=oi.order_id join ticket_products p on p.id=oi.product_id
  where o.event_id=ev and o.status in ('pending','paid') and oi.id<>new.id
  and p.code in ('vip_sat','vip_sun','vip_two_days')
  and ticket_product_covers_day(p.access_date,p.access_start_date,p.access_days,ev_start,d);
  n:=new.quantity*greatest(new.group_size,1);
  if occupied+n>112 then raise exception 'vip_sold_out_for_day:%',d; end if;
 end loop;
 return new;
end $$;
drop trigger if exists trg_enforce_vip_daily_capacity on ticket_order_items;
create trigger trg_enforce_vip_daily_capacity before insert or update of quantity,group_size,product_id
on ticket_order_items for each row execute function enforce_vip_daily_capacity();

create or replace function public.vip_availability_2027() returns json
language sql stable security definer set search_path=public as $$
select json_build_object('capacity',112,'days',(
 select coalesce(json_agg(json_build_object('date',d.access_date,'reserved',coalesce(x.used,0),'remaining',greatest(0,112-coalesce(x.used,0))) order by d.access_date),'[]'::json)
 from event_daily_capacity d join events ev on ev.id=d.event_id
 left join lateral (
  select sum(oi.quantity*oi.group_size)::integer used from ticket_order_items oi
  join ticket_orders o on o.id=oi.order_id join ticket_products p on p.id=oi.product_id
  where o.event_id=d.event_id and o.status in ('pending','paid') and p.code in ('vip_sat','vip_sun','vip_two_days')
  and ticket_product_covers_day(p.access_date,p.access_start_date,p.access_days,ev.starts_on,d.access_date)
 )x on true
 where d.event_id='eb0025ca-b597-4708-9d47-b24ebbf507b5'
 and exists(select 1 from ticket_products p where p.event_id=d.event_id and p.code in ('vip_sat','vip_sun','vip_two_days')
 and ticket_product_covers_day(p.access_date,p.access_start_date,p.access_days,ev.starts_on,d.access_date))
),'black_card',(
 select json_build_object('capacity',coalesce(stock_total,56),'remaining',greatest(0,coalesce(stock_total,56)-sold_count-reserved_count))
 from ticket_products where event_id='eb0025ca-b597-4708-9d47-b24ebbf507b5' and code='black_card'
));
$$;
revoke all on function public.enforce_vip_daily_capacity() from public,anon,authenticated;
