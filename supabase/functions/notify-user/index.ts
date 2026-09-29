/**
 * notify-user — envoie un push social à UN utilisateur précis (suivi / like / commentaire).
 *
 * Sécurité : l'appelant (l'acteur) est identifié par son JWT ; on ne notifie jamais
 * soi-même ; les tokens push (service_role) ne sont jamais exposés à l'app.
 *
 * Body : { recipient: uuid, type: 'follow' | 'like' | 'comment' }
 * Déploiement : npx supabase functions deploy notify-user
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

const ACTION: Record<string, string> = {
  follow: 'a commencé à te suivre',
  like: 'a aimé ton moment',
  comment: 'a commenté ton moment',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SERVICE_ROLE) return json({ error: 'not_configured' }, 500);

    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'unauthorized' }, 401);

    const { recipient, type } = await req.json().catch(() => ({}));
    if (!recipient || !ACTION[type]) return json({ error: 'bad_request' }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401);
    const meId = userData.user.id;
    if (meId === recipient) return json({ ok: true, sent: 0 }); // jamais soi-même

    const { data: actor } = await admin
      .from('profiles')
      .select('alias, full_name')
      .eq('id', meId)
      .maybeSingle();
    const actorName = actor?.alias || actor?.full_name || 'Quelqu\'un';

    const { data: loc } = await admin
      .from('profile_location')
      .select('push_token')
      .eq('profile_id', recipient)
      .maybeSingle();
    const token = loc?.push_token;
    if (!token || !token.startsWith('ExponentPushToken')) return json({ ok: true, sent: 0 });

    const message = {
      to: token,
      sound: 'default',
      title: actorName,
      body: ACTION[type],
      data: { kind: 'social', type },
    };

    const resp = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify([message]),
    });
    const result = await resp.json().catch(() => null);
    return json({ ok: true, sent: 1, result });
  } catch (e) {
    return json({ error: 'exception', detail: String(e) }, 500);
  }
});
