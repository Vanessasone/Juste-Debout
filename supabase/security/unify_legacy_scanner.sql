CREATE OR REPLACE FUNCTION public.scan_entry(p_token text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare ticket_id uuid; ticket_type text; holder_name text; result json; legacy_result text;
begin
  if not public.is_scanner() then raise exception 'scanner required'; end if;
  select t.id,t.type,coalesce(t.holder_name,p.full_name,p.alias,'') into ticket_id,ticket_type,holder_name
  from public.tickets t left join public.profiles p on p.id=t.profile_id
  where t.qr_token=btrim(p_token) limit 1;
  if not found then return json_build_object('result','unknown'); end if;
  result:=public.scan_ticket(ticket_id);
  legacy_result:=case when result->>'ok'='true' then 'ok'
    when result->>'error' in ('already_scanned_today','already_used') then 'already_in'
    when result->>'error'='wrong_day' then 'wrong_day'
    when result->>'error'='cancelled' then 'cancelled'
    else 'unknown' end;
  return json_build_object('result',legacy_result,'type',ticket_type,'name',holder_name,
    'date',(now() at time zone 'Europe/Paris')::date,'entered_at',result->>'scanned_at',
    'category',result->>'category','category_code',result->>'category_code');
end $function$;
