/**
 * Juste Debout School — section « écoles / stages ».
 * En-tête avec switcher JD ↔ JD School, et la liste des professeurs disponibles pour des stages.
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppSwitcher } from '@/components/AppSwitcher';
import { Avatar, Card, GButton, Screen, Section, T, Tag } from '@/components/ui';
import { Radius, Space } from '@/constants/brand';
import { ThemeColors } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { getAvailableTeachers, Profile } from '@/lib/profile';
import { useColors } from '@/lib/theme';
import { flagEmoji } from '@/lib/vote';

export default function School() {
  const c = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [teachers, setTeachers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAvailableTeachers()
      .then(setTeachers)
      .catch(() => setTeachers([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Screen>
      {/* Bascule JD ↔ JD School */}
      <AppSwitcher current="school" />

      {/* Hero */}
      <View style={{ marginTop: Space.lg }}>
        <T variant="caption" color={c.accent}>
          {t('school.tag')}
        </T>
        <T variant="title" style={{ marginTop: 4 }}>
          Juste Debout School
        </T>
        <T variant="small" color={c.textDim} style={{ marginTop: 6 }}>
          {t('school.sub')}
        </T>
      </View>

      <Section title={t('school.available')}>
        {loading ? (
          <ActivityIndicator color={c.accent} style={{ marginTop: Space.lg }} />
        ) : teachers.length === 0 ? (
          <Card>
            <T variant="small" color={c.textDim}>
              {t('school.empty')}
            </T>
            <T variant="caption" color={c.textMute} style={{ marginTop: 6 }}>
              {t('school.emptyHint')}
            </T>
          </Card>
        ) : (
          teachers.map((teacher) => {
            const name = teacher.alias || teacher.full_name || t('profile.dancer');
            return (
              <Card key={teacher.id} style={{ marginBottom: Space.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Avatar name={name} uri={teacher.photo_url} size={52} />
                  <View style={{ flex: 1, marginLeft: Space.md }}>
                    <T variant="h3">
                      {flagEmoji(teacher.country)} {name}
                    </T>
                    <T variant="small" color={c.textDim} style={{ marginTop: 2 }}>
                      {[teacher.city, teacher.level].filter(Boolean).join(' · ') || t('profile.dancer')}
                    </T>
                  </View>
                  <View style={styles.contact}>
                    <Ionicons name="chatbubble-ellipses" size={18} color={c.accent} />
                  </View>
                </View>
                {(teacher.styles?.length ?? 0) > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: Space.md }}>
                    {teacher.styles!.map((s) => (
                      <Tag key={s} label={s} color={c.accent} />
                    ))}
                  </View>
                )}
                {!!teacher.school_note && (
                  <T variant="small" color={c.textDim} style={{ marginTop: Space.md }}>
                    {teacher.school_note}
                  </T>
                )}
                <View style={{ marginTop: Space.md }}>
                  <GButton label={t('school.proposeStage')} icon="calendar" onPress={() => {}} />
                </View>
              </Card>
            );
          })
        )}
      </Section>

      <T variant="caption" color={c.textMute} style={{ marginTop: Space.xl, textAlign: 'center' }}>
        {t('school.footer')}
      </T>
    </Screen>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    switcher: {
      flexDirection: 'row',
      backgroundColor: c.surface,
      borderRadius: Radius.pill,
      padding: 4,
      borderWidth: 1,
      borderColor: c.border,
    },
    seg: { flex: 1, paddingVertical: 11, alignItems: 'center', borderRadius: Radius.pill },
    segActive: { backgroundColor: c.primary },
    contact: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.primary + '1A',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
