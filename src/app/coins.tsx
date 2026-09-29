/**
 * Recharge JD Coins — achat de packs (MODE TEST tant que Stripe n'est pas branché).
 * 1 coin = 0,01 €. base = coins qui rémunèrent le danseur ; bonus = coins offerts.
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, PageHeader, Screen, T } from '@/components/ui';
import { Palette, Radius, Space } from '@/constants/brand';
import { ThemeColors } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { buyCoins, COIN_PACKS, CoinPack, getCoinsBalance } from '@/lib/gifts';
import { useColors } from '@/lib/theme';

export default function Coins() {
  const c = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [balance, setBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState<number | null>(null);

  useEffect(() => {
    getCoinsBalance().then(setBalance).catch(() => setBalance(0));
  }, []);

  const buy = async (pack: CoinPack) => {
    setBusy(pack.id);
    setJustAdded(null);
    try {
      const newBal = await buyCoins(pack);
      setBalance(newBal);
      setJustAdded(pack.base + pack.bonus);
    } catch {
      /* ignore */
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <PageHeader title={t('coins.title')} subtitle={t('coins.subtitle')} />

      {/* Solde */}
      <Card style={styles.balanceCard}>
        <Text style={{ fontSize: 30 }}>🪙</Text>
        <T variant="data" color={Palette.primary} style={{ fontSize: 40, marginTop: 4 }}>
          {balance === null ? '—' : balance.toLocaleString()}
        </T>
        <T variant="small" color={c.textDim}>{t('coins.balance')}</T>
        {justAdded ? (
          <View style={styles.added}>
            <Ionicons name="checkmark-circle" size={16} color={Palette.primary} />
            <T variant="small" color={Palette.primary}>+{justAdded.toLocaleString()}</T>
          </View>
        ) : null}
      </Card>

      {/* Bandeau mode test */}
      <View style={styles.testBanner}>
        <Ionicons name="flask" size={15} color="#F5A623" />
        <T variant="small" color="#F5A623" style={{ flex: 1 }}>{t('coins.testMode')}</T>
      </View>

      {/* Packs */}
      <View style={{ gap: Space.sm, marginTop: Space.md }}>
        {COIN_PACKS.map((p) => {
          const total = p.base + p.bonus;
          return (
            <Pressable key={p.id} onPress={() => buy(p)} disabled={!!busy} style={styles.pack}>
              <Text style={{ fontSize: 26 }}>🪙</Text>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <T variant="h3" color={c.text}>{total.toLocaleString()}</T>
                  {p.bonus > 0 ? (
                    <View style={styles.bonusTag}>
                      <T variant="caption" color={c.black}>+{p.bonus.toLocaleString()}</T>
                    </View>
                  ) : null}
                  {p.label ? (
                    <View style={styles.labelTag}>
                      <T variant="caption" color={Palette.sideFuchsia}>{p.label}</T>
                    </View>
                  ) : null}
                </View>
                <T variant="caption" color={c.textMute}>{t('coins.coins')}</T>
              </View>
              {busy === p.id ? (
                <ActivityIndicator color={c.black} />
              ) : (
                <View style={styles.priceBtn}>
                  <T variant="label" color={c.black}>{p.price_eur.toFixed(2)} €</T>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <T variant="caption" color={c.textMute} style={{ marginTop: Space.lg, textAlign: 'center' }}>
        {t('coins.foot')}
      </T>
    </Screen>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  balanceCard: { alignItems: 'center', paddingVertical: Space.xl, borderColor: c.border },
  added: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  testBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Space.md,
    backgroundColor: 'rgba(245,166,35,0.10)', borderWidth: 1, borderColor: 'rgba(245,166,35,0.4)',
    borderRadius: Radius.md, padding: 12,
  },
  pack: {
    flexDirection: 'row', alignItems: 'center', gap: Space.md,
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: Radius.lg,
    padding: Space.lg,
  },
  bonusTag: { backgroundColor: Palette.primary, borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  labelTag: { borderWidth: 1, borderColor: Palette.sideFuchsia, borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  priceBtn: { backgroundColor: c.primary, borderRadius: Radius.pill, paddingVertical: 10, paddingHorizontal: 18, minWidth: 78, alignItems: 'center' },
});
