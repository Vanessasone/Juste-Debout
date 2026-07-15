/**
 * Suppression de compte (exigée par l'App Store).
 * Supprime l'utilisateur auth ; la base efface en cascade profil, inscriptions,
 * billets et votes (FK on delete cascade).
 *
 * Utilise le service_role (jamais exposé à l'app). SUPABASE_URL et
 * SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement par le runtime Supabase.
 *
 * Déploiement : supabase functions deploy delete-account
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

    // Identifie l'utilisateur à partir de son jeton de session.
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'unauthorized' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401);

    const { error: delErr } = await admin.auth.admin.deleteUser(userData.user.id);
    if (delErr) return json({ error: 'delete_failed', detail: delErr.message }, 500);

    return json({ ok: true });
  } catch (e) {
    return json({ error: 'exception', detail: String(e) }, 500);
  }
});
