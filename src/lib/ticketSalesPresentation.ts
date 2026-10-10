import { earlyBirdState } from './earlyBird';

export type TicketGroup = 'standard' | 'vip' | 'black' | 'family';

export function ticketGroup(code: string): TicketGroup {
  if (code === 'black_card') return 'black';
  if (code.startsWith('vip_')) return 'vip';
  if (code.startsWith('family_') || code.startsWith('mjc_')) return 'family';
  return 'standard';
}

export function earlyBirdEligible(product: { code: string; promo_eligible: boolean }) {
  return product.promo_eligible && ['day_sat', 'day_sun', 'two_days'].includes(product.code);
}

export function displayedTicketPrice(product: { code: string; promo_eligible: boolean; price_cents: number }, promo: string, now: number) {
  if (promo.trim() !== '48' || earlyBirdState(now).phase !== 'active' || !earlyBirdEligible(product)) return product.price_cents;
  return Math.max(0, product.price_cents - (product.code === 'two_days' ? 1000 : 500));
}

export function checkoutPromo(product: { code: string; promo_eligible: boolean }, promo: string, now: number) {
  const code = promo.trim();
  if (code === '48' && (earlyBirdState(now).phase !== 'active' || !earlyBirdEligible(product))) return '';
  return code;
}
