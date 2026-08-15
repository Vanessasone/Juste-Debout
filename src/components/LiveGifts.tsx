/**
 * Cadeaux LIVE — bouton 🎁, feuille d'envoi (choix du côté + catalogue), et
 * animation « premium » : le cadeau remonte en GRAND à l'écran avec le pseudo.
 * Diffusé à tous les spectateurs via le broadcast Supabase (lib/reactions → gift).
 * Regarder = soutenir son danseur.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { T } from '@/components/ui';
import { Palette, Radius, Space } from '@/constants/brand';
import { GiftBlast, openGiftBroadcast } from '@/lib/reactions';
import { useT } from '@/lib/i18n';
import { getCoinsBalance, getGifts, Gift, LOW_COINS, sendGift } from '@/lib/gifts';
import { getCurrentPassage, Passage, Side } from '@/lib/vote';

let GSEQ = 0;

/** Un cadeau qui remonte en grand (le mien ou celui d'un autre spectateur). */
function BigGift({ g, onDone }: { g: GiftBlast; onDone: () => void }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 2800, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(
      ({ finished }) => finished && onDone(),
    );
  }, [v, onDone]);
  const color = g.side === 'a' ? Palette.primary : Palette.sideFuchsia;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        bottom: 150,
        left: 20,
        opacity: v.interpolate({ inputRange: [0, 0.1, 0.75, 1], outputRange: [0, 1, 1, 0] }),
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -120] }) },
          { scale: v.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0.4, 1.2, 1] }) },
        ],
      }}>
      <View style={[styles.blast, { borderColor: color }]}>
        <Text style={{ fontSize: 40 }}>{g.emoji}</Text>
        <View>
          <T variant="label" color="#fff" numberOfLines={1}>{g.who}</T>
          <T variant="caption" color={color}>{g.name}</T>
        </View>
      </View>
    </Animated.View>
  );
}

