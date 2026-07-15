/**
 * État « Bientôt disponible » — pour les modules dont le backend n'est pas encore branché.
 * Évite d'afficher du contenu factice tout en présentant honnêtement ce qui arrive.
 */
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { Card, IconBubble, PageHeader, Screen, T, Tag } from '@/components/ui';
import { Space } from '@/constants/brand';
import { useT } from '@/lib/i18n';
import { useColors } from '@/lib/theme';

export function ComingSoon({
  title,
  subtitle,
  icon,
  bullets = [],
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  bullets?: string[];
}) {
  const c = useColors();
  const t = useT();
  return (
    <Screen>
      <PageHeader title={title} subtitle={t('common.soon')} />
      <Card style={{ alignItems: 'center', paddingVertical: Space.xl }}>
        <IconBubble icon={icon} color={c.accent} size={64} />
        <View style={{ marginTop: Space.md, alignItems: 'center' }}>
          <Tag label={t('common.soonShort')} color={c.accent} />
        </View>
        <T variant="title" style={{ marginTop: Space.md, textAlign: 'center' }}>
          {title}
        </T>
        <T variant="small" color={c.textDim} style={{ marginTop: 8, textAlign: 'center' }}>
          {subtitle}
        </T>
      </Card>

      {bullets.length > 0 && (
        <Card style={{ marginTop: Space.lg }}>
          {bullets.map((b, i) => (
            <View
              key={b}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                paddingVertical: 10,
                borderTopWidth: i > 0 ? 1 : 0,
                borderTopColor: c.borderSoft,
              }}>
              <Ionicons name="sparkles" size={16} color={c.accent} style={{ marginTop: 3, marginRight: 10 }} />
              <T variant="small" color={c.textDim} style={{ flex: 1 }}>
                {b}
              </T>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}
