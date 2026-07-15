/**
 * Certifications — badges officiels vérifiés, attribués par Juste Debout.
 * Lecture publique ; attribution/retrait réservés aux admins (RLS `is_admin()`).
 */
import { supabase } from '@/lib/supabase';

export type CertKind = 'prof_certifie' | 'vainqueur' | 'finaliste' | 'diplome_school' | 'juge';

export type Certification = {
  id: string;
  profile_id: string;
  kind: CertKind;
  label: string | null;
  event_id: string | null;
  year: number | null;
  granted_at: string;
};

/** Métadonnées d'affichage par type de certification (couleurs 100% charte JD). */
export const CERT_META: Record<
  CertKind,
  { label: string; short: string; icon: string; color: string; order: number }
> = {
  vainqueur: { label: 'Vainqueur Juste Debout', short: 'Vainqueur', icon: 'trophy', color: '#A4FA00', order: 0 },
  finaliste: { label: 'Finaliste Juste Debout', short: 'Finaliste', icon: 'medal', color: '#C7CCD1', order: 1 },
  prof_certifie: { label: 'Prof certifié JD', short: 'Prof certifié', icon: 'ribbon', color: '#A4FA00', order: 2 },
  diplome_school: { label: 'Diplômé JD School', short: 'Diplômé School', icon: 'school', color: '#A4FA00', order: 3 },
  juge: { label: 'Juge officiel JD', short: 'Juge officiel', icon: 'shield-checkmark', color: '#FF2D9E', order: 4 },
};

export const CERT_KINDS = (Object.keys(CERT_META) as CertKind[]).sort(
  (a, b) => CERT_META[a].order - CERT_META[b].order,
);

/** Libellé complet d'une certification (avec précision + année si présentes). */
export function certTitle(cert: Certification): string {
  const base = CERT_META[cert.kind].label;
  const extra = [cert.label, cert.year ? String(cert.year) : null].filter(Boolean).join(' · ');
  return extra ? `${base} — ${extra}` : base;
}

function sortCerts(rows: Certification[]): Certification[] {
  return rows.sort(
    (a, b) =>
      CERT_META[a.kind].order - CERT_META[b.kind].order ||
      (b.year ?? 0) - (a.year ?? 0),
  );
}

/** Certifications d'un profil (triées par prestige). */
export async function getCertifications(profileId: string): Promise<Certification[]> {
  const { data, error } = await supabase
    .from('certifications')
    .select('id, profile_id, kind, label, event_id, year, granted_at')
    .eq('profile_id', profileId);
  if (error) throw error;
  return sortCerts((data ?? []) as Certification[]);
}

/** Carte profil → badge le plus prestigieux (pour un sceau « vérifié » dans les listes). */
export async function getTopCertByProfile(): Promise<Map<string, CertKind>> {
  const { data, error } = await supabase.from('certifications').select('profile_id, kind');
  if (error) throw error;
  const map = new Map<string, CertKind>();
  for (const row of (data ?? []) as { profile_id: string; kind: CertKind }[]) {
    const cur = map.get(row.profile_id);
    if (!cur || CERT_META[row.kind].order < CERT_META[cur].order) map.set(row.profile_id, row.kind);
  }
  return map;
}

export async function getMyCertifications(): Promise<Certification[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  return getCertifications(user.id);
}

// ---- Administration (réservé aux admins via RLS) ----

/** Attribue une certification à un profil. `granted_by` = admin courant (exigé par la RLS). */
export async function grantCertification(input: {
  profileId: string;
  kind: CertKind;
  label?: string | null;
  year?: number | null;
  eventId?: string | null;
}): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Non connecté');
  const { error } = await supabase.from('certifications').insert({
    profile_id: input.profileId,
    kind: input.kind,
    label: input.label?.trim() || null,
    year: input.year ?? null,
    event_id: input.eventId ?? null,
    granted_by: user.id,
  });
  if (error) throw error;
}

export async function revokeCertification(id: string): Promise<void> {
  const { error } = await supabase.from('certifications').delete().eq('id', id);
  if (error) throw error;
}

/** Recherche de profils (pour l'écran admin d'attribution). */
export async function searchProfilesByName(
  q: string,
): Promise<{ id: string; full_name: string | null; alias: string | null; country: string | null }[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, alias, country')
    .or(`full_name.ilike.%${term}%,alias.ilike.%${term}%`)
    .order('full_name', { ascending: true })
    .limit(20);
  if (error) throw error;
  return data ?? [];
}
