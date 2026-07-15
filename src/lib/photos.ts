/**
 * Upload de photos vers Supabase Storage (bucket public « photos »).
 * - 'avatar'   : photo perso du danseur              → profiles.photo_url
 * - 'official' : photo officielle posée par Juste Debout → profiles.official_photo_url
 * - côtés d'un passage (photos des duos)             → passages.side_a_photo / side_b_photo
 */
import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

const BUCKET = 'photos';

export type PhotoKind = 'avatar' | 'official';
export type PhotoSource = 'camera' | 'library';

/** Ouvre caméra/galerie et renvoie l'image en base64 (ou null si annulé). */
export async function pickImage(source: PhotoSource): Promise<string | null> {
  const options = {
    allowsEditing: true,
    aspect: [1, 1] as [number, number],
    quality: 0.6,
    base64: true,
  };
  let res;
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error("Autorisation d'accès à l'appareil photo refusée.");
    res = await ImagePicker.launchCameraAsync(options);
  } else {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) throw new Error("Autorisation d'accès aux photos refusée.");
    res = await ImagePicker.launchImageLibraryAsync({ ...options, mediaTypes: ['images'] });
  }
  if (res.canceled || !res.assets?.length || !res.assets[0].base64) return null;
  return res.assets[0].base64;
}

async function uploadBase64(path: string, base64: string): Promise<string> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, decode(base64), { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`; // cache-buster
}

/** Photo de profil (perso ou officielle). */
export async function pickAndUpload(
  kind: PhotoKind,
  source: PhotoSource = 'library',
  forUserId?: string,
): Promise<string | null> {
  const base64 = await pickImage(source);
  if (!base64) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = forUserId ?? user?.id;
  if (!uid) throw new Error('Tu dois être connecté.');
  return uploadBase64(`${uid}/${kind}.jpg`, base64);
}

/** Photo d'un côté d'un passage (duo A / duo B) — pour l'écran live. */
export async function pickAndUploadPassageSide(
  passageId: string,
  side: 'a' | 'b',
  source: PhotoSource = 'library',
): Promise<string | null> {
  const base64 = await pickImage(source);
  if (!base64) return null;
  return uploadBase64(`passages/${passageId}/${side}.jpg`, base64);
}

/** Uploade une photo d'équipe déjà obtenue en base64 vers teams/<id>.jpg. */
export async function uploadTeamPhoto(teamId: string, base64: string): Promise<string> {
  return uploadBase64(`teams/${teamId}.jpg`, base64);
}
