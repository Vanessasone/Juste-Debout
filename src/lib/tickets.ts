/**
 * Billets — portefeuille QR + contrôle d'entrée.
 * (Sans paiement pour l'instant : billet « à régler sur place » ; Stripe viendra ensuite.)
 */
import { supabase } from '@/lib/supabase';

export type Ticket = {
  id: string;
  event_id: string;
  profile_id: string;
  type: string;
  status: string; // active | used | cancelled
  qr_token: string;
  payment_method: string | null;
  created_at: string;
  used_at: string | null;
  ticket_product_id?: string | null;
  order_item_id?: string | null;
  family_role?: 'adult' | 'child' | null;
  unit_index?: number | null;
  holder_name?: string | null;
  holder_email?: string | null;
  purchaser_id?: string | null;
  transfer_status?: string | null;
  transfer_email?: string | null;
  transfer_sent_at?: string | null;
  price_cents?: number | null;
  currency?: string | null;
  events?: { title: string; city: string | null; country: string | null; venue: string | null; address: string | null; starts_on: string | null; ends_on: string | null } | null;
  ticket_products?: { name: string; code: string; access_days: number; access_date: string | null; group_size: number } | null;
  profiles?: { full_name: string | null; alias: string | null } | null;
};

export async function getMyTickets(): Promise<Ticket[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('tickets')
    .select('*, events(title,city,country,venue,address,starts_on,ends_on), ticket_products(name,code,access_days,access_date,group_size)')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Ticket[];
}

/** Obtenir son billet pour un événement (réservation ; paiement sur place). */
export async function obtainTicket(eventId: string, type = 'spectator'): Promise<Ticket> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Tu dois être connecté.');
  const { data, error } = await supabase
    .from('tickets')
    .insert({ event_id: eventId, profile_id: user.id, type, payment_method: 'free' })
    .select('*, events(title,city,venue,starts_on)')
    .single();
  if (error) throw error;
  return data as unknown as Ticket;
}

/** Recherche d'un billet par son jeton QR (staff/admin — scanner d'entrée). */
export async function getTicketByToken(token: string): Promise<Ticket | null> {
  const { data, error } = await supabase
    .from('tickets')
    .select('*, events(title), profiles(full_name,alias)')
    .eq('qr_token', token.trim())
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Ticket) ?? null;
}

/**
 * Valider un billet à l'entrée (marque « utilisé »).
 * Check-and-set ATOMIQUE : ne marque que si le billet est encore `active`.
 * Retourne `false` si aucune ligne n'a été modifiée (billet déjà utilisé/annulé,
 * p. ex. course entre deux scanners simultanés) — évite le double-comptage.
 */
export async function markTicketUsed(id: string): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('tickets')
    .update({ status: 'used', used_at: new Date().toISOString(), scanned_by: user?.id ?? null })
    .eq('id', id)
    .eq('status', 'active')
    .select('id');
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}


export async function prepareTicketTransfer(ticketId: string, email: string): Promise<{ token: string }> {
  const { data, error } = await supabase.rpc('prepare_ticket_transfer', { p_ticket: ticketId, p_email: email.trim() });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error ?? 'transfer_failed');
  return { token: data.token };
}

export async function acceptTicketTransfer(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_ticket_transfer', { p_token: token });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error ?? 'transfer_failed');
  return data.ticket_id;
}


export async function cancelTicketTransfer(ticketId: string): Promise<void> {
  const { data, error } = await supabase.rpc('cancel_ticket_transfer', { p_ticket: ticketId });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error ?? 'cancel_transfer_failed');
}


export async function scanTicketForToday(id: string): Promise<{ ok: boolean; error?: string; scan_count?: number; access_days?: number; scanned_at?: string }> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase.rpc('scan_ticket', { p_ticket: id, p_access_date: today });
  if (error) throw error;
  return data;
}
