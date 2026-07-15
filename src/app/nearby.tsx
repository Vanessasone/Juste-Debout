/**
 * « Danseurs autour de toi » — géolocalisation opt-in (position approximative).
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Card, T, Tag } from '@/components/ui';
import { Palette, Radius, Space } from '@/constants/brand';
import { ThemeColors } from '@/constants/theme';
import { countryFlag } from '@/lib/countries';
import {
  disableLocationSharing,
  distanceLabel,
  enableLocationSharing,
  getLocationSharing,
  getNearbyDancers,
  NearbyDancer,
  refreshMyLocation,
} from '@/lib/geo';
import { useT } from '@/lib/i18n';
import { registerPushToken } from '@/lib/push';
import { useColors } from '@/lib/theme';

export default function Nearby() {
  const c = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [sharing, setSharing] = useState<boolean | null>(null);
  const [dancers, setDancers] = useState<NearbyDancer[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      await refreshMyLocation();
      setDancers(await getNearbyDancers(150));
    } catch {
      setDancers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      getLocationSharing().then((on) => {
        setSharing(on);
        if (on) loadList();
      });
    }, [loadList]),
  );

  async function enable() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await enableLocationSharing();
      if (!r.ok) {
        setMsg(
          r.reason === 'permission'
            ? t('nearby.permDenied')
            : r.reason === 'web'
              ? t('nearby.webOnly')
              : t('nearby.enableFail'),
        );
        return;
      }
      setSharing(true);
      registerPushToken().catch(() => {}); // propose aussi les notifs à ce moment
      await loadList();
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      await disableLocationSharing();
      setSharing(false);
      setDancers([]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={c.text} />
        </Pressable>
        <T variant="title" style={{ fontSize: 22 }}>
          {t('nearby.title')}
        </T>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: Space.lg, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}>
        {/* Carte opt-in / réglage */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={styles.pin}>
              <Ionicons name="location" size={22} color={c.black} />
            </View>
            <View style={{ flex: 1, marginLeft: Space.md }}>
              <T variant="h3">{t('nearby.near')}</T>
              <T variant="caption" color={c.textDim} style={{ marginTop: 2 }}>
                {t('nearby.approx')}
              </T>
            </View>
          </View>

          {sharing ? (
            <Pressable onPress={disable} disabled={busy} style={[styles.btnGhost, { borderColor: c.border }]}>
              <Ionicons name="pause" size={16} color={c.textDim} />
              <T variant="label" color={c.textDim} style={{ marginLeft: 8 }}>
                {busy ? '…' : t('nearby.disable')}
              </T>
            </Pressable>
          ) : (
            <Pressable onPress={enable} disabled={busy} style={styles.btnPrimary}>
              {busy ? (
                <ActivityIndicator color={c.black} />
              ) : (
                <>
                  <Ionicons name="navigate" size={16} color={c.black} />
                  <T variant="label" color={c.black} style={{ marginLeft: 8 }}>
                    {t('nearby.enable')}
                  </T>
                </>
              )}
            </Pressable>
          )}
          {msg ? (
            <T variant="caption" color={c.danger} style={{ marginTop: Space.md }}>
              {msg}
            </T>
          ) : null}
        </Card>

        {/* Résultats */}
        {sharing ? (
          loading ? (
            <ActivityIndicator color={c.accent} style={{ marginTop: Space.xl }} />
          ) : dancers.length === 0 ? (
            <T variant="small" color={c.textDim} style={{ textAlign: 'center', marginTop: Space.xl }}>
              {t('nearby.none')}
            </T>
          ) : (
            <View style={{ marginTop: Space.lg, gap: Space.md }}>
              {dancers.map((d) => {
                const name = d.alias || d.full_name || t('profile.dancer');
                const flag = countryFlag(d.country);
                return (
                  <Card key={d.id} style={styles.row} onPress={() => router.push(`/dancer/${d.id}` as never)}>
                    <Avatar name={name} uri={d.photo_url ?? undefined} color={c.accent} size={48} />
                    <View style={{ flex: 1, marginLeft: Space.md }}>
                      <T variant="h3" numberOfLines={1}>
                        {flag ? `${flag} ` : ''}
                        {name}
                      </T>
                      <T variant="caption" color={c.textMute} style={{ marginTop: 2 }}>
                        {[d.city, d.level].filter(Boolean).join(' · ') || t('profile.dancer')}
                      </T>
                      {(d.styles?.length ?? 0) > 0 ? (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                          {d.styles!.slice(0, 3).map((s) => (
                            <Tag key={s} label={s} color={c.accent} />
                          ))}
                        </View>
                      ) : null}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Ionicons name="location" size={14} color={Palette.primary} />
                      <T variant="caption" color={c.textDim} style={{ marginTop: 2 }}>
                        {distanceLabel(d.distance_km)}
                      </T>
                    </View>
                  </Card>
                );
              })}
            </View>
          )
        ) : (
          <T variant="caption" color={c.textMute} style={{ textAlign: 'center', marginTop: Space.xl }}>
            {t('nearby.cta')}
          </T>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Space.lg,
      paddingBottom: Space.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    back: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
    pin: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    row: { flexDirection: 'row', alignItems: 'center' },
    btnPrimary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primary,
      borderRadius: Radius.pill,
      paddingVertical: 13,
      marginTop: Space.lg,
    },
    btnGhost: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderRadius: Radius.pill,
      paddingVertical: 12,
      marginTop: Space.lg,
    },
  });
