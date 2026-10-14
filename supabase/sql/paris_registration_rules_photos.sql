begin;
create schema if not exists jd_registration_private;
revoke all on schema jd_registration_private from public,anon,authenticated;
create table if not exists public.paris_rule_versions (
 version text primary key, content text not null, source_url text not null,
 created_at timestamptz not null default now()
);
insert into public.paris_rule_versions(version,content,source_url) values('paris-2027-v1','Règlement Juste Debout

Règles fondamentales applicables à toutes les pré-sélections & aux finales

Dans l’objectif de garantir une expérience fluide, équitable et respectueuse pour l’ensemble des danseur·ses, du public, du staff et des lieux partenaires, merci de prendre connaissance de la présente charte.

Cette charte vise à préserver l’esprit du Juste Debout : culture, respect, excellence, sécurité et célébration.

Important : en cas de non-respect de ces règles, la direction se réserve le droit de prendre toute mesure nécessaire au bon déroulement de l’événement, pouvant aller jusqu’à l’exclusion ou la disqualification.

Merci de lire attentivement & d''accepter ce règlement avant de vous enregistrer.

1) Tenue & visibilité (marques, accessoires)

1.1. Tenues autorisées
Afin de préserver la neutralité de l’événement et d’éviter toute communication non encadrée, les tenues doivent être sans marque commerciale visible.

Sont autorisés :
vêtements Juste Debout

vêtements faisant référence à des événements culturels de street dance (événements uniquement)

vêtements unis (“blank”), sans logo, sans slogan, sans marquage

1.2. Marquages interdits
Tout élément identifiable de marque (logo, nom, slogan, signature visuelle), sur n’importe quel vêtement, n’est pas autorisé, notamment sur :
casquettes / chapeaux

t-shirts, sweats, pulls

pantalons

chaussettes, manteaux/vestes

et tout autre textile

1.3. Accessoires
Pour des raisons d’équité, de sécurité et de lisibilité à l’image, merci de venir sans accessoires sur le dancefloor (liste non exhaustive) :
canettes, gourdes

drapeaux

objets promotionnels

1.4. Entourage / cercle autour du dancefloor
Les personnes présentes dans le cercle autour du dancefloor (supporters, entourage) sont invitées à respecter le même cadre.La direction pourra demander à certaines personnes de se repositionner ou de sortir du champ de vision si cela gêne le déroulé, l’image ou la sécurité.

1.5. Marques sous licence
Seules les marques officiellement partenaires (licence/accord) pourront être visibles sur le dancefloor ou à proximité.
Les danseurs peuvent être sponsorisés par une marque et peuvent donc porter le logo / l’identification de leur sponsor. Toutefois, toute visibilité de marque est strictement soumise à l’accord préalable de Juste Debout. Pour toute demande, merci de nous contacter en amont par email à vanessa@juste-debout.com

1.6. Décence / respect de l’espace public
Merci d’adopter une tenue adaptée à un événement public :
aucune nudité gratuite

aucune vulgarité visuelle

aucune partie génitale apparente, aucun téton apparent

1.7. Contrôle des tenues
Un contrôle pourra être effectué par un membre du staff avant l’entrée sur scène.En cas de non-conformité, une solution pourra être proposée (ex. retirer/couvrir un élément). Si la tenue ne peut pas être mise en conformité, l’accès à la scène pourra être refusé.

2) Attitude & comportement (sécurité, respect, esprit JD)

Juste Debout est une compétition, mais aussi une célébration de culture. Nous attendons :
du respect envers l’adversaire, le public et le staff

de la bienveillance, même dans l’intensité et la “rage de vaincre”

Merci de vous abstenir de :
tout contact physique violent ou perçu comme intrusif/dérangeant

toute insulte (verbale ou gestuelle)

2.1. Démonstrations d’affection sur scène
Par respect pour le cadre public de l’événement, merci d’éviter les embrassades et démonstrations d’affection sur scène.

3) Chorégraphie / synchronisation

Afin de préserver la spontanéité et l’essence du battle :
une seule combinaison / routine / synchro (peu importe le terme) est autorisée par rencontre, en 1 ou 2 passages maximum

