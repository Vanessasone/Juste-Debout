revoke execute on function public.assign_family_ticket(uuid,text,text,date) from public,anon;
revoke execute on function public.entry_dashboard(uuid,date) from public,anon;
revoke execute on function public.entry_dashboard_details(uuid,date) from public,anon;
revoke execute on function public.scan_ticket(uuid,date) from public,anon;
grant execute on function public.assign_family_ticket(uuid,text,text,date), public.entry_dashboard(uuid,date), public.entry_dashboard_details(uuid,date), public.scan_ticket(uuid,date) to authenticated,service_role;
alter function public.ticket_product_covers_day(date,date,integer,date,date) set search_path = public;
