/**
 * JD Live — Vote des juges (passages, votes pondérés, résultats).
 */
import { supabase } from '@/lib/supabase';

/** Code pays ISO 2 lettres (FR, GB…) → emoji drapeau (🇫🇷). */
export function flagEmoji(code?: string | null): string {
  if (!code) return '';
  const cc = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return '';
  return String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0)));
}

export type PassageStatus = 'draft' | 'open' | 'locked' | 'revealed';
export type Side = 'a' | 'b';

export type Passage = {
  id: string;
  event_id: string;
  category_id: string | null;
  round: string | null;
  side_a_name: string;
  side_b_name: string;
  side_a_color: string;
  side_b_color: string;
  side_a_photo: string | null;
  side_b_photo: string | null;
  side_a_country: string | null;
  side_b_country: string | null;
  status: PassageStatus;
  winner: string | null;
  created_at: string;
  // Bracket (optionnel)
  bracket_id?: string | null;
  round_no?: number | null;
  position?: number | null;
  next_passage_id?: string | null;
  next_slot?: string | null;
};

export type Bracket = {
  id: string;
  event_id: string;
  category_id: string | null;
  title: string | null;
  size: number;
};

export type Vote = {
  id: string;
  passage_id: string;
  judge_id: string;
  choice: Side;
  weight: number;
};

export async function getEventPassages(eventId: string): Promise<Passage[]> {
  const { data, error } = await supabase
    .from('passages')
    .select('*')
    .eq('event_id', eventId)
    // Ordre du tournoi : par tour (1/4 → 1/2 → finale) puis par position ;
    // les passages hors-bracket (round null) arrivent en dernier, plus récents d'abord.
    .order('round_no', { ascending: true, nullsFirst: false })
    .order('position', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Passage[];
}

/** Passage + nom de discipline — pour l'aperçu public (accueil). */
export type PassageCard = Passage & { category_name: string | null };

export async function getEventPassageCards(eventId: string): Promise<PassageCard[]> {
  const { data, error } = await supabase
    .from('passages')
    .select('*, categories(name)')
    .eq('event_id', eventId)
    .order('round_no', { ascending: true, nullsFirst: false })
    .order('position', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as any[]).map((p) => ({
    ...p,
    category_name: p.categories?.name ?? null,
  })) as PassageCard[];
}

/** Le passage « courant » d'un événement (pour l'app juge et l'écran live). */
export async function getCurrentPassage(eventId: string): Promise<Passage | null> {
  const { data, error } = await supabase
    .from('passages')
    .select('*')
    .eq('event_id', eventId)
    .in('status', ['open', 'locked', 'revealed'])
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as Passage[];
  // Un passage en cours (open/locked) prime sur un passage révélé (terminé), même si ce
  // dernier est plus récent. À priorité égale, le plus récent (l'ordre created_at desc est conservé — tri stable).
  const rank = (s: string) => (s === 'open' ? 0 : s === 'locked' ? 1 : 2);
  rows.sort((a, b) => rank(a.status) - rank(b.status));
  return rows[0] ?? null;
}

export async function createPassage(input: {
  eventId: string;
  categoryId?: string | null;
  round?: string;
  aName: string;
  bName: string;
  aColor: string;
  bColor: string;
  aCountry?: string;
  bCountry?: string;
}): Promise<Passage> {
  const { data, error } = await supabase
    .from('passages')
    .insert({
      event_id: input.eventId,
      category_id: input.categoryId ?? null,
      round: input.round ?? null,
      side_a_name: input.aName,
      side_b_name: input.bName,
      side_a_color: input.aColor,
      side_b_color: input.bColor,
      side_a_country: input.aCountry ?? null,
      side_b_country: input.bCountry ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Passage;
}

export async function setPassageSidePhoto(id: string, side: 'a' | 'b', url: string): Promise<void> {
  const field = side === 'a' ? 'side_a_photo' : 'side_b_photo';
  const { error } = await supabase.from('passages').update({ [field]: url }).eq('id', id);
  if (error) throw error;
}

export async function updatePassageStatus(id: string, status: PassageStatus): Promise<void> {
  const { error } = await supabase.from('passages').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function setPassageWinner(id: string, winner: 'a' | 'b' | 'tie'): Promise<void> {
  const { error } = await supabase
    .from('passages')
    .update({ winner, status: 'revealed' })
    .eq('id', id);
  if (error) throw error;
}

export async function castVote(passageId: string, choice: Side): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Tu dois être connecté.');
  const { error } = await supabase
    .from('votes')
    .insert({ passage_id: passageId, judge_id: user.id, choice });
  if (error) throw error;
}

export async function getMyVote(passageId: string): Promise<Vote | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('votes')
    .select('*')
    .eq('passage_id', passageId)
    .eq('judge_id', user.id)
    .maybeSingle();
  if (error) throw error;
  return (data as Vote) ?? null;
}

/** Tous les votes d'un passage (admin — pour le dépouillement). */
export async function getPassageVotes(passageId: string): Promise<Vote[]> {
  const { data, error } = await supabase.from('votes').select('*').eq('passage_id', passageId);
  if (error) throw error;
  return (data ?? []) as Vote[];
}

/* ---------------- VOTE DU PUBLIC (spectateurs) ---------------- */

export type PublicVote = { id: string; passage_id: string; profile_id: string; choice: Side };

/** Le spectateur vote (ou change d'avis) — possible seulement quand le passage est ouvert. */
export async function castPublicVote(passageId: string, choice: Side): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Tu dois être connecté.');
  const { error } = await supabase
    .from('public_votes')
    .upsert(
      { passage_id: passageId, profile_id: user.id, choice },
      { onConflict: 'passage_id,profile_id' },
    );
  if (error) throw error;
}

/** Mon vote public sur un passage (pour préselectionner le bouton). */
export async function getMyPublicVote(passageId: string): Promise<PublicVote | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('public_votes')
    .select('*')
    .eq('passage_id', passageId)
    .eq('profile_id', user.id)
    .maybeSingle();
  if (error) throw error;
  return (data as PublicVote) ?? null;
}

