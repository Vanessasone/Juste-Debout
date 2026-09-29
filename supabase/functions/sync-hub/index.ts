/**
 * sync-hub — synchronise les dates signées du « JD Hub Partners » vers la table `events` de l'app.
 *
 * Lit dans le Hub les `event_dates` de type `event` et de statut `approved`, remonte
 * l'organisation (ville / pays) via applications → organizations, et upsert un événement
 * dans l'app (clé d'idempotence : events.hub_date_id).
 *
 * Secrets requis (à définir côté app) :
 *   JD_HUB_URL           = https://cilhjygmkfoncktzwjzk.supabase.co
 *   JD_HUB_SERVICE_KEY   = clé service_role du Hub (RLS bypass en lecture)
 * (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY sont injectés automatiquement.)
 *
 * Déploiement :  npx supabase functions deploy sync-hub --project-ref ednymjqqcfrmpawebgrt
 */
const HUB_URL = Deno.env.get('JD_HUB_URL');
const HUB_KEY = Deno.env.get('JD_HUB_SERVICE_KEY');
const APP_URL = Deno.env.get('SUPABASE_URL');
const APP_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const SEASON = '00000000-0000-0000-0000-000000000026';

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
}

Deno.serve(async () => {
  if (!HUB_URL || !HUB_KEY) return json({ error: 'hub_not_configured' }, 500);
  if (!APP_URL || !APP_KEY) return json({ error: 'app_not_configured' }, 500);

  // 1) Lire les dates "event" approuvées du Hub (jointures imbriquées, service_role = bypass RLS).
  const select =
    'id,date,location,kind,status,applications(venue_name,organizations(name,city,country))';
  const hubRes = await fetch(
    `${HUB_URL}/rest/v1/event_dates?select=${encodeURIComponent(select)}&kind=eq.event&status=eq.approved`,
    { headers: { apikey: HUB_KEY, Authorization: `Bearer ${HUB_KEY}` } },
  );
  if (!hubRes.ok) return json({ error: 'hub_fetch_failed', detail: (await hubRes.text()).slice(0, 300) }, 502);
  const dates = (await hubRes.json()) as any[];

  // 2) Mapper → events et upsert (idempotent sur hub_date_id).
  let synced = 0;
  const skipped: string[] = [];
  for (const d of dates) {
    const org = d.applications?.organizations;
    if (!d.date || !org?.city) {
      skipped.push(d.id);
      continue;
    }
    const city: string = org.city;
    const country: string | null = org.country ?? null;
    const venue: string | null = d.location ?? d.applications?.venue_name ?? null;
    const row = {
      hub_date_id: d.id,
      season_id: SEASON,
      title: `Juste Debout · ${city} · ${d.date}`,
      city,
      country,
      venue,
      starts_on: d.date,
      ends_on: d.date,
      status: 'upcoming',
      tier: 'preselection',
      tickets_open: false,
    };
    const upRes = await fetch(`${APP_URL}/rest/v1/events?on_conflict=hub_date_id`, {
      method: 'POST',
      headers: {
        apikey: APP_KEY,
        Authorization: `Bearer ${APP_KEY}`,
        'content-type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(row),
    });
    if (upRes.ok) synced++;
    else skipped.push(`${d.id}:${upRes.status}`);
  }

  return json({ ok: true, from_hub: dates.length, synced, skipped });
});
