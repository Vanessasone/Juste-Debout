/**
 * JD Live — accès aux données d'inscription (Supabase).
 */
import { supabase } from '@/lib/supabase';

export type EventRow = {
  id: string;
  title: string;
  city: string | null;
  country: string | null;
  venue: string | null;
  starts_on: string | null;
  ends_on: string | null;
  status: string;
  tier?: string; // 'official' | 'preselection' | 'partner'
  moderation?: string; // 'approved' | 'pending' | 'rejected'
  tickets_open?: boolean; // billetterie ouverte ?
};

const EVENT_COLS = 'id,title,city,country,venue,starts_on,ends_on,status,tier,moderation,tickets_open';

export type Category = {
  id: string;
  name: string;
  format: string; // '1v1' | '2v2'
  family: string | null; // 'classic' | 'afro' | 'junior'
  sort_order: number;
};

export type RegType = 'dancer' | 'spectator';

export type Registration = {
  id: string;
  event_id: string;
  type: RegType;
  category_id: string | null;
  status: string;
  created_at: string;
};

/** Événements à venir (finale + présélections). */
export async function getEvents(): Promise<EventRow[]> {
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_COLS)
    .order('starts_on', { ascending: true });
  if (error) throw error;
  return (data ?? []) as EventRow[];
}

/**
 * Le « prochain » événement à mettre en avant sur l'accueil :
 * un événement en cours (live) en priorité, sinon le prochain à venir,
 * sinon le plus récent. Renvoie null si la base est vide.
 */
export async function getNextEvent(): Promise<EventRow | null> {
  const cols = EVENT_COLS;
  // 1) un événement live ?
  const live = await supabase.from('events').select(cols).eq('status', 'live').limit(1);
  if (live.data?.length) return live.data[0] as EventRow;
  // 2) le prochain non terminé (par date croissante)
  const upcoming = await supabase
    .from('events')
    .select(cols)
    .neq('status', 'done')
    .order('starts_on', { ascending: true })
    .limit(1);
  if (upcoming.data?.length) return upcoming.data[0] as EventRow;
  // 3) à défaut, le plus récent
  const latest = await supabase
    .from('events')
    .select(cols)
    .order('starts_on', { ascending: false })
    .limit(1);
  return (latest.data?.[0] as EventRow) ?? null;
}

/** Id de la saison active (pour rattacher un nouvel événement). */
export async function getActiveSeasonId(): Promise<string | null> {
  const { data } = await supabase
    .from('seasons')
    .select('id')
    .eq('is_active', true)
    .order('year', { ascending: false })
    .limit(1);
  return data?.[0]?.id ?? null;
}

/** Toutes les disciplines de la saison active (pour le choix à la création d'un événement). */
export async function getSeasonCategories(): Promise<Category[]> {
  const seasonId = await getActiveSeasonId();
  if (!seasonId) return [];
  const { data, error } = await supabase
    .from('categories')
    .select('id,name,format,family,sort_order')
    .eq('season_id', seasonId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Category[];
}

export type NewEvent = {
  title: string;
  city?: string | null;
  country?: string | null;
  venue?: string | null;
  starts_on?: string | null; // 'YYYY-MM-DD'
  ends_on?: string | null;
  status?: string; // upcoming | preselection | live | done
  categoryIds?: string[]; // disciplines proposées
};

/** Créer un événement (organisateur = utilisateur courant) + rattacher ses disciplines. */
export async function createEvent(input: NewEvent): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Tu dois être connecté.');
  const seasonId = await getActiveSeasonId();
  const { data, error } = await supabase
    .from('events')
    .insert({
      season_id: seasonId,
      title: input.title,
      city: input.city ?? null,
      country: input.country ?? null,
      venue: input.venue ?? null,
      starts_on: input.starts_on ?? null,
      ends_on: input.ends_on ?? null,
      organizer_id: user.id,
      status: input.status ?? 'upcoming',
    })
    .select('id')
    .single();
  if (error) throw error;
  const eventId = data.id as string;
  if (input.categoryIds?.length) {
    const rows = input.categoryIds.map((cid) => ({ event_id: eventId, category_id: cid }));
    const { error: e2 } = await supabase.from('event_categories').insert(rows);
    if (e2) throw e2;
  }
  return eventId;
}

