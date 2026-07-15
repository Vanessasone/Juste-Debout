/**
 * Répertoire d'équipes (duos) — mémorisées d'une présélection à l'autre,
 * réutilisables pour composer les brackets des finales.
 */
import { supabase } from '@/lib/supabase';

export type Team = {
  id: string;
  name: string;
  country: string | null;
  photo_url: string | null;
};

export async function getTeams(): Promise<Team[]> {
  const { data, error } = await supabase
    .from('teams')
    .select('id,name,country,photo_url')
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Team[];
}

export async function createTeam(input: {
  name: string;
  country?: string | null;
  photoUrl?: string | null;
}): Promise<Team> {
  const { data, error } = await supabase
    .from('teams')
    .insert({ name: input.name, country: input.country ?? null, photo_url: input.photoUrl ?? null })
    .select('id,name,country,photo_url')
    .single();
  if (error) throw error;
  return data as Team;
}

export async function updateTeam(
  id: string,
  fields: Partial<Pick<Team, 'name' | 'country' | 'photo_url'>>,
): Promise<void> {
  const { error } = await supabase.from('teams').update(fields).eq('id', id);
  if (error) throw error;
}
