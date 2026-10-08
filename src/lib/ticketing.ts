import { Linking, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

export type TicketProduct = {
  id: string;
  event_id: string;
  code: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  active: boolean;
  sales_start: string | null;
  sales_end: string | null;
  min_per_order: number;
  max_per_order: number;
  group_size: number;
  access_days: number;
  access_date: string | null;
  access_start_date: string | null;
  audience: string;
  promo_eligible: boolean;
  sort_order: number;
};

export async function getTicketProducts(eventId: string, includeInternalTest = false): Promise<TicketProduct[]> {
  if (!includeInternalTest) {
    const { data, error } = await supabase.rpc('public_ticket_products', { p_event: eventId });
    if (error) throw error;
    return (data ?? []) as TicketProduct[];
  }
  const cols = 'id,event_id,code,name,description,price_cents,currency,active,sales_start,sales_end,min_per_order,max_per_order,group_size,access_days,access_date,access_start_date,audience,promo_eligible,sort_order';

  const { data, error } = await supabase
    .from('ticket_products')
    .select(cols)
    .eq('event_id', eventId)
    .eq('active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;

  const products = ((data ?? []) as TicketProduct[]).filter(p => !p.code.startsWith('internal_test_'));
  if (!includeInternalTest) return products;

  const { data: previewData, error: previewError } = await supabase
    .from('ticket_products')
    .select(cols)
    .eq('event_id', eventId)
    .in('code', ['three_days', 'four_days'])
    .eq('active', false)
    .order('sort_order', { ascending: true });
  if (previewError) throw previewError;

  const { data: testData, error: testError } = await supabase
    .from('ticket_products')
    .select(cols)
    .eq('event_id', eventId)
    .eq('code', 'internal_test_4days_1eur')
    .maybeSingle();
  if (testError) throw testError;
  return [...products, ...((previewData ?? []) as TicketProduct[]), ...(testData ? [testData as TicketProduct] : [])];
}

export async function startTicketCheckout(input: {
  eventId: string;
  items: Array<{ productId: string; quantity: number }>;
  promoCode?: string | null;
}): Promise<{ orderId: string; url: string }> {
  const { data, error } = await supabase.functions.invoke('create-ticket-checkout', {
    body: {
      eventId: input.eventId,
      items: input.items,
      promoCode: input.promoCode?.trim() || null,
    },
  });
  if (error) {
    const response = (error as any).context;
    const detail = response && typeof response.json === 'function'
      ? await response.json().catch(() => null)
      : null;
    throw new Error(detail?.error ?? error.message);
  }
  if (!data?.url || !data?.orderId) throw new Error(data?.error ?? 'checkout_failed');

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.assign(data.url);
  } else {
    await Linking.openURL(data.url);
  }
  return { orderId: data.orderId, url: data.url };
}
