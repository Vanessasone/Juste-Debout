/**
 * JD Live+ — traduction automatique des légendes (commentaire écrit).
 * Reçoit une ligne de texte, renvoie ses traductions dans les 9 langues de l'app.
 * Une seule requête LLM → JSON { fr, en, de, it, es, pt, zh, ko, ja }.
 *
 * Déploiement : supabase functions deploy translate
 *   (réutilise le secret ANTHROPIC_API_KEY, comme companion / commentary)
 */
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-haiku-4-5-20251001';

const LANGS = ['fr', 'en', 'de', 'it', 'es', 'pt', 'zh', 'ko', 'ja'] as const;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SYSTEM = `Tu es le moteur de traduction des légendes de Juste Debout (grande scène de danses debout).
Tu traduis une ligne de commentaire live dans 9 langues.

RÈGLES STRICTES :
- Garde le ton vivant et court du commentaire d'origine.
- Ne traduis JAMAIS les noms propres, noms de crews, ni de danseurs.
- Vocabulaire officiel : ne rends jamais l'idée par « battle » ; parle d'« échanges / rencontres / passages » (et l'équivalent naturel dans chaque langue).
- N'ajoute rien, ne commente pas, n'explique pas.
- Réponds UNIQUEMENT par un objet JSON valide, sans texte autour, avec exactement ces clés : ${LANGS.join(', ')}.
  Chaque valeur = la traduction de la ligne dans cette langue (fr=français, en=anglais, de=allemand, it=italien, es=espagnol, pt=portugais, zh=chinois simplifié, ko=coréen, ja=japonais).`;

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
    const { text } = await req.json();
    const line = String(text ?? '').trim().slice(0, 500);
    if (!line) return json({ error: 'empty' });

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 700,
        system: SYSTEM,
        messages: [{ role: 'user', content: `Ligne à traduire :\n${line}` }],
      }),
    });
    if (!resp.ok) {
      const detail = await resp.text();
      return json({ error: 'upstream', status: resp.status, detail: detail.slice(0, 500) });
    }
    const data = await resp.json();
    const raw = (data.content ?? [])
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('')
      .trim();

    // Extraction robuste du JSON (au cas où le modèle enrobe la réponse).
    let translations: Record<string, string> = {};
    try {
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      const parsed = JSON.parse(start >= 0 ? raw.slice(start, end + 1) : raw);
      for (const l of LANGS) if (typeof parsed[l] === 'string') translations[l] = parsed[l].trim();
    } catch {
      /* parsing raté → on renverra ce qu'on a (souvent rien) */
    }
    // Filet de sécurité : toute langue manquante retombe sur la ligne d'origine.
    for (const l of LANGS) if (!translations[l]) translations[l] = line;

    return json({ translations });
  } catch (e) {
    return json({ error: 'exception', detail: String(e) });
  }
});
