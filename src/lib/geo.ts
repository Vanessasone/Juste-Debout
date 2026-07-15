/**
 * Géolocalisation opt-in — « les danseurs autour de toi ».
 * La position est arrondie (~1 km) avant envoi ; seule une distance est exposée aux autres.
 */
import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

export type NearbyDancer = {
  id: string;
  alias: string | null;
  full_name: string | null;
  country: string | null;
  city: string | null;
  photo_url: string | null;
  styles: string[] | null;
  level: string | null;
  distance_km: number;
};

/** Arrondi à 2 décimales (~1,1 km) pour ne jamais stocker une position précise. */
function coarse(v: number): number {
  return Math.round(v * 100) / 100;
}

async function uid(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** L'utilisateur partage-t-il sa position ? */
export async function getLocationSharing(): Promise<boolean> {
  const id = await uid();
  if (!id) return false;
  const { data } = await supabase
    .from('profile_location')
    .select('share_location')
    .eq('profile_id', id)
    .maybeSingle();
  return !!data?.share_location;
}

/** Active le partage : demande la permission, relève la position (approx.) et l'enregistre. */
export async function enableLocationSharing(): Promise<{ ok: boolean; reason?: 'permission' | 'auth' | 'web' | string }> {
  if (Platform.OS === 'web') return { ok: false, reason: 'web' };
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') return { ok: false, reason: 'permission' };
  const id = await uid();
  if (!id) return { ok: false, reason: 'auth' };
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
  const { error } = await supabase.from('profile_location').upsert({
    profile_id: id,
    share_location: true,
    lat: coarse(pos.coords.latitude),
    lng: coarse(pos.coords.longitude),
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

/** Désactive le partage et efface les coordonnées (conserve le token push). */
export async function disableLocationSharing(): Promise<void> {
  const id = await uid();
  if (!id) return;
  await supabase
    .from('profile_location')
    .upsert({ profile_id: id, share_location: false, lat: null, lng: null, updated_at: new Date().toISOString() });
}

/** Rafraîchit la position si le partage est déjà actif (à l'ouverture de l'écran). */
export async function refreshMyLocation(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!(await getLocationSharing())) return;
  const perm = await Location.getForegroundPermissionsAsync();
  if (perm.status !== 'granted') return;
  const id = await uid();
  if (!id) return;
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
  await supabase.from('profile_location').upsert({
    profile_id: id,
    lat: coarse(pos.coords.latitude),
    lng: coarse(pos.coords.longitude),
    updated_at: new Date().toISOString(),
  });
}

/** Danseurs de la communauté proches (distance uniquement). */
export async function getNearbyDancers(radiusKm = 150): Promise<NearbyDancer[]> {
  const { data, error } = await supabase.rpc('dancers_nearby', { p_radius_km: radiusKm });
  if (error) throw error;
  return (data ?? []) as NearbyDancer[];
}

/** Distance lisible (ex. « 3 km », « 120 km »). Unité universelle. */
export function distanceLabel(km: number): string {
  if (km < 1) return '< 1 km';
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}
