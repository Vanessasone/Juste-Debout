/**
 * Proxy d'images avec CORS — pour que les photos de danseurs (hébergées sur des sites tiers
 * sans en-têtes CORS) puissent être capturées dans la carte de rang partageable (web).
 * Déploiement PUBLIC (sans JWT) car appelé comme src d'une <img> :
 *   supabase functions deploy img --no-verify-jwt
 * Usage : /functions/v1/img?url=<url encodée de l'image>
 */
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const target = new URL(req.url).searchParams.get('url');
  if (!target || !/^https?:\/\//.test(target)) {
    return new Response('bad url', { status: 400, headers: cors });
  }
  try {
    const r = await fetch(target, { headers: { 'User-Agent': 'Mozilla/5.0 (TOTF image proxy)' } });
    if (!r.ok) return new Response('upstream ' + r.status, { status: 502, headers: cors });
    const ct = r.headers.get('content-type') ?? 'image/jpeg';
    if (!ct.startsWith('image/')) return new Response('not an image', { status: 415, headers: cors });
    const buf = await r.arrayBuffer();
    return new Response(buf, {
      headers: { ...cors, 'Content-Type': ct, 'Cache-Control': 'public, max-age=604800' },
    });
  } catch {
    return new Response('fetch failed', { status: 502, headers: cors });
  }
});
