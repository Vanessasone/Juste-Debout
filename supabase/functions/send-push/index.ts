/**
 * send-push — envoie une notification push aux AUTRES membres d'une conversation.
 *
 * Sécurité :
 *  - l'appelant est identifié par son jeton de session (JWT) ;
 *  - on vérifie qu'il est bien membre de la conversation ;
 *  - les tokens push (service_role) ne sont jamais exposés à l'app.
 *
 * Déploiement : supabase functions deploy send-push
 * (SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis par le runtime.)
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SERVICE_ROLE) return json({ error: 'not_configured' }, 500);

    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'unauthorized' }, 401);

    const { conversationId, body } = await req.json().catch(() => ({}));
    if (!conversationId || !body) return json({ error: 'bad_request' }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Qui appelle ?
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401);
    const meId = userData.user.id;

    // L'appelant est-il membre de la conversation ?
    const { data: myMembership } = await admin
      .from('conversation_members')
      .select('profile_id')
      .eq('conversation_id', conversationId)
      .eq('profile_id', meId)
      .maybeSingle();
    if (!myMembership) return json({ error: 'forbidden' }, 403);

    // Nom de l'expéditeur (pour le titre).
    const { data: sender } = await admin
      .from('profiles')
      .select('alias, full_name')
      .eq('id', meId)
      .maybeSingle();
    const senderName = sender?.alias || sender?.full_name || 'Nouveau message';

    // Autres membres + leurs tokens.
    const { data: members } = await admin
      .from('conversation_members')
      .select('profile_id')
      .eq('conversation_id', conversationId)
      .neq('profile_id', meId);
    const otherIds = (members ?? []).map((m: { profile_id: string }) => m.profile_id);
    if (otherIds.length === 0) return json({ ok: true, sent: 0 });

    const { data: locs } = await admin
      .from('profile_location')
      .select('push_token')
      .in('profile_id', otherIds);
    const tokens = (locs ?? [])
      .map((l: { push_token: string | null }) => l.push_token)
      .filter((t: string | null): t is string => !!t && t.startsWith('ExponentPushToken'));
    if (tokens.length === 0) return json({ ok: true, sent: 0 });

    const messages = tokens.map((to) => ({
      to,
      sound: 'default',
      title: senderName,
      body: String(body).slice(0, 180),
      data: { conversationId },
    }));

    const resp = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    const result = await resp.json().catch(() => null);
    return json({ ok: true, sent: tokens.length, result });
  } catch (e) {
    return json({ error: 'exception', detail: String(e) }, 500);
  }
});
