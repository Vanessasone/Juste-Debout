/**
 * Admin — modération des événements partenaires (validation / refus).
 * Réservé aux admins (contrôlé côté serveur : trigger + RLS).
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Card, PageHeader, Screen, T } from '@/components/ui';
import { Palette, Radius, Space } from '@/constants/brand';
import { ThemeColors } from '@/constants/theme';
import { countryFlag } from '@/lib/countries';
import { useI18n } from '@/lib/i18n';
import { EventRow, getPendingEvents, moderateEvent } from '@/lib/jdlive';
import { useColors } from '@/lib/theme';

function eventDates(start: string | null, end: string | null, locale: string, tba: string): string {
  if (!start) return tba;
  const fmt = (d: string) => new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  return end && end !== start ? `${fmt(start)} → ${fmt(end)}` : fmt(start);
}

export default function AdminEvents() {
  const c = useColors();
  const { t, locale } = useI18n();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [rows, setRows] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    getPendingEvents()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => load(), [load]));

  async function decide(id: string, decision: 'approved' | 'rejected') {
    setBusy(id);
    try {
      await moderateEvent(id, decision);
      setRows((cur) => cur.filter((e) => e.id !== id));
    } catch {
      // laisse la ligne en place en cas d'échec
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <PageHeader title={t('ae.title')} subtitle={t('ae.subtitle')} />

      {loading ? (
        <ActivityIndicator color={c.accent} style={{ marginTop: Space.xl }} />
      ) : rows.length === 0 ? (
        <Card>
          <View style={{ alignItems: 'center', paddingVertical: Space.lg }}>
            <Ionicons name="checkmark-done-circle" size={40} color={c.primary} />
            <T variant="h3" style={{ marginTop: Space.md }}>
              {t('ae.nothing')}
            </T>
            <T variant="small" color={c.textDim} style={{ textAlign: 'center', marginTop: 6 }}>
              {t('ae.nothingSub')}
            </T>
          </View>
        </Card>
      ) : (
        rows.map((e) => (
          <Card key={e.id} style={{ marginBottom: Space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <T style={{ fontSize: 24 }}>{countryFlag(e.country) || '📍'}</T>
              <View style={{ flex: 1, marginLeft: Space.md }}>
                <T variant="h3" numberOfLines={2}>
                  {e.title}
                </T>
                <T variant="caption" color={c.textMute} style={{ marginTop: 2 }}>
                  {[e.venue, e.city, e.country].filter(Boolean).join(' · ') || '—'}
                </T>
                <T variant="caption" color={c.textDim} style={{ marginTop: 2 }}>
                  {eventDates(e.starts_on, e.ends_on, locale, t('ae.datesTba'))}
                </T>
              </View>
              <View style={styles.partnerTag}>
                <T variant="caption" color={Palette.sideFuchsia} style={{ fontWeight: '700', fontSize: 11 }}>
                  {t('ae.partner')}
                </T>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: Space.sm, marginTop: Space.md }}>
              <Pressable
                onPress={() => decide(e.id, 'rejected')}
                disabled={busy === e.id}
                style={[styles.btn, { borderColor: c.border }]}>
                <Ionicons name="close" size={16} color={c.textDim} />
                <T variant="label" color={c.textDim} style={{ marginLeft: 6 }}>
                  {t('ae.reject')}
                </T>
              </Pressable>
              <Pressable
                onPress={() => decide(e.id, 'approved')}
                disabled={busy === e.id}
                style={[styles.btn, styles.btnOk]}>
                {busy === e.id ? (
                  <ActivityIndicator color={c.black} />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={16} color={c.black} />
                    <T variant="label" color={c.black} style={{ marginLeft: 6 }}>
                      {t('common.validate')}
                    </T>
                  </>
                )}
              </Pressable>
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    partnerTag: {
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: Palette.sideFuchsia + '55',
      backgroundColor: Palette.sideFuchsia + '14',
    },
    btn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderRadius: Radius.pill,
      paddingVertical: 11,
    },
    btnOk: { backgroundColor: c.primary, borderColor: c.primary },
  });
