-- Transactional regression tests; no invitations, emails, transfers or scans persist.
begin;
do $$
declare tk uuid; owner uuid; recipient uuid; recipient_email text; tok uuid;
 response json; before_qr text; before_number text; order_owner uuid; request_result jsonb;
begin
 select t.id,t.profile_id,t.qr_token,b.card_number into tk,owner,before_qr,before_number
 from tickets t join black_cards b on b.ticket_id=t.id where t.status='active' and b.status='active' limit 1;
 select u.id,u.email into recipient,recipient_email from auth.users u join profiles p on p.id=u.id
 where u.id<>owner and u.email_confirmed_at is not null and nullif(btrim(p.full_name),'') is not null limit 1;
 if tk is null or recipient is null then raise exception 'Missing transfer test prerequisite'; end if;
 perform set_config('request.jwt.claim.sub',owner::text,true);
 response:=prepare_ticket_transfer(tk,recipient_email);
 if response->>'ok'<>'true' then raise exception 'Transfer preparation failed'; end if;
 tok:=(response->>'token')::uuid;
 response:=accept_ticket_transfer(tok);
 if response->>'error'<>'wrong_recipient' then raise exception 'Wrong recipient accepted'; end if;
 perform set_config('request.jwt.claim.sub',recipient::text,true);
 response:=accept_ticket_transfer(tok);
 if response->>'ok'<>'true' then raise exception 'Transfer acceptance failed: %',response->>'error'; end if;
 if not exists(select 1 from black_cards where ticket_id=tk and profile_id=recipient and card_number=before_number) then raise exception 'Membership not transferred'; end if;
 if exists(select 1 from tickets where id=tk and qr_token=before_qr) then raise exception 'Old QR still valid'; end if;
 if not exists(select 1 from tickets t join profiles p on p.id=t.profile_id where t.id=tk and t.holder_name=p.full_name) then raise exception 'Holder name not updated'; end if;
 response:=accept_ticket_transfer(tok);
 if response->>'error'<>'transfer_not_found' then raise exception 'Transfer token reusable'; end if;
 perform set_config('request.jwt.claim.sub',owner::text,true);
 response:=prepare_ticket_transfer(tk,recipient_email);
 if response->>'error'<>'forbidden' then raise exception 'Old owner still controls ticket'; end if;
 -- Test self-service resend and cooldown; worker cannot see uncommitted jobs.
 select o.user_id into order_owner from ticket_orders o join auth.users u on u.id=o.user_id
 where o.status='paid' and u.email_confirmed_at is not null and lower(btrim(o.customer_email))=lower(btrim(u.email))
 and o.event_id='eb0025ca-b597-4708-9d47-b24ebbf507b5'
 and not exists(select 1 from ticket_order_items i where i.order_id=o.id and i.product_code ~ '^(internal_|test_)') limit 1;
 if order_owner is null then raise exception 'Missing recovery test prerequisite'; end if;
 perform set_config('request.jwt.claim.sub',order_owner::text,true);
 request_result:=resend_my_ticket_confirmations();
 if (request_result->>'queued')::int<1 then raise exception 'Recovery did not queue owned confirmations'; end if;
 request_result:=resend_my_ticket_confirmations();
 if request_result->>'cooldown'<>'true' or request_result->>'queued'<>'0' then raise exception 'Recovery cooldown missing'; end if;
 if exists(select 1 from ticket_email_outbox e join ticket_orders o on o.id=e.source_id join auth.users u on u.id=order_owner
 where e.resend_request_id is not null and e.created_at=now() and (lower(btrim(o.customer_email))<>lower(btrim(u.email)) or (o.user_id is not null and o.user_id<>order_owner))) then raise exception 'Recovery queued another owner confirmation'; end if;
 if has_function_privilege('anon','resend_my_ticket_confirmations()','execute') or has_function_privilege('authenticated','ticketing_health_check(uuid)','execute') then raise exception 'Private RPC exposed'; end if;
end $$;
rollback;
select public.ticketing_health_check() as health;
