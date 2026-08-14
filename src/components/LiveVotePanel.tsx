/**
 * Vote intégré au visionnage — le spectateur vote pour son favori du passage EN COURS,
 * sans quitter la vidéo. Baromètre du public en direct. Regarder = participer.
 */
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

  if (!passage || passage.status !== 'open') return null;

  const vote = async (side: Side) => {
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

  const Side_ = ({ side, name, color, pct }: { side: Side; name: string; color: string; pct: number }) => {
    const on = mine === side;
    return (
      <Pressable onPress={() => vote(side)} style={[styles.side, { borderColor: on ? color : '#2A2A2A' }]}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color, opacity: on ? 0.28 : 0.14 }]} />
        <View style={styles.sideRow}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <T variant="label" color="#fff" numberOfLines={1} style={{ flex: 1 }}>
            {name}
          </T>
          <T variant="label" color={color}>
            {pct}%
          </T>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.wrap}>
      <T variant="caption" color="#8A8A85" style={{ letterSpacing: 1.4, marginBottom: 8 }}>
        {t('watch.whoWins')} · {t('watch.publicVotes', { n: tally.total })}
      </T>
      <View style={{ gap: 8 }}>
        <Side_ side="a" name={passage.side_a_name} color={passage.side_a_color} pct={pa} />
        <Side_ side="b" name={passage.side_b_name} color={passage.side_b_color} pct={pb} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: Space.lg, marginTop: Space.md },
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
