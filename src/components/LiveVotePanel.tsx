/**
 * Bloc « Passage en cours » — TOUJOURS visible pendant le direct (qui affronte qui).
 * Le vote du public se greffe uniquement quand le passage est ouvert ;
 * une fois clos/révélé, le passage reste affiché (et le vainqueur est mis en avant).
 * Regarder = participer, sans jamais perdre de vue le passage.
 */
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { T } from '@/components/ui';
import { Radius, Space } from '@/constants/brand';
import { useT } from '@/lib/i18n';
import {
  castPublicVote,
  getCurrentPassage,
  getMyPublicVote,
  getPublicTally,
  Passage,
  Side,
} from '@/lib/vote';

export function LiveVotePanel({ eventId }: { eventId: string }) {
  const t = useT();
  const [passage, setPassage] = useState<Passage | null>(null);
  const [tally, setTally] = useState({ a: 0, b: 0, total: 0 });
  const [mine, setMine] = useState<Side | null>(null);

  const load = useCallback(async () => {
    try {
      const p = await getCurrentPassage(eventId);
      setPassage(p);
      if (p) {
        const [tl, mv] = await Promise.all([getPublicTally(p.id), getMyPublicVote(p.id)]);
        setTally(tl);
        setMine(mv?.choice ?? null);
      }
    } catch {
      /* ignore */
    }
  }, [eventId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 3000);
    return () => clearInterval(iv);
  }, [load]);

  if (!passage) return null;

  const open = passage.status === 'open';
  const revealed = passage.status === 'revealed';
  const winner = passage.winner === 'a' || passage.winner === 'b' ? passage.winner : null;

  const vote = async (side: Side) => {
    if (!open) return;
    setMine(side);
    try {
      await castPublicVote(passage.id, side);
      setTally(await getPublicTally(passage.id));
    } catch {
      /* la RLS refuse si le passage n'est plus ouvert */
    }
  };

  const total = Math.max(1, tally.total);
  const pa = Math.round((tally.a / total) * 100);
  const pb = 100 - pa;
  const showBars = tally.total > 0; // barres dès qu'il y a des votes (aussi après révélation)

  const label = revealed ? t('watch.result') : open ? t('watch.whoWins') : t('watch.voteClosing');

  const SideRow = ({ side, name, color, pct }: { side: Side; name: string; color: string; pct: number }) => {
    const on = mine === side;
    const won = revealed && winner === side;
    const dim = revealed && winner && winner !== side;
    return (
      <Pressable
        onPress={() => vote(side)}
        disabled={!open}
        style={[
          styles.side,
          { borderColor: won ? color : on && open ? color : '#2A2A2A', opacity: dim ? 0.5 : 1 },
        ]}>
        {showBars ? (
          <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color, opacity: on ? 0.28 : 0.14 }]} />
        ) : null}
        <View style={styles.sideRow}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <T variant="label" color="#fff" numberOfLines={1} style={{ flex: 1 }}>
            {name}
          </T>
          {won ? <Ionicons name="trophy" size={15} color={color} /> : null}
          {showBars ? (
            <T variant="label" color={color}>
              {pct}%
            </T>
          ) : null}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={[styles.badge, { backgroundColor: open ? '#A4FA00' : '#2A2A2A' }]}>
          <T variant="caption" color={open ? '#0A0A0A' : '#8A8A85'} style={styles.badgeTxt}>
            {t('watch.passageNow')}
          </T>
        </View>
        {passage.round ? (
          <T variant="caption" color="#8A8A85" style={{ letterSpacing: 1 }}>
            {passage.round}
          </T>
        ) : null}
        <View style={{ flex: 1 }} />
        <T variant="caption" color="#8A8A85" style={{ letterSpacing: 1 }}>
          {label}
          {showBars ? ` · ${t('watch.publicVotes', { n: tally.total })}` : ''}
        </T>
      </View>
      <View style={{ gap: 8 }}>
        <SideRow side="a" name={passage.side_a_name} color={passage.side_a_color} pct={pa} />
        <SideRow side="b" name={passage.side_b_name} color={passage.side_b_color} pct={pb} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: Space.lg, marginTop: Space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  badge: { borderRadius: Radius.pill, paddingVertical: 3, paddingHorizontal: 9 },
  badgeTxt: { fontWeight: '800', letterSpacing: 1, fontSize: 9 },
  side: {
    borderWidth: 1,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  sideRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 14 },
  dot: { width: 12, height: 12, borderRadius: 6 },
});
