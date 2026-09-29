/**
 * Commandes boutique — création (avec adresse de livraison), lecture, réception temps réel (staff).
 * Le paiement (Stripe) viendra plus tard : une commande est créée en `pending`.
 */
import { supabase } from '@/lib/supabase';

export type Address = {
  full_name: string;
  phone?: string;
  address_line1: string;
  address_line2?: string;
  postal_code: string;
  city: string;
  country: string;
  note?: string;
};

export type OrderItemInput = { product_id: string; name: string; unit_price: number; quantity: number };

export type OrderItem = { name: string; unit_price: number; quantity: number };

export type Order = {
  id: string;
  profile_id: string;
  status: string; // pending | paid | shipped | delivered | cancelled
  currency: string;
  total: number; // centimes
  full_name: string;
  phone: string | null;
  address_line1: string;
  address_line2: string | null;
  postal_code: string;
  city: string;
  country: string;
  note: string | null;
  created_at: string;
  items?: OrderItem[];
  buyer?: { full_name: string | null; alias: string | null } | null;
};

/** Crée une commande + ses lignes. Statut `pending` (paiement Stripe à venir). */
export async function createOrder(address: Address, items: OrderItemInput[], currency = 'EUR'): Promise<Order> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Tu dois être connecté.');
  const total = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      profile_id: user.id,
      status: 'pending',
      currency,
      total,
      full_name: address.full_name.trim(),
      phone: address.phone?.trim() || null,
      address_line1: address.address_line1.trim(),
      address_line2: address.address_line2?.trim() || null,
      postal_code: address.postal_code.trim(),
      city: address.city.trim(),
      country: address.country.trim(),
      note: address.note?.trim() || null,
    })
    .select()
    .single();
  if (error) throw error;
  const rows = items.map((i) => ({
    order_id: order.id,
    product_id: i.product_id,
    name: i.name,
    unit_price: i.unit_price,
    quantity: i.quantity,
  }));
  const { error: e2 } = await supabase.from('order_items').insert(rows);
  if (e2) throw e2;
  return order as Order;
}

/** Mes commandes (acheteur). */
export async function getMyOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(name,unit_price,quantity)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((o: any) => ({ ...o, items: o.order_items ?? [] }));
}

/** Toutes les commandes reçues (staff/admin) — avec l'acheteur. */
export async function getAllOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(name,unit_price,quantity), profiles(full_name,alias)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((o: any) => ({ ...o, items: o.order_items ?? [], buyer: o.profiles ?? null }));
}

export async function setOrderStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase.from('orders').update({ status }).eq('id', id);
  if (error) throw error;
}

/** Abonnement temps réel aux nouvelles commandes (console staff). Retourne une fonction de désabonnement. */
export function subscribeOrders(onChange: () => void): () => void {
  const ch = supabase
    .channel('orders-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => onChange())
    .subscribe();
  return () => {
    supabase.removeChannel(ch);
  };
}
