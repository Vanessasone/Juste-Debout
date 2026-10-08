alter table public.event_daily_capacity enable row level security;
create policy event_daily_capacity_read on public.event_daily_capacity for select to anon, authenticated using (true);
revoke insert, update, delete, truncate, references, trigger on public.event_daily_capacity from anon, authenticated;
