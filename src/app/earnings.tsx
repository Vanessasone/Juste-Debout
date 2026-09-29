/**
 * Gains cadeaux — visibilité pour le DANSEUR (ses gains) et l'ADMIN (totaux + par danseur).
 * Part danseur = 50 % de la valeur cash des cadeaux reçus (1 coin cash = 0,01 €).
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Card, PageHeader, Screen, Section, T } from '@/components/ui';
import { Palette, Radius, Space } from '@/constants/brand';
import { ThemeColors } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import {
  AdminGiftStats,
  DancerEarningRow,
  getAdminDancerEarnings,
  getAdminGiftStats,
  getMyEarnings,
  MyEarnings,
} from '@/lib/gifts';
import { useColors } from '@/lib/theme';

export default function Earnings() {
  const c = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [mine, setMine] = useState<MyEarnings | null>(null);
  const [stats, setStats] = useState<AdminGiftStats | null>(null);
  const [rows, setRows] = useState<DancerEarningRow[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setMine(await getMyEarnings());
      } catch { /* ignore */ }
      // Les fonctions admin lèvent 'forbidden' pour les non-admins → on ignore.
      try {
        const [s, r] = await Promise.all([getAdminGiftStats(), getAdminDancerEarnings()]);
        setStats(s);
        setRows(r);
        setIsAdmin(true);
      } catch { /* pas admin */ }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <Screen scroll={false}>
        <PageHeader title={t('earn.title')} subtitle="Juste Debout" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={c.accent} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader title={t('earn.title')} subtitle={t('earn.subtitle')} />

      {/* Mes gains (danseur) */}
      <Card style={styles.hero}>
        <T variant="caption" color={c.textDim} style={{ letterSpacing: 1.2 }}>{t('earn.myEarnings')}</T>
        <T variant="data" color={Palette.primary} style={{ fontSize: 44, marginTop: 4 }}>
          {(mine?.earnings_eur ?? 0).toFixed(2)} €
        </T>
        <View style={styles.metaRow}>
          <Meta c={c} icon="gift" label={t('earn.received')} value={String(mine?.gifts_received ?? 0)} />
          <Meta c={c} icon="cash" label={t('earn.cashCoins')} value={Math.round(mine?.cash_coins ?? 0).toLocaleString()} />
        </View>
        <T variant="caption" color={c.textMute} style={{ marginTop: Space.md, textAlign: 'center' }}>
          {t('earn.payoutNote')}
        </T>
      </Card>

      {/* Vue admin */}
      {isAdmin && stats ? (
        <>
          <Section title={t('earn.adminTotals')}>
            <View style={styles.statGrid}>
              <Stat c={c} label={t('earn.gross')} value={`${stats.gross_eur.toFixed(2)} €`} strong />
              <Stat c={c} label={t('earn.dancersShare')} value={`${stats.dancers_eur.toFixed(2)} €`} color={Palette.sideFuchsia} />
              <Stat c={c} label={t('earn.jdShare')} value={`${stats.jd_eur.toFixed(2)} €`} color={Palette.primary} />
              <Stat c={c} label={t('earn.giftsCount')} value={String(stats.total_gifts)} />
            </View>
          </Section>

          <Section title={t('earn.byDancer')}>
            {rows.length === 0 ? (
              <T variant="small" color={c.textMute}>{t('earn.none')}</T>
            ) : (
              rows.map((r) => (
                <View key={r.profile_id} style={styles.rowItem}>
                  <View style={{ flex: 1 }}>
                    <T variant="label" color={c.text} numberOfLines={1}>{r.dancer}</T>
                    <T variant="caption" color={c.textMute}>{r.gifts_received} {t('earn.gifts')}</T>
                  </View>
                  <T variant="h3" color={Palette.primary}>{r.earnings_eur.toFixed(2)} €</T>
                </View>
              ))
            )}
          </Section>
        </>
      ) : null}
    </Screen>
  );
}

function Meta({ c, icon, label, value }: { c: ThemeColors; icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Ionicons name={icon} size={16} color={c.textDim} />
      <T variant="h3" color={c.text} style={{ marginTop: 4 }}>{value}</T>
      <T variant="caption" color={c.textMute}>{label}</T>
    </View>
  );
}

function Stat({ c, label, value, color, strong }: { c: ThemeColors; label: string; value: string; color?: string; strong?: boolean }) {
  return (
    <View style={[styleStat.cell, { borderColor: c.border, backgroundColor: c.surface }]}>
      <T variant={strong ? 'h2' : 'h3'} color={color ?? c.text}>{value}</T>
      <T variant="caption" color={c.textMute} style={{ marginTop: 2 }}>{label}</T>
    </View>
  );
}

const styleStat = StyleSheet.create({
  cell: { width: '48%', borderWidth: 1, borderRadius: Radius.md, padding: Space.md },
});

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: Space.xl, borderColor: c.border },
  metaRow: { flexDirection: 'row', marginTop: Space.lg, alignSelf: 'stretch' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: Space.sm },
  rowItem: {
    flexDirection: 'row', alignItems: 'center', gap: Space.md,
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: Radius.md,
    padding: Space.md, marginBottom: Space.sm,
  },
});
