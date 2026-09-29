-- JD — Billetterie : UNE entrée par billet. Type affiché au scan. Re-scan → « déjà entré à HH:MM ».
-- Pas de flux de sortie : un billet entré est consommé ; pour re-rentrer, il faut RACHETER un billet.
-- Statuts : active (valide, pas entré) → used (entré, consommé) ; cancelled. used_at = heure d'entrée.
-- À lancer dans Supabase → SQL Editor → Run. (RPC security definer, réservées scanner/admin.)

-- 1) SCAN ENTRÉE : marque l'entrée (une seule fois), renvoie le type + nom. Anti double-scan (garde atomique).
--    Si déjà entré → renvoie l'heure d'entrée (used_at) pour afficher « déjà entré à HH:MM ».
create or replace function public.scan_entry(p_token text)
returns json language plpgsql security definer set search_path = public as $$
declare rec record; upd int;
begin
  if not public.is_scanner() then raise exception 'scanner required'; end if;
  select t.id, t.status, t.type, t.used_at, coalesce(p.full_name, p.alias, '') as name
    into rec
    from public.tickets t left join public.profiles p on p.id = t.profile_id
    where t.qr_token = btrim(p_token) limit 1;
  if not found then return json_build_object('result','unknown'); end if;
  if rec.status = 'cancelled' then return json_build_object('result','cancelled','type',rec.type,'name',rec.name); end if;
  if rec.status in ('used','inside') then
    return json_build_object('result','already_in','type',rec.type,'name',rec.name,'entered_at',rec.used_at);
  end if;

  update public.tickets
    set status='used', used_at=now(), scanned_by=auth.uid()
    where id=rec.id and status='active';
  get diagnostics upd = row_count;
  if upd = 0 then
    -- course entre deux scanners : relire l'heure d'entrée
    select used_at into rec.used_at from public.tickets where id = rec.id;
    return json_build_object('result','already_in','type',rec.type,'name',rec.name,'entered_at',rec.used_at);
  end if;
  return json_build_object('result','ok','type',rec.type,'name',rec.name);
end $$;

-- 2) DÉLIVRER un billet (admin/scanner) : n'importe quel type, sans Stripe.
--    Sert à TESTER dès maintenant, ET aux ventes sur place (espèces) / invitations.
--    payment_method : 'cash' (payé sur place) | 'comp' (invitation) | 'test'.
create or replace function public.issue_ticket(
  p_event uuid, p_type text default 'day', p_payment text default 'cash', p_profile uuid default null
)
returns json language plpgsql security definer set search_path = public as $$
declare v_uid uuid := coalesce(p_profile, auth.uid()); v_id uuid; v_token text;
begin
  if not (public.is_scanner() or public.is_admin()) then raise exception 'staff required'; end if;
  if v_uid is null then return json_build_object('ok',false,'error','no_profile'); end if;
  insert into public.tickets (event_id, profile_id, type, status, payment_method)
  values (p_event, v_uid, p_type, 'active', p_payment)
  on conflict (event_id, profile_id, type) do update set payment_method = excluded.payment_method
  returning id, qr_token into v_id, v_token;
  return json_build_object('ok', true, 'ticket_id', v_id, 'qr_token', v_token);
end $$;

notify pgrst, 'reload schema';
