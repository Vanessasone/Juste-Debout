/**
 * JD Coins — solde réel de fidélité, cumulé et partagé avec Juste Debout School.
 * Lecture seule côté app : le crédit se fait uniquement côté serveur (triggers).
 */
import { supabase } from '@/lib/supabase';

/** Solde total cumulé (Juste Debout + JD School). */
export async function getCoinsBalance(): Promise<number> {
  const { data, error } = await supabase.rpc('jd_coins_balance');
  if (error) throw error;
  return (data as number) ?? 0;
}

export type CoinsByApp = { total: number; jd: number; school: number };

/** Répartition du solde par application. */
export async function getCoinsByApp(): Promise<CoinsByApp> {
  const { data, error } = await supabase.rpc('jd_coins_by_app');
  if (error) throw error;
  const rows = (data ?? []) as { source_app: string; total: number }[];
  let jd = 0;
  let school = 0;
  for (const r of rows) {
    if (r.source_app === 'juste-debout') jd += r.total;
    else school += r.total;
  }
  return { total: jd + school, jd, school };
}
