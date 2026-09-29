/**
 * TOTF — assistant support (bot). Sans état : reçoit l'historique + le message, renvoie une réponse.
 * Escalade vers un humain gérée côté app (persistance d'un ticket). Réutilise ANTHROPIC_API_KEY.
 * Déploiement : supabase functions deploy totf-bot
 */
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-haiku-4-5-20251001';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SYSTEM = `Tu es l'assistant de TOP ON THE FLOOR (TOTF), l'app du classement mondial des danseurs (street dance) et de la carrière — "Dance & Business".

Ce que tu sais expliquer :
- Le CLASSEMENT : mondial, par saison, par catégorie (Street Dance / Dance Industry) et par DISCIPLINE (Hip Hop, Popping, House, BBoying, Locking, Waacking, Krump…). 16 223 danseurs.
- REVENDIQUER SON PROFIL ("C'est moi") : c'est une DEMANDE, on prouve via son Instagram, un admin valide → badge "Vérifié". "Ce n'est plus moi" pour se retirer.
- La CARTE de rang partageable (story Instagram) depuis une fiche.
- Le PALMARÈS : un danseur vérifié ajoute ses performances (battle, discipline, résultat) → validées par l'admin. Les résultats des events qui tournent sur le système de vote TOTF remontent AUTOMATIQUEMENT.
- Les BADGES (Top 100, Champion, Street & Industry, Crew…).
- Recherche par nom ou par Instagram.

RÈGLES :
- Français, ton chaleureux et concis (2-4 phrases max), culture street dance.
- Si tu ne sais pas, ou si la personne veut parler à un humain / signaler un problème sur ses données / une réclamation → invite-la clairement à toucher "Parler à un humain" pour joindre l'équipe.
- N'invente jamais de faits (chiffres, dates) non fournis.`;

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (!ANTHROPIC_API_KEY) return json({ error: 'not_configured' });
    const { history, message } = await req.json();
    const msgs = [
      ...(Array.isArray(history) ? history : [])
        .filter((m: any) => m && (m.role === 'user' || m.role === 'bot') && typeof m.text === 'string')
        .slice(-10)
        .map((m: any) => ({ role: m.role === 'bot' ? 'assistant' : 'user', content: String(m.text).slice(0, 1000) })),
      { role: 'user', content: String(message ?? '').slice(0, 1000) },
    ];
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 400, system: SYSTEM, messages: msgs }),
    });
    if (!resp.ok) return json({ error: 'upstream', detail: (await resp.text()).slice(0, 300) });
    const data = await resp.json();
    const text = (data.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim();
    return json({ text });
  } catch (e) {
    return json({ error: 'exception', detail: String(e) });
  }
});
