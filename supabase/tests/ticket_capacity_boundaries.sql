begin;
do $$
declare ev uuid:='eb0025ca-b597-4708-9d47-b24ebbf507b5'; p ticket_products%rowtype; r json; o uuid;
begin
 for p in select * from ticket_products where event_id=ev and code in ('three_days','four_days') loop
 r:=create_ticket_order_reserved(null,ev,'rollback@example.invalid',jsonb_build_array(jsonb_build_object('productId',p.id,'quantity',1)),null);
 if r->>'ok'<>'true' or (r->>'total_cents')::int<>(case when p.code='three_days' then 10500 else 13000 end) then raise exception 'multiday reservation failed'; end if;
 end loop;
 select * into p from ticket_products where event_id=ev and code='black_card';
 update ticket_products set stock_total=sold_count+reserved_count where id=p.id;
 r:=create_ticket_order_reserved(null,ev,'rollback@example.invalid',jsonb_build_array(jsonb_build_object('productId',p.id,'quantity',1)),null);
 if r->>'error'<>'sold_out' then raise exception 'Black Card stock guard failed'; end if;
 select * into p from ticket_products where event_id=ev and code='vip_two_days';
 insert into ticket_orders(event_id,status,customer_email) values(ev,'pending','rollback@example.invalid') returning id into o;
 begin
 insert into ticket_order_items(order_id,product_id,product_code,product_name,unit_price_cents,quantity,group_size,access_days) values(o,p.id,p.code,p.name,p.price_cents,113,1,2);
 raise exception 'VIP overflow accepted';
 exception when others then if sqlerrm not like 'vip_sold_out_for_day:%' then raise; end if; end;
 select * into p from ticket_products where event_id=ev and code='day_sat';
 update event_daily_capacity set capacity=1 where event_id=ev and access_date='2027-03-13';
 r:=create_ticket_order_reserved(null,ev,'rollback@example.invalid',jsonb_build_array(jsonb_build_object('productId',p.id,'quantity',1)),null);
 if r->>'error'<>'sold_out_for_day' then raise exception 'Daily guard failed: %',r->>'error'; end if;
end $$;
rollback;
select jsonb_build_object('availability',vip_availability_2027(),'health',ticketing_health_check(),'test_orders',(select count(*) from ticket_orders where customer_email='rollback@example.invalid'));