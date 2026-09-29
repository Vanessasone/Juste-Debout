/**
 * Cadeaux live — catalogue, solde JD Coins, achat (mode test), envoi pendant le direct,
 * et gains (danseur + admin). La monnaie est le JD Coins (1 coin = 0,01 €).
 * Tout le crédit/débit passe par des fonctions serveur (security definer).
 */
import { supabase } from '@/lib/supabase';

export type Gift = {
  id: string;
  code: string;
  emoji: string;
  name: string;
  cost_coins: number;
  tier: 'entry' | 'mid' | 'hero';
  sort: number;
};

/** Packs de recharge (web = prix affiché ; natif ajoutera la taxe store plus tard).
 *  base = coins payés (rémunèrent le danseur) ; bonus = coins offerts. */
export type CoinPack = { id: string; price_eur: number; base: number; bonus: number; label?: string };
export const COIN_PACKS: CoinPack[] = [
  { id: 'starter', price_eur: 1.99, base: 200, bonus: 200, label: '1er achat ×2' },
  { id: 'entry', price_eur: 4.99, base: 500, bonus: 0 },
  { id: 'popular', price_eur: 9.99, base: 1000, bonus: 50, label: 'Populaire' },
  { id: 'value', price_eur: 19.99, base: 2000, bonus: 200 },
  { id: 'fan', price_eur: 49.99, base: 5000, bonus: 750 },
  { id: 'boss', price_eur: 99.99, base: 10000, bonus: 2000 },
];

/** En dessous de ce solde, on incite l'utilisateur à recharger (relance re-achat). */
export const LOW_COINS = 200;

export async function getGifts(): Promise<Gift[]> {
  const { data, error } = await supabase.from('gifts').select('*').eq('active', true).order('sort');
  if (error) throw error;
  return (data ?? []) as Gift[];
}

/** Solde JD Coins courant de l'utilisateur connecté. */
export async function getCoinsBalance(): Promise<number> {
  const { data, error } = await supabase.rpc('coins_balance', { p_profile: null });
  if (error) throw error;
  return (data as number) ?? 0;
}

/** Achat de coins — MODE TEST (sera remplacé par le paiement Stripe). */
export async function buyCoins(pack: CoinPack): Promise<number> {
  const { data, error } = await supabase.rpc('buy_coins', {
    p_base: pack.base,
    p_bonus: pack.bonus,
    p_ref: pack.id,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}

export type SendGiftResult = { ok: boolean; cost: number; cash_coins: number; balance: number };

/** Envoie un cadeau vers un côté (a/b) du passage en cours. Les gains sont
 *  répartis serveur entre les danseurs de ce côté (binôme = 50/50). */
export async function sendGift(input: {
  giftId: string;
  eventId: string | null;
  passageId: string | null;
  side: 'a' | 'b';
}): Promise<SendGiftResult> {
  const { data, error } = await supabase.rpc('send_gift', {
    p_gift: input.giftId,
    p_event: input.eventId,
    p_passage: input.passageId,
    p_side: input.side,
  });
  if (error) throw error;
  return data as SendGiftResult;
}

export type MyEarnings = { gifts_received: number; coins_received: number; cash_coins: number; earnings_eur: number };
export async function getMyEarnings(): Promise<MyEarnings> {
  const { data, error } = await supabase.rpc('my_gift_earnings');
  if (error) throw error;
  const row = (data as MyEarnings[] | null)?.[0];
  return row ?? { gifts_received: 0, coins_received: 0, cash_coins: 0, earnings_eur: 0 };
}

export type AdminGiftStats = {
  total_gifts: number; total_coins: number; cash_coins: number;
  gross_eur: number; dancers_eur: number; jd_eur: number;
};
export async function getAdminGiftStats(): Promise<AdminGiftStats> {
  const { data, error } = await supabase.rpc('admin_gift_stats');
  if (error) throw error;
  const row = (data as AdminGiftStats[] | null)?.[0];
  return row ?? { total_gifts: 0, total_coins: 0, cash_coins: 0, gross_eur: 0, dancers_eur: 0, jd_eur: 0 };
}

export type DancerEarningRow = {
  profile_id: string; dancer: string; gifts_received: number; cash_coins: number; earnings_eur: number;
};
export async function getAdminDancerEarnings(): Promise<DancerEarningRow[]> {
  const { data, error } = await supabase.rpc('admin_dancer_earnings');
  if (error) throw error;
  return (data as DancerEarningRow[]) ?? [];
}
