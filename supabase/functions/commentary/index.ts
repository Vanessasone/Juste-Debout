/**
 * JD Live+ — commentaire & analyse IA (Anthropic), style commentateur street dance.
 * mode 'live'   → une punchline courte de direct.
 * mode 'debrief'→ une analyse d'après-passage (2-3 phrases).
 *
 * Déploiement : supabase functions deploy commentary
 *   (réutilise le secret ANTHROPIC_API_KEY, comme la fonction companion)
 */
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-haiku-4-5-20251001';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BASE = `Tu es LE commentateur star de Juste Debout, la grande compétition de danses debout. Style : énergie, culture street dance, punchy, chaleureux — comme un commentateur sportif passionné.

RÈGLES :
- Français uniquement.
- Ne dis JAMAIS « battle ». Juste Debout parle d'« échanges », de « rencontres », de « passages ».
- N'invente pas de faits précis (scores exacts des juges cachés, chiffres non fournis). Appuie-toi uniquement sur le contexte donné.
- Reste vivant et imagé mais jamais vulgaire ni insultant.`;

const LIVE = `${BASE}\n\nProduis UNE seule ligne de commentaire live, courte et percutante (max ~20 mots), sans guillemets.`;
const DEBRIEF = `${BASE}\n\nProduis une analyse d'après-passage en 2 à 3 phrases : qui l'emporte et pourquoi, l'adhésion du public, si c'était serré, net, ou une surprise.`;

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (!ANTHROPIC_API_KEY) return json({ error: 'not_configured' });
    const { mode, context } = await req.json();
    const system = mode === 'debrief' ? DEBRIEF : LIVE;
    const userMsg = `Contexte du passage :\n${String(context ?? '').slice(0, 2000)}`;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: mode === 'debrief' ? 400 : 120,
        system,
        messages: [{ role: 'user', content: userMsg }],
      }),
    });
    if (!resp.ok) {
      const detail = await resp.text();
      return json({ error: 'upstream', status: resp.status, detail: detail.slice(0, 500) });
    }
    const data = await resp.json();
    const text = (data.content ?? [])
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n')
      .trim();
    return json({ text });
  } catch (e) {
    return json({ error: 'exception', detail: String(e) });
  }
});
