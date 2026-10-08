CREATE OR REPLACE FUNCTION public.scan_ticket(p_ticket uuid, p_access_date date DEFAULT CURRENT_DATE)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v record; n integer; prev timestamptz; real_date date; first_day date; last_day date;
begin
 if not public.is_scanner() then return json_build_object('ok',false,'error','scanner_forbidden'); end if;
 select t.*,tp.access_days,tp.access_date,tp.access_start_date,tp.name as product_name,tp.code as product_code,e.starts_on,e.ends_on,e.city as event_city
 into v from public.tickets t left join public.ticket_products tp on tp.id=t.ticket_product_id
 left join public.events e on e.id=t.event_id where t.id=p_ticket for update of t;
 if not found then return json_build_object('ok',false,'error','not_found'); end if;
 real_date:=case when lower(coalesce(v.event_city,''))='paris' then (now() at time zone 'Europe/Paris')::date else current_date end;
 if v.status='cancelled' then return json_build_object('ok',false,'error','cancelled','category',coalesce(v.product_name,v.type),'category_code',v.product_code); end if;
 select scanned_at into prev from public.ticket_scans where ticket_id=p_ticket and access_date=real_date limit 1;
 if prev is not null then return json_build_object('ok',false,'error','already_scanned_today','scanned_at',prev,'category',coalesce(v.product_name,v.type),'category_code',v.product_code); end if;
 if v.status='used' then return json_build_object('ok',false,'error','already_used','scanned_at',v.used_at,'category',coalesce(v.product_name,v.type),'category_code',v.product_code); end if;
 if v.status<>'active' then return json_build_object('ok',false,'error','not_active','category',coalesce(v.product_name,v.type),'category_code',v.product_code); end if;
 first_day:=coalesce(v.access_start_date,v.access_date,v.starts_on);
 last_day:=case when v.access_start_date is not null then v.access_start_date+greatest(coalesce(v.access_days,1)-1,0)
 when v.access_date is not null then v.access_date
 when coalesce(v.access_days,1)=1 then v.starts_on else v.ends_on end;
 if first_day is null or last_day is null or real_date<first_day or real_date>last_day
 then return json_build_object('ok',false,'error','wrong_day','category',coalesce(v.product_name,v.type),'category_code',v.product_code); end if;
 insert into public.ticket_scans(ticket_id,access_date,scanned_by) values(p_ticket,real_date,auth.uid()) returning scanned_at into prev;
 select count(*) into n from public.ticket_scans where ticket_id=p_ticket;
 if real_date>=last_day or coalesce(v.access_days,1)<=1 or n>=coalesce(v.access_days,1) then
  update public.tickets set status='used',used_at=now(),scanned_by=auth.uid() where id=p_ticket;
 end if;
 return json_build_object('ok',true,'scan_count',n,'access_days',coalesce(v.access_days,1),'scanned_at',prev,'category',coalesce(v.product_name,v.type),'category_code',v.product_code);
end $function$
