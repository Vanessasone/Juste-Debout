/**
 * Écran LIVE du bracket — l'arbre complet qui se remplit en direct (écrans de la salle).
 * Lecture seule, auto-actualisé. Le match en cours est mis en avant, les gagnants surlignés.
 */
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Wordmark } from '@/components/Logo';
import { T } from '@/components/ui';
import { Palette, Radius, Space } from '@/constants/brand';
import { useT } from '@/lib/i18n';
import { Category, getEventCategories } from '@/lib/jdlive';
import { flagEmoji, getBracketPassages, Passage } from '@/lib/vote';

export default function BracketLive() {
  const t = useT();
  const params = useLocalSearchParams<{ bracketId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [passages, setPassages] = useState<Passage[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!params.bracketId) return;
    const tick = async () => {
      const ps = await getBracketPassages(params.bracketId!).catch(() => []);
      setPassages(ps);
      if (ps.length && !cats.length) {
        getEventCategories(ps[0].event_id).then(setCats).catch(() => {});
      }
    };
    tick();
    timer.current = setInterval(tick, 3000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.bracketId]);

  const rounds = groupByRound(passages, t);
  const discipline = passages.length ? cats.find((c) => c.id === passages[0].category_id)?.name ?? '' : '';
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  return (
    <View style={[styles.root, { paddingTop: insets.top + Space.md, paddingBottom: insets.bottom + Space.md }]}>
      <View style={styles.top}>
        <Pressable onPress={goBack} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={Palette.text} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Wordmark height={22} color={Palette.white} />
        </View>
        <T variant="caption" color={Palette.primary} style={{ width: 90, textAlign: 'right' }}>
          {discipline}
        </T>
      </View>

      {passages.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="git-network" size={48} color={Palette.textMute} />
          <T variant="h2" color={Palette.textDim} style={{ marginTop: Space.lg }}>
            {t('br.empty')}
          </T>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingTop: Space.lg }}>
          <View style={{ flexDirection: 'row', gap: Space.lg, alignItems: 'center' }}>
            {rounds.map((col) => (
              <View key={col.round} style={{ width: 240, gap: Space.md }}>
                <T variant="h3" color={Palette.primary} style={{ textAlign: 'center' }}>
                  {col.label}
                </T>
                <View style={{ flex: 1, justifyContent: 'space-around', gap: Space.md }}>
                  {col.matches.map((p) => (
                    <LiveMatch key={p.id} p={p} />
                  ))}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function LiveMatch({ p }: { p: Passage }) {
  const t = useT();
  const live = p.status === 'open' || p.status === 'locked';
  return (
    <View style={[styles.match, live && { borderColor: Palette.primary, borderWidth: 2 }]}>
      {live && (
        <View style={styles.liveTag}>
          <View style={styles.liveDot} />
          <T variant="caption" color={Palette.black}>
            {t('br.inProgress')}
          </T>
        </View>
      )}
      <TeamRow name={p.side_a_name} country={p.side_a_country} color={p.side_a_color} win={p.winner === 'a'} lose={p.status === 'revealed' && p.winner === 'b'} />
      <View style={styles.vsLine}>
        <T variant="caption" color={Palette.textMute}>
          VS
        </T>
      </View>
      <TeamRow name={p.side_b_name} country={p.side_b_country} color={p.side_b_color} win={p.winner === 'b'} lose={p.status === 'revealed' && p.winner === 'a'} />
    </View>
  );
}

function TeamRow({ name, country, color, win, lose }: { name: string; country: string | null; color: string; win: boolean; lose: boolean }) {
  const flag = flagEmoji(country);
  return (
    <View style={[styles.teamRow, win && { backgroundColor: color }, lose && { opacity: 0.35 }]}>
      {!win && <View style={[styles.dot, { backgroundColor: color }]} />}
      {win && <Ionicons name="trophy" size={14} color={Palette.black} style={{ marginRight: 6 }} />}
      <T
        variant="h3"
        color={win ? Palette.black : Palette.white}
        numberOfLines={1}
        style={{ flex: 1, fontSize: 15 }}>
        {flag ? `${flag} ` : ''}
        {name}
      </T>
    </View>
  );
}

function groupByRound(passages: Passage[], t: (k: string, o?: Record<string, unknown>) => string) {
  const byRound = new Map<number, Passage[]>();
  passages.forEach((p) => {
    const r = p.round_no ?? 0;
    if (!byRound.has(r)) byRound.set(r, []);
    byRound.get(r)!.push(p);
  });
  return [...byRound.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([round, matches]) => ({
      round,
      label: matches[0]?.round ?? t('br.roundN', { n: round }),
      matches: matches.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    }));
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.bg, paddingHorizontal: Space.lg },
  top: { flexDirection: 'row', alignItems: 'center' },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  match: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.lg,
    padding: Space.md,
    position: 'relative',
  },
  liveTag: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.primary,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
    marginBottom: Space.sm,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Palette.black, marginRight: 5 },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: Radius.sm,
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  vsLine: { alignItems: 'center', paddingVertical: 2 },
});
