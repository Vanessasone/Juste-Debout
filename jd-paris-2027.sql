-- Juste Debout — Finales Mondiales Paris : 13-14 mars 2027.
-- events.title est UNIQUE → upsert par titre. (Ajuste le titre si ton event existant diffère.)
-- À lancer dans Supabase → SQL Editor → Run.

-- 1) Voir d'abord les événements existants (repérer un éventuel doublon Paris) :
--    select id, title, city, starts_on, ends_on, status, tickets_open from public.events order by starts_on;

-- 2) Créer / mettre à jour les Finales Paris 2027.
insert into public.events (title, city, country, starts_on, ends_on, status, tickets_open)
values ('Juste Debout — Finales Mondiales Paris 2027', 'Paris', 'FR',
        date '2027-03-13', date '2027-03-14', 'upcoming', false)  -- tickets_open=false tant que le paiement n'est pas branché
on conflict (title) do update
  set city       = excluded.city,
      country    = excluded.country,
      starts_on  = excluded.starts_on,
      ends_on    = excluded.ends_on,
      status     = excluded.status;

-- 3) Pour ouvrir des RÉSERVATIONS GRATUITES (billet spectateur gratuit + QR) dès maintenant :
--    update public.events set tickets_open = true where title = 'Juste Debout — Finales Mondiales Paris 2027';
--    (⚠️ ne PAS ouvrir de vente PAYANTE avant Stripe — voir explication.)

notify pgrst, 'reload schema';
