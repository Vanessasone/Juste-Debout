import { supabase } from '@/lib/supabase';
import { serverRequest } from '@/lib/serverRequest';

export async function claimGuestTickets() {
  const { data, error } = await serverRequest(signal => supabase.rpc('claim_guest_ticket_orders').abortSignal(signal));
  if (error) throw error;
  if (!data?.ok) throw new Error('claim_failed');
  return data.orders_claimed as number;
}

export async function resendMyTicketConfirmations() {
  const { data, error } = await serverRequest(signal => supabase.rpc('resend_my_ticket_confirmations').abortSignal(signal));
  if (error || !data?.ok) throw error ?? new Error('resend_failed');
  return data as { ok: boolean; queued: number; cooldown: boolean };
}
