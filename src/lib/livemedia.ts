/**
 * JD Live+ — dispositif média : direct commenté (temps réel), pronostics, notes.
 */
import { supabase } from '@/lib/supabase';

/* ---------------- DIRECT COMMENTÉ ---------------- */

export type CommentaryKind = 'mc' | 'ai' | 'system';
export type Commentary = {
  id: string;
  event_id: string | null;
  passage_id: string | null;
  author_id: string | null;
  kind: CommentaryKind;
  tag: string | null;
  text: string;
  translations: Record<string, string> | null; // légendes auto-traduites (9 langues)
  created_at: string;
};

/** La légende à afficher pour un spectateur, dans SA langue (repli sur l'original). */
export function captionFor(c: Commentary, lang: string): string {
  return c.translations?.[lang]?.trim() || c.text;
}

/** Traduit une ligne dans les 9 langues via l'Edge Function `translate`.
 *  Renvoie null si indisponible (la légende retombe alors sur le texte d'origine). */
export async function translateLine(text: string): Promise<Record<string, string> | null> {
  try {
    const { data, error } = await supabase.functions.invoke('translate', { body: { text } });
    if (error || !data || data.error) return null;
    const tr = data.translations as Record<string, string> | undefined;
    return tr && typeof tr === 'object' ? tr : null;
  } catch {
    return null;
  }
}

export async function getCommentaries(eventId: string, limit = 80): Promise<Commentary[]> {
  const { data, error } = await supabase
    .from('commentaries')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as Commentary[]).reverse(); // ordre chronologique
}

export async function postCommentary(input: {
  eventId: string;
  passageId?: string | null;
  text: string;
  kind?: CommentaryKind;
  tag?: string | null;
}): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Tu dois être connecté.');
  const clean = input.text.trim();
  // Traduction automatique de la légende dans les 9 langues (échoue en silence → repli sur l'original).
  const translations = await translateLine(clean);
  const { error } = await supabase.from('commentaries').insert({
    event_id: input.eventId,
    passage_id: input.passageId ?? null,
    author_id: user.id,
    kind: input.kind ?? 'mc',
    tag: input.tag ?? null,
    text: clean,
    translations,
  });
  if (error) throw error;
}

/** Abonnement temps réel aux nouveaux commentaires d'un événement. Renvoie une fonction de nettoyage. */
export function subscribeCommentaries(eventId: string, onInsert: (c: Commentary) => void): () => void {
  const channel = supabase
    .channel(`comm:${eventId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'commentaries', filter: `event_id=eq.${eventId}` },
      (payload) => onInsert(payload.new as Commentary),
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

/** Génère une ligne de commentaire (ou une analyse) via l'IA (Edge Function). */
export async function generateCommentary(
  mode: 'live' | 'debrief',
  context: string,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('commentary', { body: { mode, context } });
  if (error) throw new Error("L'IA de commentaire n'est pas joignable.");
  if (data?.error) {
    if (data.error === 'not_configured') throw new Error("L'IA de commentaire n'est pas activée (clé API à configurer).");
    throw new Error("L'IA de commentaire a rencontré un souci.");
  }
  return (data?.text as string | undefined)?.trim() ?? '';
}

/* ---------------- PRONOSTICS (avant-match) ---------------- */

export type Side = 'a' | 'b';

export async function castPrediction(passageId: string, choice: Side): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Tu dois être connecté.');
  const { error } = await supabase
    .from('predictions')
    .upsert({ passage_id: passageId, profile_id: user.id, choice }, { onConflict: 'passage_id,profile_id' });
  if (error) throw error;
}

export async function getMyPrediction(passageId: string): Promise<Side | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('predictions')
    .select('choice')
    .eq('passage_id', passageId)
    .eq('profile_id', user.id)
    .maybeSingle();
  if (error) throw error;
  return (data?.choice as Side) ?? null;
}

export async function getPredictionTally(passageId: string): Promise<{ a: number; b: number; total: number }> {
  const { data, error } = await supabase.from('predictions').select('choice').eq('passage_id', passageId);
  if (error) throw error;
  let a = 0;
  let b = 0;
  (data ?? []).forEach((v: any) => (v.choice === 'a' ? (a += 1) : v.choice === 'b' ? (b += 1) : null));
  return { a, b, total: a + b };
}

/** Stats de pronostics de l'utilisateur (pour la gamification). */
export async function getMyPredictionStats(): Promise<{ total: number; correct: number }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { total: 0, correct: 0 };
  const { data, error } = await supabase
    .from('predictions')
    .select('choice, passages(status,winner)')
    .eq('profile_id', user.id);
  if (error) throw error;
  let total = 0;
  let correct = 0;
  (data ?? []).forEach((r: any) => {
    const p = r.passages;
    if (p && p.status === 'revealed' && (p.winner === 'a' || p.winner === 'b')) {
      total += 1;
      if (p.winner === r.choice) correct += 1;
    }
  });
  return { total, correct };
}

/* ---------------- NOTES (après-match) ---------------- */

export async function ratePassage(passageId: string, stars: number, mvpSide?: Side | null): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Tu dois être connecté.');
  const { error } = await supabase
    .from('ratings')
    .upsert(
      { passage_id: passageId, profile_id: user.id, stars, mvp_side: mvpSide ?? null },
      { onConflict: 'passage_id,profile_id' },
    );
  if (error) throw error;
}

export type MyRating = { stars: number; mvp_side: Side | null };
export async function getMyRating(passageId: string): Promise<MyRating | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('ratings')
    .select('stars, mvp_side')
    .eq('passage_id', passageId)
    .eq('profile_id', user.id)
    .maybeSingle();
  if (error) throw error;
  return (data as MyRating) ?? null;
}

export type RatingSummary = { avg: number; count: number; mvpA: number; mvpB: number };
export async function getRatingSummary(passageId: string): Promise<RatingSummary> {
  const { data, error } = await supabase.from('ratings').select('stars, mvp_side').eq('passage_id', passageId);
  if (error) throw error;
  const rows = (data ?? []) as { stars: number; mvp_side: Side | null }[];
  const count = rows.length;
  const avg = count ? rows.reduce((s, r) => s + r.stars, 0) / count : 0;
  const mvpA = rows.filter((r) => r.mvp_side === 'a').length;
  const mvpB = rows.filter((r) => r.mvp_side === 'b').length;
  return { avg, count, mvpA, mvpB };
}
