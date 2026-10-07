import { supabase } from '@/lib/supabase';

export type BlackCardMembership = {
  id: string;
  card_number: string;
  valid_from: string;
  valid_until: string;
  merchandise_discount_percent: number;
  status: string;
};

export async function getMyBlackCard(): Promise<BlackCardMembership | null> {
  const { data, error } = await supabase
    .from('black_cards')
    .select('id,card_number,valid_from,valid_until,merchandise_discount_percent,status')
    .eq('status','active')
    .gt('valid_until', new Date().toISOString())
    .order('valid_until',{ascending:false})
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as BlackCardMembership | null;
}
