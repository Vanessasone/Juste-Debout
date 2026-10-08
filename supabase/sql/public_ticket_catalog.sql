create or replace function public.public_ticket_products(p_event uuid)
returns jsonb language sql stable security definer set search_path = public
as $$
select coalesce(jsonb_agg(to_jsonb(catalog) order by catalog.sort_order), '[]'::jsonb)
from (
 select p.id,p.event_id,p.code,p.name,p.description,p.price_cents,p.currency,p.active,p.sales_start,p.sales_end,p.min_per_order,p.max_per_order,p.group_size,p.access_days,p.access_date,p.access_start_date,p.audience,p.promo_eligible,p.sort_order
 from public.ticket_products p join public.events e on e.id=p.event_id
 where p.event_id=p_event and e.tickets_open=true and p.active=true and p.code not like 'internal_test_%'
) catalog;
$$;
revoke all on function public.public_ticket_products(uuid) from public;
grant execute on function public.public_ticket_products(uuid) to anon, authenticated, service_role;