/** Nombre total de votes du public de l'utilisateur courant (gamification). */
export async function getMyPublicVoteCount(): Promise<number> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;
  const { count, error } = await supabase
    .from('public_votes')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', user.id);
  if (error) throw error;
  return count ?? 0;
}

/** Baromètre spectateurs (comptes bruts, non pondérés). */
export async function getPublicTally(passageId: string): Promise<{ a: number; b: number; total: number }> {
  const { data, error } = await supabase
    .from('public_votes')
    .select('choice')
    .eq('passage_id', passageId);
  if (error) throw error;
  let a = 0;
  let b = 0;
  (data ?? []).forEach((v: any) => {
    if (v.choice === 'a') a += 1;
    else if (v.choice === 'b') b += 1;
  });
  return { a, b, total: a + b };
}

/* ---------------- BRACKET ---------------- */

export async function getEventBrackets(eventId: string): Promise<Bracket[]> {
  const { data, error } = await supabase
    .from('brackets')
    .select('id,event_id,category_id,title,size')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Bracket[];
}

export async function getBracketPassages(bracketId: string): Promise<Passage[]> {
  const { data, error } = await supabase
    .from('passages')
    .select('*')
    .eq('bracket_id', bracketId)
    .order('round_no', { ascending: true })
    .order('position', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Passage[];
}

function roundName(matchesInRound: number): string {
  return matchesInRound === 1 ? 'Finale' : `1/${matchesInRound} de finale`;
}

/**
 * Génère un arbre complet (size = 8 | 16 | 32) à partir des matchs du 1er tour.
 * Les tours suivants sont créés vides et remplis automatiquement par le trigger.
 */
export async function createBracket(input: {
  eventId: string;
  categoryId: string;
  size: number;
  round1: {
    aName: string;
    bName: string;
    aCountry?: string;
    bCountry?: string;
    aPhoto?: string | null;
    bPhoto?: string | null;
  }[];
  title?: string;
}): Promise<string> {
  const { size } = input;
  const rounds = Math.round(Math.log2(size));

  const { data: br, error: e1 } = await supabase
    .from('brackets')
    .insert({ event_id: input.eventId, category_id: input.categoryId, size, title: input.title ?? null })
    .select('id')
    .single();
  if (e1) throw e1;
  const bracketId = (br as any).id as string;

  const idByRoundPos: Record<number, Record<number, string>> = {};
  // De la finale (r = rounds) vers le 1er tour (r = 1), pour connaître le "next".
  for (let r = rounds; r >= 1; r--) {
    const matchesInRound = size / Math.pow(2, r);
    const rows = [];
    for (let p = 0; p < matchesInRound; p++) {
      const isRound1 = r === 1;
      rows.push({
        event_id: input.eventId,
        category_id: input.categoryId,
        bracket_id: bracketId,
        round_no: r,
        position: p,
        round: roundName(matchesInRound),
        side_a_name: isRound1 ? input.round1[p]?.aName || 'Équipe A' : 'À venir',
        side_b_name: isRound1 ? input.round1[p]?.bName || 'Équipe B' : 'À venir',
        side_a_country: isRound1 ? input.round1[p]?.aCountry ?? null : null,
        side_b_country: isRound1 ? input.round1[p]?.bCountry ?? null : null,
        side_a_photo: isRound1 ? input.round1[p]?.aPhoto ?? null : null,
        side_b_photo: isRound1 ? input.round1[p]?.bPhoto ?? null : null,
        next_passage_id: r < rounds ? idByRoundPos[r + 1][Math.floor(p / 2)] : null,
        next_slot: r < rounds ? (p % 2 === 0 ? 'a' : 'b') : null,
        status: 'draft',
      });
    }
    const { data: created, error } = await supabase.from('passages').insert(rows).select('id,position');
    if (error) throw error;
    idByRoundPos[r] = {};
    (created ?? []).forEach((row: any) => {
      idByRoundPos[r][row.position] = row.id;
    });
    for (let p = 0; p < matchesInRound; p++) {
      if (!idByRoundPos[r][p]) throw new Error('Erreur de génération du bracket.');
    }
  }
  return bracketId;
}

/** Dépouillement pondéré. */
export function tally(votes: Vote[]): {
  a: number;
  b: number;
  count: number;
  winner: 'a' | 'b' | 'tie';
} {
  let a = 0;
  let b = 0;
  votes.forEach((v) => {
    if (v.choice === 'a') a += v.weight;
    else if (v.choice === 'b') b += v.weight;
  });
  const winner = a > b ? 'a' : b > a ? 'b' : 'tie';
  return { a, b, count: votes.length, winner };
}
