/**
 * nearby-push — notification planifiée « X danseurs près de toi ».
 *
 * Déclenchée par cron (pg_cron + pg_net). Pour chaque membre opt-in ayant
 * assez de danseurs dans son rayon (et hors cooldown), envoie une notif
 * dans SA langue, puis marque le cooldown.
 *
 * Sécurité : header `x-cron-secret` = secret CRON_SECRET (jamais côté app).
 * Déploiement :
 *   supabase functions deploy nearby-push
 *   supabase secrets set CRON_SECRET=<long-aléatoire>
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } });
}

// Textes localisés (%d = nombre de danseurs).
const MSG: Record<string, { title: string; body: (n: number) => string }> = {
  fr: { title: 'Juste Debout', body: (n) => `${n} danseur${n > 1 ? 's' : ''} de la communauté sont près de toi 👀` },
  en: { title: 'Juste Debout', body: (n) => `${n} community dancer${n > 1 ? 's' : ''} near you 👀` },
  de: { title: 'Juste Debout', body: (n) => `${n} Community-Tänzer in deiner Nähe 👀` },
  it: { title: 'Juste Debout', body: (n) => `${n} ballerini della community vicino a te 👀` },
  es: { title: 'Juste Debout', body: (n) => `${n} bailarines de la comunidad cerca de ti 👀` },
  pt: { title: 'Juste Debout', body: (n) => `${n} dançarinos da comunidade perto de ti 👀` },
  zh: { title: 'Juste Debout', body: (n) => `你附近有 ${n} 位社区舞者 👀` },
  ko: { title: 'Juste Debout', body: (n) => `내 주변에 커뮤니티 댄서 ${n}명 👀` },
  ja: { title: 'Juste Debout', body: (n) => `近くにコミュニティのダンサーが${n}人 👀` },
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const CRON_SECRET = Deno.env.get('CRON_SECRET');
    if (!SUPABASE_URL || !SERVICE_ROLE || !CRON_SECRET) return json({ error: 'not_configured' }, 500);

    // Seul le cron (avec le secret) peut déclencher.
    if (req.headers.get('x-cron-secret') !== CRON_SECRET) return json({ error: 'unauthorized' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: targets, error } = await admin.rpc('nearby_push_targets', { p_radius_km: 50, p_min: 3, p_cooldown_hours: 20 });
    if (error) return json({ error: 'rpc_failed', detail: error.message }, 500);
    const rows = (targets ?? []) as { profile_id: string; push_token: string; lang: string; nearby: number }[];
    if (rows.length === 0) return json({ ok: true, sent: 0 });

    const messages = rows
      .filter((r) => r.push_token?.startsWith('ExponentPushToken'))
      .map((r) => {
        const m = MSG[r.lang] ?? MSG.en;
        return { to: r.push_token, sound: 'default', title: m.title, body: m.body(r.nearby), data: { kind: 'nearby' } };
      });
    if (messages.length === 0) return json({ ok: true, sent: 0 });

    // Envoi par lots de 100 (limite Expo).
    for (let i = 0; i < messages.length; i += 100) {
      const batch = messages.slice(i, i + 100);
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(batch),
      }).catch(() => null);
    }

    // Marque le cooldown pour tous les notifiés.
    await admin.rpc('mark_nearby_pushed', { p_ids: rows.map((r) => r.profile_id) });

    return json({ ok: true, sent: messages.length });
  } catch (e) {
    return json({ error: 'exception', detail: String(e) }, 500);
  }
});