par “synchronisation”, on entend un moment manifestement préparé à l’avance (impossible à deviner sans répétition)

Les styles, grooves, gimmicks et intentions sont les bienvenus, tant qu’ils ne reposent pas sur une multiplication de séquences synchronisées.

4) Durées, format & organisation

4.1. Format classique
1 minute par danseur·se

le passage est individuel : le/la danseur·se commence et finit son temps de manière identifiable (une chorée/combo peut se placer dans le cadre défini au point 3)

4.2. Prelims
1 minute au total pour les deux danseur·ses

la mi-temps ne sera pas annoncée : merci de gérer votre temps

4.3. Ponctualité
Pour respecter le timing de l’événement :
merci d’être prêt·e·s et proche du cypher lorsque vous êtes appelé·e·s

en cas de retard mettant en difficulté l’organisation, la direction pourra prendre une décision allant jusqu’à la disqualification

5) Micro / prise de parole

Aucune prise de parole au micro ne sera accordée ou tolérée pendant les rencontres.','https://www.juste-debout-shop.com/reglement') on conflict(version) do nothing;

alter table public.paris_rule_versions enable row level security;
revoke all on public.paris_rule_versions from anon,authenticated;
grant select on public.paris_rule_versions to authenticated;
create policy paris_rules_read on public.paris_rule_versions for select to authenticated using(true);

create or replace function jd_registration_private.verified_email() returns text
language sql stable security definer set search_path=public,pg_temp as $$
 select lower(u.email) from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null;
