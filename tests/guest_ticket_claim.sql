-- Recette production entièrement annulée, aucune requête Stripe ni aucun e-mail envoyé.
begin;
do $$
declare ev uuid:='eb0025ca-b597-4708-9d47-b24ebbf507b5'; uid uuid; wrong uuid; mail text; pid uuid; oid uuid; result jsonb; n integer;
begin
  select u.id,u.email into uid,mail from auth.users u join public.profiles p on p.id=u.id
    where u.email_confirmed_at is not null order by u.created_at limit 1;
  select u.id into wrong from auth.users u join public.profiles p on p.id=u.id
    where u.email_confirmed_at is not null and lower(u.email)<>lower(mail) limit 1;
  select id into pid from public.ticket_products where event_id=ev and code='day_sat';
  if uid is null or wrong is null or pid is null then raise exception 'fixture_missing'; end if;
  update public.ticket_products set sales_start=now()-interval '1 day',sales_end=null where id=pid;
  result:=public.create_ticket_order_reserved(null,ev,mail,jsonb_build_array(jsonb_build_object('productId',pid,'quantity',1)),null)::jsonb;
  if not (result->>'ok')::boolean then raise exception 'reservation_failed: %',result; end if;
  oid:=(result->>'order_id')::uuid;
  update public.ticket_orders set customer_name='RECETTE ISOLÉE' where id=oid;
  result:=public.finalize_ticket_order(oid,null,mail)::jsonb;
  if not (result->>'ok')::boolean then raise exception 'finalization_failed: %',result; end if;
  if not exists(select 1 from public.tickets where order_id=oid and profile_id is null and purchaser_id is null and length(qr_token)>10) then raise exception 'guest_ticket_missing'; end if;
  perform set_config('request.jwt.claim.sub',wrong::text,true);
  result:=public.claim_guest_ticket_orders();
  if (result->>'orders_claimed')::int<>0 or exists(select 1 from public.ticket_orders where id=oid and user_id is not null) then raise exception 'wrong_email_claimed'; end if;
  perform set_config('request.jwt.claim.sub',uid::text,true);
  result:=public.claim_guest_ticket_orders();
  if (result->>'orders_claimed')::int<>1 then raise exception 'verified_claim_failed: %',result; end if;
  if not exists(select 1 from public.tickets where order_id=oid and profile_id=uid and purchaser_id=uid and holder_name='RECETTE ISOLÉE') then raise exception 'ownership_missing'; end if;
  result:=public.claim_guest_ticket_orders();
  if (result->>'orders_claimed')::int<>0 then raise exception 'claim_not_idempotent'; end if;
  perform set_config('request.jwt.claim.sub','',true);
  begin perform public.claim_guest_ticket_orders(); raise exception 'anonymous_claim_allowed'; exception when others then if sqlerrm<>'authentication_required' then raise; end if; end;
  if has_function_privilege('anon','public.claim_guest_ticket_orders()','EXECUTE') then raise exception 'anon_permission'; end if;
  if has_function_privilege('authenticated','public.create_ticket_order_reserved(uuid,uuid,text,jsonb,text)','EXECUTE') then raise exception 'direct_reservation_permission'; end if;
  if not exists(select 1 from public.ticket_email_outbox where source_id=oid and status='pending') then raise exception 'email_queue_missing'; end if;
  raise notice 'Guest reservation, payment finalization, QR, wrong-email rejection, verified claim, idempotency, anonymous rejection and outbox: PASS';
end $$;
select 'guest_claim_tests_passed_rollback' as result;
rollback;
