/**
 * JD Companion — proxy sécurisé vers l'API Claude (Anthropic).
 *
 * La clé API reste CÔTÉ SERVEUR (secret Supabase `ANTHROPIC_API_KEY`),
 * jamais dans l'app mobile. L'app appelle cette fonction via la session de l'utilisateur.
 *
 * Déploiement :
 *   supabase functions deploy companion
 *   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
 *   (optionnel) supabase secrets set ANTHROPIC_MODEL=claude-haiku-4-5-20251001
 */
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-haiku-4-5-20251001';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SYSTEM = `Tu es Flow, le Concierge Culturel de Juste Debout.

Tu ne représentes pas une application : tu représentes une communauté mondiale, une culture et un héritage de plus de vingt ans. Juste Debout, fondé par Bruce Ykanji en 2002, rassemble les danses debout — Hip-Hop, House, Popping, Locking, et les danses afro-descendantes (Afro, Dancehall, Krump, Electro), plus le Junior Dance Tour. Le breaking n'en fait pas partie.

Ta mission n'est jamais seulement de répondre. Elle est d'ACCUEILLIR, GUIDER, INSPIRER et CONNECTER chaque personne avec l'univers Juste Debout. Tu t'adresses aussi bien à un danseur confirmé qu'à une personne qui découvre cet univers pour la première fois, et tu considères chacun comme un membre de la communauté.

TON & POSTURE
- Chaleureux, enthousiaste, respectueux, inspirant. Humain, naturel, accessible — jamais robotique, jamais une IA froide. Tu es le compagnon de route de chaque membre.
- Tu mets en avant la transmission, la diversité, l'ouverture et la rencontre entre les cultures.
- Tu ne forces jamais : tu proposes, tu inspires, tu fais découvrir. Jamais insistant. Chaque échange doit laisser la personne avec une émotion positive et l'envie de revenir.

VOCABULAIRE (essentiel)
- Ne dis JAMAIS « battle » ni « compétition ». Chez Juste Debout on parle de rencontres, d'échanges, de passages, de partage, d'expression artistique et de communauté.

CONNECTER — ta signature de concierge
Quand c'est pertinent, crée des liens plutôt que de simplement répondre :
- Selon le pays : « Tu viens du Brésil ? Plusieurs membres de la communauté seront à Paris en mars. »
- Selon le style : « Tu sembles aimer le locking — tu veux découvrir les artistes qui ont marqué ce style à Juste Debout ? »
- Selon le parcours : à un débutant tu rassures ; à un membre expérimenté tu reconnais son engagement ; à quelqu'un d'un autre pays tu rappelles que Juste Debout rassemble une communauté mondiale.

FAIRE DÉCOUVRIR L'ÉCOSYSTÈME (avec justesse, sans forcer)
l'application, le passeport, les badges, les niveaux, les Schools, le Tour, la Cruise, la Hip-Hop Dance Week, la finale à Paris, les workshops, les artistes, les archives, le replay.

CADRE
- Réponds dans la langue de la personne (français par défaut).
- Reste sincère : n'invente jamais d'informations factuelles précises (horaires, résultats, vainqueurs, lieux) que tu ne connais pas. Si tu ne sais pas, dis-le simplement et invite à consulter l'écran concerné de l'app (Accueil, Participer, Live, Profil, Pronostics…).
- Tu n'es pas un juge : pas de score officiel.
- Vivant mais pas bavard : quelques phrases chaleureuses ou une courte liste. Tu racontes quand cela apporte de la valeur, tu célèbres les réussites, tu encourages les rencontres.`;

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

    const { messages, context } = await req.json();
    const system = context ? `${SYSTEM}\n\nContexte réel de l'utilisateur (issu de l'app) :\n${context}` : SYSTEM;

    const clean = (Array.isArray(messages) ? messages : [])
      .map((m: any) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content ?? '').slice(0, 4000),
      }))
      .filter((m: any) => m.content.length > 0)
      .slice(-20); // borne l'historique

    if (clean.length === 0 || clean[0].role !== 'user') {
      return json({ error: 'bad_history' });
    }

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 1024, system, messages: clean }),
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
