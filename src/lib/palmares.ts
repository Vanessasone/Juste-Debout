/**
 * Palmarès & classement — gamification compétitive (P3).
 * S'appuie sur le lien passages ↔ danseurs (table passage_participants).
 */
import { supabase } from '@/lib/supabase';

export type MatchResult = 'win' | 'loss' | 'pending';

export type PalmaresMatch = {
  passageId: string;
  side: 'a' | 'b';
  round: string | null;
  myName: string;
  opponentName: string;
  result: MatchResult;
  createdAt: string;
};

export type Palmares = {
  wins: number;
  losses: number;
  titles: number;
  matches: number;
  winRate: number; // 0..100
  recent: PalmaresMatch[];
};

const EMPTY: Palmares = { wins: 0, losses: 0, titles: 0, matches: 0, winRate: 0, recent: [] };

/** Palmarès réel d'un danseur, calculé depuis ses passages révélés. */
export async function getPalmares(profileId: string): Promise<Palmares> {
  const { data, error } = await supabase
    .from('passage_participants')
    .select(
      'side, passages(id,status,winner,round,side_a_name,side_b_name,created_at)',
    )
    .eq('profile_id', profileId);
  if (error) throw error;

  let wins = 0;
  let losses = 0;
  let titles = 0;
  let matches = 0;
  const recent: PalmaresMatch[] = [];

  for (const r of (data ?? []) as any[]) {
    const p = r.passages;
    if (!p) continue;
    const side = r.side as 'a' | 'b';
    const decided = p.status === 'revealed' && (p.winner === 'a' || p.winner === 'b');
    let result: MatchResult = 'pending';
    if (decided) {
      matches += 1;
      if (p.winner === side) {
        wins += 1;
        result = 'win';
        if (p.round === 'Finale') titles += 1;
      } else {
        losses += 1;
        result = 'loss';
      }
    }
    recent.push({
      passageId: p.id,
      side,
      round: p.round,
      myName: side === 'a' ? p.side_a_name : p.side_b_name,
      opponentName: side === 'a' ? p.side_b_name : p.side_a_name,
      result,
      createdAt: p.created_at,
    });
  }

  recent.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const winRate = matches ? Math.round((wins / matches) * 100) : 0;
  return { wins, losses, titles, matches, winRate, recent: recent.slice(0, 10) };
}

export type LeaderboardRow = {
  profile_id: string;
  alias: string | null;
  full_name: string | null;
  photo_url: string | null;
  country: string | null;
  wins: number;
  losses: number;
  titles: number;
  matches: number;
  score: number; // score mondial pondéré (tour × plateau × niveau d'événement)
};

/** Classement mondial agrégé (via fonction Postgres jd_leaderboard). */
export async function getLeaderboard(): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase.rpc('jd_leaderboard');
  if (error) throw error;
  return (data ?? []) as LeaderboardRow[];
}

/** Attache des danseurs inscrits à un passage (régie/admin). */
export async function attachParticipants(
  passageId: string,
  aIds: string[],
  bIds: string[],
): Promise<void> {
  const rows = [
    ...aIds.map((id) => ({ passage_id: passageId, profile_id: id, side: 'a' })),
    ...bIds.map((id) => ({ passage_id: passageId, profile_id: id, side: 'b' })),
  ];
  if (!rows.length) return;
  const { error } = await supabase
    .from('passage_participants')
    .upsert(rows, { onConflict: 'passage_id,profile_id' });
  if (error) throw error;
}

export { EMPTY as EMPTY_PALMARES };