export function LiveGifts({ channelKey, eventId, who }: { channelKey: string; eventId: string; who: string }) {
  const t = useT();
  const router = useRouter();
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [passage, setPassage] = useState<Passage | null>(null);
  const [balance, setBalance] = useState(0);
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<Side>('a');
  const [sending, setSending] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [floats, setFloats] = useState<{ id: number; g: GiftBlast }[]>([]);
  const api = useRef<{ send: (g: GiftBlast) => void; close: () => void } | null>(null);

  const spawn = useCallback((g: GiftBlast) => {
    const id = ++GSEQ;
    setFloats((f) => [...f, { id, g }].slice(-12));
  }, []);

  useEffect(() => {
    getGifts().then(setGifts).catch(() => {});
    getCoinsBalance().then(setBalance).catch(() => {});
    const a = openGiftBroadcast(channelKey, spawn);
    api.current = a;
    return () => a.close();
  }, [channelKey, spawn]);

  useEffect(() => {
    let alive = true;
    const load = () => getCurrentPassage(eventId).then((p) => alive && setPassage(p)).catch(() => {});
    load();
    const iv = setInterval(load, 4000);
    return () => { alive = false; clearInterval(iv); };
  }, [eventId]);

  const send = async (gift: Gift) => {
    setErr(null);
    if (balance < gift.cost_coins) {
      setOpen(false);
      router.push('/coins');
      return;
    }
    setSending(gift.id);
    try {
      const res = await sendGift({ giftId: gift.id, eventId, passageId: passage?.id ?? null, side });
      setBalance(res.balance);
      const blast: GiftBlast = { emoji: gift.emoji, name: gift.name, who, side };
      spawn(blast);          // chez moi tout de suite
      api.current?.send(blast); // chez tous les autres
    } catch (e: any) {
      const m = (e?.message ?? '').toLowerCase();
      if (m.includes('insufficient')) { setOpen(false); router.push('/coins'); }
      else setErr(t('gifts.sendErr'));
    } finally {
      setSending(null);
    }
  };

  if (!passage) return null; // rien à offrir sans passage en cours

  const sideColor = (s: Side) => (s === 'a' ? passage.side_a_color : passage.side_b_color);
  const sideName = (s: Side) => (s === 'a' ? passage.side_a_name : passage.side_b_name);

  return (
    <>
      {/* Cadeaux qui remontent */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {floats.map((f) => (
          <BigGift key={f.id} g={f.g} onDone={() => setFloats((cur) => cur.filter((x) => x.id !== f.id))} />
        ))}
      </View>

      {/* Bouton 🎁 (point d'alerte fuchsia si solde bas) */}
      <Pressable onPress={() => setOpen(true)} style={styles.fab} hitSlop={8}>
        <Text style={{ fontSize: 24 }}>🎁</Text>
        {balance <= LOW_COINS ? <View style={styles.lowDot} /> : null}
      </Pressable>

      {/* Feuille d'envoi */}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <T variant="h3" color="#fff">{t('gifts.title')}</T>
            <Pressable onPress={() => router.push('/coins')} style={styles.balancePill}>
              <Text style={{ fontSize: 13 }}>🪙</Text>
              <T variant="label" color={Palette.primary}>{balance.toLocaleString()}</T>
              <Ionicons name="add-circle" size={16} color={Palette.primary} />
            </Pressable>
          </View>

          {/* Relance : solde bas → inciter à recharger */}
          {balance <= LOW_COINS ? (
            <Pressable onPress={() => { setOpen(false); router.push('/coins'); }} style={styles.lowBanner}>
              <Text style={{ fontSize: 18 }}>🪙</Text>
              <T variant="small" color="#fff" style={{ flex: 1 }}>{t('gifts.low')}</T>
              <View style={styles.lowCta}>
                <T variant="caption" color="#0A0A0A" style={{ fontWeight: '800' }}>{t('gifts.recharge')}</T>
              </View>
            </Pressable>
          ) : null}

          {/* Choix du côté à soutenir */}
          <T variant="caption" color="#8A8A85" style={{ letterSpacing: 1.2, marginBottom: 8 }}>
            {t('gifts.forWho')}
          </T>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: Space.md }}>
            {(['a', 'b'] as Side[]).map((s) => (
              <Pressable
                key={s}
                onPress={() => setSide(s)}
                style={[styles.sideBtn, { borderColor: side === s ? sideColor(s) : '#2A2A2A' }]}>
                <View style={[styles.dot, { backgroundColor: sideColor(s) }]} />
                <T variant="label" color="#fff" numberOfLines={1} style={{ flex: 1 }}>{sideName(s)}</T>
                {side === s ? <Ionicons name="checkmark-circle" size={16} color={sideColor(s)} /> : null}
              </Pressable>
            ))}
          </View>

          {/* Catalogue */}
          <View style={styles.grid}>
            {gifts.map((g) => (
              <Pressable key={g.id} onPress={() => send(g)} disabled={!!sending} style={styles.giftCell}>
                {sending === g.id ? (
                  <ActivityIndicator color={Palette.primary} />
                ) : (
                  <>
                    <Text style={{ fontSize: 30 }}>{g.emoji}</Text>
                    <T variant="caption" color="#fff" numberOfLines={1} style={{ marginTop: 2 }}>{g.name}</T>
                    <View style={styles.coinRow}>
                      <Text style={{ fontSize: 10 }}>🪙</Text>
                      <T variant="caption" color={Palette.primary}>{g.cost_coins.toLocaleString()}</T>
                    </View>
                  </>
                )}
              </Pressable>
            ))}
          </View>

          {err ? <T variant="small" color={Palette.sideFuchsia} style={{ marginTop: 10 }}>{err}</T> : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  blast: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(0,0,0,0.78)', borderWidth: 1.5, borderRadius: Radius.pill,
    paddingVertical: 8, paddingHorizontal: 14, maxWidth: 260,
  },
  fab: {
    position: 'absolute', right: 16, bottom: 74,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  lowDot: {
    position: 'absolute', top: 8, right: 8, width: 11, height: 11, borderRadius: 6,
    backgroundColor: Palette.sideFuchsia, borderWidth: 1.5, borderColor: '#000',
  },
  lowBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: Space.md,
    backgroundColor: 'rgba(255,45,158,0.12)', borderWidth: 1, borderColor: Palette.sideFuchsia,
    borderRadius: Radius.md, paddingVertical: 10, paddingHorizontal: 12,
  },
  lowCta: { backgroundColor: Palette.primary, borderRadius: Radius.pill, paddingVertical: 6, paddingHorizontal: 14 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: '#0E0E0E', borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderTopWidth: 1, borderColor: '#222', padding: Space.lg, paddingBottom: Space.xxl,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Space.md },
  balancePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#151515', borderWidth: 1, borderColor: '#2A2A2A',
    borderRadius: Radius.pill, paddingVertical: 6, paddingHorizontal: 12,
  },
  sideBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: Radius.md, paddingVertical: 12, paddingHorizontal: 12, backgroundColor: '#111',
  },
  dot: { width: 11, height: 11, borderRadius: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  giftCell: {
    width: '23%', minWidth: 72, aspectRatio: 0.92,
    backgroundColor: '#151515', borderWidth: 1, borderColor: '#242424', borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center', paddingVertical: 8,
  },
  coinRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
});
