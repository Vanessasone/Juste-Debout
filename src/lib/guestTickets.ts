import { supabase } from '@/lib/supabase';

export async function claimGuestTickets() {
  const { data, error } = await supabase.rpc('claim_guest_ticket_orders');
  if (error) throw error;
  if (!data?.ok) throw new Error('claim_failed');
  return data.orders_claimed as number;
}
