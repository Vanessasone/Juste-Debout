import { supabase } from '@/lib/supabase';

export type BlackCardMembership = {
  id: string;
  ticket_id: string;
  holder_name: string | null;
  qr_token: string | null;
  card_number: string;
  valid_from: string;
  valid_until: string;
  merchandise_discount_percent: number;
  status: string;
};

export async function getMyBlackCard(): Promise<BlackCardMembership | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('black_cards')
    .select('id,ticket_id,card_number,valid_from,valid_until,merchandise_discount_percent,status')
    .eq('profile_id', user.id)
    .eq('status','active')
    .gt('valid_until', new Date().toISOString())
    .order('valid_until',{ascending:false})
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [ticketResult, profileResult] = await Promise.all([
    supabase.from('tickets').select('qr_token,holder_name,status').eq('id', data.ticket_id).eq('profile_id', user.id).maybeSingle(),
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
  ]);
  if (ticketResult.error) throw ticketResult.error;
  if (profileResult.error) throw profileResult.error;
  return {
    ...data,
    holder_name: ticketResult.data?.holder_name || profileResult.data?.full_name || null,
    qr_token: ticketResult.data && ticketResult.data.status !== 'cancelled' ? ticketResult.data.qr_token : null,
  } as BlackCardMembership;
}
