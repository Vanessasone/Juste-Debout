/**
 * Pronostics « champion » — prédire le vainqueur d'une discipline + classement.
 */
import { supabase } from '@/lib/supabase';

export type StartlistDancer = {
  id: string;
  alias: string | null;
  full_name: string | null;
  country: string | null;
  photo_url: string | null;
};
export type StartlistCategory = {
  categoryId: string;
  categoryName: string;
  dancers: StartlistDancer[];
};

/** Feuille de match : danseurs inscrits par discipline (champs publics uniquement). */
export async function getStartlist(eventId: string): Promise<StartlistCategory[]> {
  const { data, error } = await supabase.rpc('jd_startlist', { p_event: eventId });
  if (error) throw error;
  const byCat = new Map<string, StartlistCategory>();
  (data ?? []).forEach((r: any) => {
    if (!byCat.has(r.category_id)) {
      byCat.set(r.category_id, { categoryId: r.category_id, categoryName: r.category_name, dancers: [] });
    }
    byCat.get(r.category_id)!.dancers.push({
      id: r.profile_id,
      alias: r.alias,
      full_name: r.full_name,
      country: r.country,
      photo_url: r.photo_url,
    });
  });
  return [...byCat.values()];
}

/** Vainqueurs de finale par discipline → Map categoryId → Set(profileId gagnants). */
export async function getFinaleWinners(eventId: string): Promise<Map<string, Set<string>>> {
  const { data, error } = await supabase.rpc('jd_finale_winners', { p_event: eventId });
  if (error) throw error;
  const map = new Map<string, Set<string>>();
  (data ?? []).forEach((r: any) => {
    if (!map.has(r.category_id)) map.set(r.category_id, new Set());
    map.get(r.category_id)!.add(r.profile_id);
  });
  return map;
}

/** Mes pronostics champion pour un événement → Map categoryId → pick_id. */
export async function getMyChampionPredictions(eventId: string): Promise<Map<string, string>> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Map();
  const { data, error } = await supabase
    .from('champion_predictions')
    .select('category_id, pick_id')
    .eq('event_id', eventId)
    .eq('predictor_id', user.id);
  if (error) throw error;
  const map = new Map<string, string>();
  (data ?? []).forEach((r: any) => map.set(r.category_id, r.pick_id));
  return map;
}

export async function castChampionPrediction(
  eventId: string,
  categoryId: string,
  pickId: string,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Tu dois être connecté.');
  const { error } = await supabase
    .from('champion_predictions')
    .upsert(
      { event_id: eventId, category_id: categoryId, predictor_id: user.id, pick_id: pickId },
      { onConflict: 'event_id,category_id,predictor_id' },
    );
  if (error) throw error;
}

/** Score champion global de l'utilisateur (pour la gamification). */
export async function getMyChampionScore(): Promise<{ total: number; correct: number }> {
  const { data, error } = await supabase.rpc('jd_my_champion_score');
  if (error) return { total: 0, correct: 0 };
  const row = (data ?? [])[0] ?? {};
  return { total: Number(row.total ?? 0), correct: Number(row.correct ?? 0) };
}

export type Pronostiqueur = {
  profile_id: string;
  alias: string | null;
  full_name: string | null;
  photo_url: string | null;
  correct: number;
  total: number;
};

export async function getPronostiqueurs(): Promise<Pronostiqueur[]> {
  const { data, error } = await supabase.rpc('jd_pronostiqueurs');
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => ({
    profile_id: r.profile_id,
    alias: r.alias,
    full_name: r.full_name,
    photo_url: r.photo_url,
    correct: Number(r.correct),
    total: Number(r.total),
  }));
}
