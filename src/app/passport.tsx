/**
 * Passeport JD — collection réelle des événements Juste Debout de l'utilisateur.
 * Chaque événement où il est inscrit devient un tampon (validé quand l'événement est terminé).
 */
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, PageHeader, Progress, Screen, Section, T } from '@/components/ui';
import { Gradients, Radius, Space } from '@/constants/brand';
import { ThemeColors } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { getMyRegistrationsFull } from '@/lib/jdlive';
import { getMyProfile, Profile as ProfileRow } from '@/lib/profile';
import { useColors } from '@/lib/theme';

type Stamp = { id: string; title: string; city: string | null; year: number | null; done: boolean };

export default function Passport() {
  const c = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [stamps, setStamps] = useState<Stamp[]>([]);
  useFocusEffect(
    useCallback(() => {
      getMyProfile().then(setProfile).catch(() => {});
      getMyRegistrationsFull()
        .then((regs) => {
          const byEvent = new Map<string, Stamp>();
          regs.forEach((r) => {
            const e = r.events;
            if (e && !byEvent.has(e.id)) {
              byEvent.set(e.id, {
                id: e.id,
                title: e.title,
                city: e.city,
                year: e.starts_on ? new Date(e.starts_on).getFullYear() : null,
                done: e.status === 'done',
              });
            }
          });
          setStamps([...byEvent.values()]);
        })
        .catch(() => setStamps([]));
    }, []),
  );

  const earned = stamps.filter((s) => s.done).length;
  const pct = stamps.length ? earned / stamps.length : 0;
  const name = profile?.alias || profile?.full_name || t('profile.dancer');
  const loc = [profile?.city, profile?.country].filter(Boolean).join(', ');

  return (
    <Screen>
      <PageHeader title={t('passport.title')} subtitle={t('passport.subtitle')} />

      {/* Carte passeport */}
      <LinearGradient colors={Gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.passport}>
        <View style={styles.rowBetween}>
          <View>
            <T variant="caption" color="rgba(0,0,0,0.6)">
              {t('passport.word')}
            </T>
            <T variant="h1" color={c.black}>
              Juste Debout
            </T>
          </View>
          <Ionicons name="ribbon" size={40} color="rgba(0,0,0,0.4)" />
        </View>
        <View style={{ marginTop: Space.xl }}>
          <T variant="h3" color={c.black}>
            {name}
          </T>
          <T variant="small" color="rgba(0,0,0,0.65)">
            {loc ? `${loc} · ` : ''}
            {t('passport.eventsCount', { n: stamps.length })}
          </T>
        </View>
      </LinearGradient>

      {stamps.length > 0 && (
        <View style={{ marginTop: Space.lg }}>
          <View style={styles.rowBetween}>
            <T variant="small" color={c.textDim}>
              {t('passport.stampsLine', { done: earned, total: stamps.length })}
            </T>
            <T variant="small" color={c.gold}>
              {Math.round(pct * 100)}%
            </T>
          </View>
          <View style={{ marginTop: 8 }}>
            <Progress value={pct} color={c.gold} />
          </View>
        </View>
      )}

      {/* Tampons */}
      <Section title={t('passport.stampsTitle')}>
        {stamps.length === 0 ? (
          <Card>
            <T variant="small" color={c.textDim}>
              {t('passport.empty')}
            </T>
            <T variant="caption" color={c.textMute} style={{ marginTop: 6 }}>
              {t('passport.emptyHint')}
            </T>
          </Card>
        ) : (
          <View style={styles.grid}>
            {stamps.map((p) => (
              <View key={p.id} style={styles.stampWrap}>
                <View style={[styles.stamp, { opacity: p.done ? 1 : 0.55, borderColor: p.done ? c.gold : c.border }]}>
                  <Ionicons
                    name={p.done ? 'checkmark-circle' : 'time-outline'}
                    size={26}
                    color={p.done ? c.gold : c.textMute}
                  />
                  {p.year != null && (
                    <T variant="caption" color={c.textDim} style={{ marginTop: 2 }}>
                      {p.year}
                    </T>
                  )}
                </View>
                <T variant="caption" color={c.textDim} style={{ textAlign: 'center', marginTop: 6 }} numberOfLines={1}>
                  {p.city ?? p.title}
                </T>
                <T variant="caption" color={c.textMute} style={{ textAlign: 'center' }} numberOfLines={1}>
                  {p.done ? t('passport.validated') : t('passport.upcoming')}
                </T>
              </View>
            ))}
          </View>
        )}
      </Section>
    </Screen>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  passport: { borderRadius: Radius.xl, padding: Space.xl, marginTop: Space.md, minHeight: 170, justifyContent: 'space-between' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  stampWrap: { width: '31%', marginBottom: Space.lg, alignItems: 'center' },
  stamp: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
