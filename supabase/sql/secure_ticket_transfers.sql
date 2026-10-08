-- Current verified owner controls invitations; no anonymous execution.
create or replace function public.prepare_ticket_transfer(p_ticket uuid,p_email text) returns json
language plpgsql security definer set search_path=public as $$
declare v public.tickets%rowtype; tok uuid; begin
 if auth.uid() is null then return json_build_object('ok',false,'error','login_required'); end if;
 select * into v from public.tickets where id=p_ticket for update;
 if not found then return json_build_object('ok',false,'error','ticket_not_found'); end if;
 if v.profile_id is distinct from auth.uid() then return json_build_object('ok',false,'error','forbidden'); end if;
 if v.status<>'active' then return json_build_object('ok',false,'error','ticket_not_active'); end if;
 if p_email is null or length(trim(p_email))>254 or trim(p_email)!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then return json_build_object('ok',false,'error','invalid_email'); end if;
 tok:=gen_random_uuid();
 update public.tickets set transfer_status='pending',transfer_email=lower(trim(p_email)),transfer_token=tok,transfer_sent_at=now() where id=p_ticket;
 return json_build_object('ok',true,'token',tok);
end $$;
create or replace function public.cancel_ticket_transfer(p_ticket uuid) returns json
language plpgsql security definer set search_path=public as $$
declare v public.tickets%rowtype; begin
 if auth.uid() is null then return json_build_object('ok',false,'error','login_required'); end if;
 select * into v from public.tickets where id=p_ticket for update;
 if not found then return json_build_object('ok',false,'error','ticket_not_found'); end if;
 if v.profile_id is distinct from auth.uid() then return json_build_object('ok',false,'error','forbidden'); end if;
 if v.transfer_status is distinct from 'pending' then return json_build_object('ok',false,'error','not_pending'); end if;
 update public.tickets set transfer_status='owned',transfer_email=null,transfer_token=null,transfer_sent_at=null where id=p_ticket;
 update public.ticket_transfer_batch_rows set status='cancelled' where ticket_id=p_ticket and status in ('pending','prepared');
 return json_build_object('ok',true);
end $$;
create or replace function public.accept_ticket_transfer(p_token uuid) returns json
language plpgsql security definer set search_path=public as $$
declare v public.tickets%rowtype; em text; confirmed timestamptz; begin
 if auth.uid() is null then return json_build_object('ok',false,'error','unauthorized'); end if;
 select email,email_confirmed_at into em,confirmed from auth.users where id=auth.uid();
 if confirmed is null or nullif(trim(em),'') is null then return json_build_object('ok',false,'error','email_confirmation_required'); end if;
 select * into v from public.tickets where transfer_token=p_token for update;
 if not found then return json_build_object('ok',false,'error','transfer_not_found'); end if;
 if v.transfer_status is distinct from 'pending' or v.status is distinct from 'active' then return json_build_object('ok',false,'error','transfer_unavailable'); end if;
 if lower(em) is distinct from lower(v.transfer_email) then return json_build_object('ok',false,'error','wrong_recipient'); end if;
 update public.tickets set profile_id=auth.uid(),holder_email=em,transfer_status='accepted',transferred_at=now(),transfer_token=null where id=v.id;
 return json_build_object('ok',true,'ticket_id',v.id);
end $$;
revoke execute on function public.prepare_ticket_transfer(uuid,text),public.cancel_ticket_transfer(uuid),public.accept_ticket_transfer(uuid) from public,anon;
grant execute on function public.prepare_ticket_transfer(uuid,text),public.cancel_ticket_transfer(uuid),public.accept_ticket_transfer(uuid) to authenticated,service_role;