$$;
create or replace function jd_registration_private.can_read_draft(p_id uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select auth.uid() is not null and exists (
 select 1 from public.tour_registration_drafts d where d.id=p_id and d.stop_slug='paris' and (
 d.profile_id=auth.uid() or
 (case when d.category='Junior Dance Tour' then lower(d.payload->>'guardianEmail')=jd_registration_private.verified_email()
 else exists(select 1 from jsonb_array_elements(d.payload->'dancers') dancer where lower(dancer->>'email')=jd_registration_private.verified_email()) end)));
$$;
grant usage on schema jd_registration_private to authenticated;
grant execute on function jd_registration_private.can_read_draft(uuid) to authenticated;
revoke execute on function jd_registration_private.verified_email() from public,anon,authenticated;
revoke execute on function jd_registration_private.can_read_draft(uuid) from public,anon;
create policy paris_partner_read on public.tour_registration_drafts for select to authenticated using(jd_registration_private.can_read_draft(id));

create table if not exists public.paris_rule_signatures (
 id uuid primary key default gen_random_uuid(),
 draft_id uuid not null references public.tour_registration_drafts(id) on delete cascade,
 participant_index integer not null check(participant_index in (0,1)),
 signer_id uuid not null references auth.users(id), signer_name text not null,
 rules_version text not null references public.paris_rule_versions(version),
 snapshot_hash text not null, signed_at timestamptz not null default now(),
 unique(draft_id,participant_index,rules_version,snapshot_hash)
);
alter table public.paris_rule_signatures enable row level security;
revoke all on public.paris_rule_signatures from anon,authenticated;
grant select on public.paris_rule_signatures to authenticated;
create policy paris_signatures_read on public.paris_rule_signatures for select to authenticated using(jd_registration_private.can_read_draft(draft_id));

create or replace function public.sign_paris_registration_rules(p_draft_id uuid,p_signer_name text,p_rules_version text,p_agreed boolean)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.tour_registration_drafts; email text; person jsonb; idx integer; expected_name text; signature_id uuid;
begin
 if auth.uid() is null or p_agreed is distinct from true or p_rules_version is distinct from 'paris-2027-v1' then raise exception 'Signature non autorisée'; end if;
 email := jd_registration_private.verified_email();
 if email is null then raise exception 'Confirme ton adresse e-mail avant de signer'; end if;
 select * into d from public.tour_registration_drafts where id=p_draft_id and stop_slug='paris' for update;
 if d.id is null then raise exception 'Dossier inaccessible'; end if;
 if d.category='Junior Dance Tour' then
  if email is distinct from lower(trim(d.payload->>'guardianEmail')) then raise exception 'Seul le responsable légal peut signer ce dossier'; end if;
  idx:=0; expected_name:=d.payload->>'guardianName';
 else
  idx:=null;
  for person in select value from jsonb_array_elements(d.payload->'dancers') loop
   if email=lower(trim(person->>'email')) then
    idx := case when person=d.payload->'dancers'->0 then 0 else 1 end;
    expected_name:=person->>'name'; exit;
   end if;
  end loop;
  if idx is null then raise exception 'Signe avec l’e-mail indiqué pour ton propre participant'; end if;
 end if;
 if p_signer_name is null or lower(trim(p_signer_name)) is distinct from lower(trim(expected_name)) then raise exception 'Le nom du signataire doit correspondre au dossier'; end if;
 insert into public.paris_rule_signatures(draft_id,participant_index,signer_id,signer_name,rules_version,snapshot_hash)
 values(d.id,idx,auth.uid(),trim(p_signer_name),p_rules_version,md5(d.payload::text))
 on conflict(draft_id,participant_index,rules_version,snapshot_hash) do nothing returning id into signature_id;
 if signature_id is null then select id into signature_id from public.paris_rule_signatures where draft_id=d.id and participant_index=idx and rules_version=p_rules_version and snapshot_hash=md5(d.payload::text); end if;
 return signature_id;
end $$;
revoke all on function public.sign_paris_registration_rules(uuid,text,text,boolean) from public,anon;
grant execute on function public.sign_paris_registration_rules(uuid,text,text,boolean) to authenticated;

alter table public.registrations add column if not exists paris_draft_id uuid references public.tour_registration_drafts(id);
create table if not exists public.paris_registration_email_outbox (
 id uuid primary key default gen_random_uuid(), registration_id uuid not null references public.registrations(id),
 recipient_email text not null, rules_version text not null references public.paris_rule_versions(version),
 status text not null default 'pending' check(status in ('pending','processing','sent','failed')),
 attempts integer not null default 0, next_attempt_at timestamptz not null default now(),
 claimed_at timestamptz, sent_at timestamptz, provider_message_id text, last_error text,
 unique(registration_id,recipient_email)
);
alter table public.paris_registration_email_outbox enable row level security;
revoke all on public.paris_registration_email_outbox from anon,authenticated;
grant all on public.paris_registration_email_outbox to service_role;

create or replace function jd_registration_private.enforce_paris_signature() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.tour_registration_drafts; needed integer; actual integer; category_name text;
begin
 if new.type='dancer' and new.event_id in ('49f26ee9-8428-4a81-bd8c-ed20bad1f8f5'::uuid,'74551bf0-169e-4211-b12e-8a68b8da9661'::uuid,'443de16d-fa4b-45ad-8024-d3d9d341360a'::uuid,'8432aa43-66db-4cf8-95e7-1dab36fba367'::uuid) then raise exception 'Utilise le dossier officiel Juste Debout Paris 2027 pour participer'; end if;
 if new.event_id <> 'eb0025ca-b597-4708-9d47-b24ebbf507b5'::uuid or new.type <> 'dancer' or new.status='cancelled' then return new; end if;
 if current_setting('role',true)='authenticated' and new.status in ('paid','confirmed') and not public.is_admin() then raise exception 'Confirmation réservée à la production ou au paiement serveur'; end if;
 select * into d from public.tour_registration_drafts where id=new.paris_draft_id and stop_slug='paris' for update;
 if d.id is null or d.profile_id is distinct from new.profile_id then raise exception 'Dossier Paris signé requis'; end if;
 select name into category_name from public.categories where id=new.category_id;
 if category_name is distinct from d.category then raise exception 'Discipline différente du dossier signé'; end if;
 needed:=case when d.category='Junior Dance Tour' then 1 else 2 end;
 select count(distinct participant_index) into actual from public.paris_rule_signatures where draft_id=d.id and rules_version='paris-2027-v1' and snapshot_hash=md5(d.payload::text);
 if actual<>needed then raise exception 'Tous les participants doivent signer le règlement avant validation'; end if;
 return new;
end $$;
revoke all on function jd_registration_private.enforce_paris_signature() from public,anon,authenticated;
create trigger enforce_paris_signature before insert or update on public.registrations for each row execute function jd_registration_private.enforce_paris_signature();

create or replace function jd_registration_private.queue_paris_confirmation() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.tour_registration_drafts; dancer jsonb; recipient text;
begin
 if new.event_id <> 'eb0025ca-b597-4708-9d47-b24ebbf507b5'::uuid or new.type<>'dancer' or new.status not in ('confirmed','paid') then return new; end if;
 select * into d from public.tour_registration_drafts where id=new.paris_draft_id;
 if d.category='Junior Dance Tour' then
  recipient:=lower(trim(d.payload->>'guardianEmail'));
  insert into public.paris_registration_email_outbox(registration_id,recipient_email,rules_version) values(new.id,recipient,'paris-2027-v1') on conflict do nothing;
 else
  for dancer in select value from jsonb_array_elements(d.payload->'dancers') loop
   recipient:=lower(trim(dancer->>'email'));
   insert into public.paris_registration_email_outbox(registration_id,recipient_email,rules_version) values(new.id,recipient,'paris-2027-v1') on conflict do nothing;
  end loop;
 end if;
 return new;
end $$;
revoke all on function jd_registration_private.queue_paris_confirmation() from public,anon,authenticated;
create trigger queue_paris_confirmation after insert or update on public.registrations for each row execute function jd_registration_private.queue_paris_confirmation();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('registration-photos','registration-photos',false,5242880,array['image/jpeg','image/png']) on conflict(id) do nothing;
create policy registration_photos_insert on storage.objects for insert to authenticated with check(bucket_id='registration-photos' and (storage.foldername(name))[1]=auth.uid()::text);
create policy registration_photos_read on storage.objects for select to authenticated using(bucket_id='registration-photos' and (
 (storage.foldername(name))[1]=auth.uid()::text or exists (
  select 1 from public.tour_registration_drafts d where jd_registration_private.can_read_draft(d.id) and (
   d.payload->>'duoPhotoPath'=name or exists(select 1 from jsonb_array_elements(d.payload->'dancers') p where p->>'photoPath'=name)
 ))));

create or replace function jd_registration_private.protect_paris_draft() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare p jsonb; path text;
begin
 if tg_op='UPDATE' and exists(select 1 from public.registrations r where r.paris_draft_id=old.id and r.status <> 'cancelled') then raise exception 'Ce dossier est déjà soumis : contacte la production pour le modifier'; end if;
 if new.stop_slug='paris' then
  for p in select value from jsonb_array_elements(new.payload->'dancers') union all select jsonb_build_object('photoPath',new.payload->>'duoPhotoPath') loop
   path:=p->>'photoPath';
   if path is not null and (split_part(path,'/',1)<>new.profile_id::text or not exists(select 1 from storage.objects where bucket_id='registration-photos' and name=path)) then raise exception 'Photo non autorisée ou introuvable'; end if;
  end loop;
 end if;
 new.updated_at:=now(); return new;
end $$;
revoke all on function jd_registration_private.protect_paris_draft() from public,anon,authenticated;
create trigger protect_paris_draft before insert or update on public.tour_registration_drafts for each row execute function jd_registration_private.protect_paris_draft();

create or replace function public.claim_paris_registration_email_jobs()
returns setof public.paris_registration_email_outbox language sql security definer set search_path=public,pg_temp as $$
 with picked as (
  select id from public.paris_registration_email_outbox
  where attempts<6 and next_attempt_at<=now() and (status='pending' or (status='processing' and claimed_at<now()-interval '10 minutes'))
  order by next_attempt_at limit 10 for update skip locked
 ) update public.paris_registration_email_outbox j set status='processing',attempts=attempts+1,claimed_at=now()
 from picked where j.id=picked.id returning j.*;
$$;
revoke all on function public.claim_paris_registration_email_jobs() from public,anon,authenticated;
grant execute on function public.claim_paris_registration_email_jobs() to service_role;
commit;
