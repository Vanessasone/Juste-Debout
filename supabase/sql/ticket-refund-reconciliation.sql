alter table public.ticket_orders add column if not exists refunded_cents integer not null default 0;
alter table public.ticket_orders add column if not exists refunded_at timestamptz;
create or replace function public.record_ticket_refund(p_payment_intent text,p_amount integer,p_currency text,p_refunded_cents integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare o public.ticket_orders%rowtype; item record;
begin
 select * into o from public.ticket_orders where stripe_payment_intent_id=p_payment_intent for update;
 if not found then return jsonb_build_object('ok',true,'ignored','unknown_payment'); end if;
 if p_amount is distinct from o.total_cents or lower(p_currency) is distinct from lower(o.currency)
 or p_refunded_cents is null or p_refunded_cents<0 or p_refunded_cents>p_amount then
 raise exception 'refund_amount_or_currency_mismatch';
 end if;
 if o.status='refunded' then return jsonb_build_object('ok',true,'already_refunded',true); end if;
 if o.status not in ('paid','partially_refunded') then raise exception 'refund_order_not_paid'; end if;
 update public.ticket_orders set refunded_cents=greatest(refunded_cents,p_refunded_cents),updated_at=now() where id=o.id;
 if p_refunded_cents<o.total_cents or o.total_cents=0 then
 return jsonb_build_object('ok',true,'partial',p_refunded_cents>0,'refunded_cents',p_refunded_cents); end if;
 update public.ticket_orders set status='refunded',refunded_at=now() where id=o.id;
 update public.tickets set status='refunded',transfer_status='cancelled',transfer_token=null where order_id=o.id;
 update public.black_cards set status='revoked' where ticket_id in(select id from public.tickets where order_id=o.id);
 for item in select product_id,sum(quantity*group_size)::integer units from public.ticket_order_items where order_id=o.id group by product_id order by product_id loop
 update public.ticket_products set sold_count=greatest(0,sold_count-item.units),updated_at=now() where id=item.product_id;
 end loop;
 return jsonb_build_object('ok',true,'refunded',true,'order_id',o.id);
end $$;
revoke all on function public.record_ticket_refund(text,integer,text,integer) from public,anon,authenticated;
grant execute on function public.record_ticket_refund(text,integer,text,integer) to service_role;
