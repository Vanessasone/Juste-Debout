/**
 * Profil utilisateur (table `profiles` sur Supabase).
 */
import { supabase } from '@/lib/supabase';

export type Profile = {
  id: string;
  full_name: string | null;
  alias: string | null;
  country: string | null;
  city: string | null;
  styles: string[] | null;
  level: string | null;
  bio: string | null;
  instagram: string | null;
  photo_url: string | null;
  official_photo_url: string | null;
  roles: string[] | null;
  available_for_school?: boolean | null;
  school_note?: string | null;
  profile_kind?: string | null; // 'dancer' | 'fan'
  jd_school_eligible?: boolean | null; // finaliste/présélectionné → peut proposer des stages
};

/** Annuaire — tous les danseurs (profils). Lecture ouverte aux connectés (RLS). */
export async function getDancers(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('full_name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Profile[];
}

/** Un profil par son id (fiche danseur). */
export async function getProfileById(id: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as Profile) ?? null;
}

/** Danseurs/finalistes disponibles pour donner des stages à la JD School. */
export async function getAvailableTeachers(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('available_for_school', true)
    .order('full_name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function getMyProfile(): Promise<Profile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null; // aucune ligne
    throw error;
  }
  return data as Profile;
}

export async function updateMyProfile(fields: Partial<Profile>): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Tu dois être connecté.');
  const { error } = await supabase.from('profiles').update(fields).eq('id', user.id);
  if (error) throw error;
}