/** Mettre à jour le statut d'un événement (upcoming → preselection → live → done). */
export async function updateEventStatus(eventId: string, status: string): Promise<void> {
  const { error } = await supabase.from('events').update({ status }).eq('id', eventId);
  if (error) throw error;
}

// ---- Modération des événements partenaires (admin) ----

/** Événements partenaires en attente de validation (visibles par l'admin via RLS). */
export async function getPendingEvents(): Promise<EventRow[]> {
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_COLS)
    .eq('moderation', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as EventRow[];
}

/** Valide ou refuse un événement partenaire (admin only, contrôlé côté serveur). */
export async function moderateEvent(eventId: string, decision: 'approved' | 'rejected'): Promise<void> {
  const { error } = await supabase.from('events').update({ moderation: decision }).eq('id', eventId);
  if (error) throw error;
}

/** Disciplines proposées par un événement donné. */
export async function getEventCategories(eventId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from('event_categories')
    .select('categories(id,name,family,format,sort_order)')
    .eq('event_id', eventId);
  if (error) throw error;
  return ((data ?? []) as any[])
    .map((r) => r.categories)
    .filter(Boolean)
    .sort((a: Category, b: Category) => a.sort_order - b.sort_order) as Category[];
}

/** Mes inscriptions. */
export async function getMyRegistrations(): Promise<Registration[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('registrations')
    .select('id,event_id,type,category_id,status,created_at')
    .eq('profile_id', user.id);
  if (error) throw error;
  return (data ?? []) as Registration[];
}

/** Mes inscriptions enrichies de l'événement + la discipline — pour le profil. */
export type MyRegistration = {
  id: string;
  type: RegType;
  status: string;
  created_at: string;
  category_id: string | null;
  events: {
    id: string;
    title: string;
    city: string | null;
    country: string | null;
    venue: string | null;
    starts_on: string | null;
    ends_on: string | null;
    status: string;
  } | null;
  categories: { name: string; format: string; family: string | null } | null;
};

export async function getMyRegistrationsFull(): Promise<MyRegistration[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('registrations')
    .select(
      'id,type,status,created_at,category_id,events(id,title,city,country,venue,starts_on,ends_on,status),categories(name,format,family)',
    )
    .eq('profile_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as MyRegistration[];
}

/** Inscription enrichie (profil + discipline) — pour l'espace organisateur. */
export type RegistrationFull = {
  id: string;
  type: RegType;
  status: string;
  created_at: string;
  profiles: {
    id: string;
    full_name: string | null;
    alias: string | null;
    country: string | null;
    city: string | null;
    official_photo_url: string | null;
  } | null;
  categories: { name: string; format: string; family: string | null } | null;
};

/** Tous les inscrits d'un événement (accès organisateur/admin via RLS). */
export async function getEventRegistrations(eventId: string): Promise<RegistrationFull[]> {
  const { data, error } = await supabase
    .from('registrations')
    .select(
      'id,type,status,created_at,profiles(id,full_name,alias,country,city,official_photo_url),categories(name,format,family)',
    )
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as RegistrationFull[];
}

/** Juste Debout pose la photo officielle d'un danseur (admin uniquement, via RLS). */
export async function setOfficialPhoto(dancerId: string, url: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ official_photo_url: url })
    .eq('id', dancerId);
  if (error) throw error;
}

/** S'inscrire à un événement (danseur ou spectateur). */
export async function register(input: {
  eventId: string;
  type: RegType;
  categoryId?: string | null;
  consent: boolean;
}): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Tu dois être connecté.');
  const { error } = await supabase.from('registrations').insert({
    event_id: input.eventId,
    profile_id: user.id,
    type: input.type,
    category_id: input.categoryId ?? null,
    consent_rgpd: input.consent,
    status: 'registered',
  });
  if (error) throw error;
}
