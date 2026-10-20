-- Black Card offer confirmed by Vanessa on 20 October 2026.
alter table public.black_cards alter column merchandise_discount_percent set default 20;
update public.black_cards set merchandise_discount_percent=20 where merchandise_discount_percent is distinct from 20;

create or replace function public.sync_black_card_paris_week_2027_access()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.id='eb0025ca-b597-4708-9d47-b24ebbf507b5'::uuid then return new; end if;
 -- Do not turn imported aliases of the two finals into separate admissions.
 if lower(trim(coalesce(new.city,'')))='paris'
 and new.starts_on >= date '2027-03-06' and new.ends_on <= date '2027-03-14'
 and new.ends_on >= new.starts_on and new.moderation='approved'
 and new.status in ('upcoming','ongoing','live')
 and (new.season_id='00000000-0000-0000-0000-000000000026'::uuid
      or new.title ~* '(^JD[ ·:-]|Juste[ -]?Debout|Hip[ -]?Hop Dance Week)')
 -- Les Twins workshops are excluded; their other appearances remain eligible.
 and not (new.title ~* '\mTwins\M' and new.title ~* '\m(workshops?|stages?|masterclass(es)?)\M')
 and new.title !~* '^(JD · Paris · (13|14) mars 2027|Juste Debout · Paris · 2027-03-(13|14))$'
 then
  insert into public.black_card_event_access(event_id,active,access_start_date,access_end_date,auto_managed)
  values(new.id,true,new.starts_on,new.ends_on,true)
  on conflict(event_id) do update set active=true,access_start_date=excluded.access_start_date,
    access_end_date=excluded.access_end_date,auto_managed=true
  where black_card_event_access.auto_managed;
 else
  update public.black_card_event_access set active=false where event_id=new.id and auto_managed;
 end if;
 return new;
end $$;
revoke all on function public.sync_black_card_paris_week_2027_access() from public,anon,authenticated;

update public.black_card_event_access b set active=false from public.events e
where b.event_id=e.id and lower(trim(coalesce(e.city,'')))='paris'
and e.starts_on >= date '2027-03-06' and e.ends_on <= date '2027-03-14'
and e.title ~* '\mTwins\M' and e.title ~* '\m(workshops?|stages?|masterclass(es)?)\M';
