import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { type TourEntry } from '@/lib/tourRegistration';
import { PARIS_RULES_VERSION } from '@/lib/rules/paris2027';

export async function uploadRegistrationPhoto(): Promise<string | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.7, base64: true });
  if (picked.canceled || !picked.assets?.[0]?.base64) return null;
  const asset = picked.assets[0];
  const bytes = decode(asset.base64!);
  if (bytes.byteLength > 5 * 1024 * 1024) throw new Error('Photo trop lourde : maximum 5 Mo.');
  const header = new Uint8Array(bytes);
  const jpeg = header[0] === 0xff && header[1] === 0xd8;
  const png = header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47;
  if (!jpeg && !png) throw new Error('Choisis une photo JPEG ou PNG.');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Connecte-toi avant d’ajouter une photo.');
  // Unique immutable object: replacing a photo changes the dossier snapshot.
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  const path = `${user.id}/${nonce}.${jpeg ? 'jpg' : 'png'}`;
  const { error } = await supabase.storage.from('registration-photos').upload(path, bytes, { contentType: jpeg ? 'image/jpeg' : 'image/png', upsert: false });
  if (error) throw new Error('Envoi de la photo indisponible pour le moment.');
  return path;
}
export async function previewRegistrationPhoto(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('registration-photos').createSignedUrl(path, 300);
  if (error || !data) throw new Error('Aperçu indisponible.');
  return data.signedUrl;
}
export async function saveTourDraft(entry: TourEntry): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Connecte-toi pour enregistrer ton dossier.');
  const { data, error } = await supabase.from('tour_registration_drafts').upsert({ profile_id: user.id, stop_slug: entry.stop, category: entry.category, payload: entry }, { onConflict: 'profile_id,stop_slug,category' }).select('id').single();
  if (error || !data) throw new Error('Enregistrement du dossier indisponible pour le moment.');
  return data.id;
}
export async function signParisRules(draftId: string, signerName: string, agreed: boolean): Promise<void> {
  const { error } = await supabase.rpc('sign_paris_registration_rules', { p_draft_id: draftId, p_signer_name: signerName.trim(), p_rules_version: PARIS_RULES_VERSION, p_agreed: agreed });
  if (error) throw new Error(error.message);
}
