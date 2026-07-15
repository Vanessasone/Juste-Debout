/**
 * Affichage des certifications officielles (badges vérifiés JD).
 */
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { T } from '@/components/ui';
import { Space } from '@/constants/brand';
import { CERT_META, certTitle, type Certification } from '@/lib/certifications';
import { useColors } from '@/lib/theme';

/** Une pastille certification : icône colorée + libellé + sceau « vérifié ». */
export function CertChip({ cert }: { cert: Certification }) {
  const c = useColors();
  const meta = CERT_META[cert.kind];
  const extra = [cert.label, cert.year ? String(cert.year) : null].filter(Boolean).join(' · ');
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingVertical: 7,
        paddingHorizontal: 11,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: meta.color + '55',
        backgroundColor: meta.color + '14',
      }}>
      <Ionicons name={meta.icon as keyof typeof Ionicons.glyphMap} size={15} color={meta.color} />
      <T variant="caption" color={c.text} style={{ fontWeight: '700' }}>
        {meta.short}
        {extra ? <T variant="caption" color={c.textMute}>{`  ${extra}`}</T> : null}
      </T>
      <Ionicons name="checkmark-circle" size={13} color={meta.color} />
    </View>
  );
}

/** Grille de badges (wrap). Rien n'est rendu s'il n'y a aucune certification. */
export function CertChips({ certs, style }: { certs: Certification[]; style?: object }) {
  if (!certs.length) return null;
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm }, style]}>
      {certs.map((cert) => (
        <CertChip key={cert.id} cert={cert} />
      ))}
    </View>
  );
}

/** Accessibilité : libellé texte complet (pour lecteurs d'écran / logs). */
export function certChipLabel(cert: Certification): string {
  return certTitle(cert);
}
