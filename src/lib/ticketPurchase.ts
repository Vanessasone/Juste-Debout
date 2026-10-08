import AsyncStorage from '@react-native-async-storage/async-storage';
export const TICKET_DRAFT_KEY = 'jd_ticket_purchase_draft_v1';
export type TicketDraft = { eventId: string; productId: string; productName: string; quantity: number; promoCode: string; createdAt: number };
export async function readTicketDraft(): Promise<TicketDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(TICKET_DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d.eventId || !d.productId || !Number.isInteger(d.quantity) || d.quantity < 1 || !Number.isFinite(d.createdAt) || Date.now() - d.createdAt > 2 * 3600000) {
      await AsyncStorage.removeItem(TICKET_DRAFT_KEY); return null;
    }
    return d;
  } catch { return null; }
}
export async function saveTicketDraft(draft: TicketDraft) { await AsyncStorage.setItem(TICKET_DRAFT_KEY, JSON.stringify(draft)); }
export async function clearTicketDraft() { await AsyncStorage.removeItem(TICKET_DRAFT_KEY); }
