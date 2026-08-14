/**
 * Réactions LIVE + jauge d'énergie de la foule.
 * - Emoji qui remontent (les tiens ET ceux des autres spectateurs, temps réel).
 * - Jauge d'énergie : chauffe quand la foule réagit fort, redescend au calme.
 * S'appuie sur le broadcast Supabase (lib/reactions) → scalable à des centaines de milliers de viewers.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { Palette, Radius } from '@/constants/brand';
import { openReactions, REACTIONS } from '@/lib/reactions';

let SEQ = 0;

function Floater({ kind, x, drift, onDone }: { kind: string; x: number; drift: number; onDone: () => void }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 2300, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(
      ({ finished }) => finished && onDone(),
    );
  }, [v, onDone]);
  return (
    <Animated.Text
      style={{
        position: 'absolute',
        bottom: 92,
        left: x,
        fontSize: 30,
        opacity: v.interpolate({ inputRange: [0, 0.12, 0.8, 1], outputRange: [0, 1, 1, 0] }),
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -250] }) },
          { translateX: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, drift, 0] }) },
          { scale: v.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.6, 1.15, 0.9] }) },
        ],
      }}>
      {kind}
    </Animated.Text>
  );
}

export function LiveReactions({ channelKey }: { channelKey: string }) {
  const [floaters, setFloaters] = useState<{ id: number; kind: string; x: number; drift: number }[]>([]);
  const api = useRef<{ send: (k: string) => void; close: () => void } | null>(null);
  const heat = useRef(0);
  const energy = useMemo(() => new Animated.Value(0), []);
  const [level, setLevel] = useState(0);

  const spawn = (kind: string) => {
    const id = ++SEQ;
    const x = 16 + Math.round(Math.random() * 250);
    const drift = (Math.random() - 0.5) * 60;
    heat.current = Math.min(16, heat.current + 1);
    setFloaters((f) => [...f, { id, kind, x, drift }].slice(-28));
  };

  useEffect(() => {
    const a = openReactions(channelKey, spawn);
    api.current = a;
    return () => a.close();
  }, [channelKey]);

  // Décroissance de l'énergie + animation de la jauge.
  useEffect(() => {
    const iv = setInterval(() => {
      heat.current *= 0.82;
      const e = Math.min(1, heat.current / 11);
      setLevel(e);
      Animated.timing(energy, { toValue: e, duration: 420, useNativeDriver: false }).start();
    }, 450);
    return () => clearInterval(iv);
  }, [energy]);

  const react = (kind: string) => {
    spawn(kind);
    api.current?.send(kind);
  };

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      {floaters.map((f) => (
        <Floater
          key={f.id}
          kind={f.kind}
          x={f.x}
          drift={f.drift}
          onDone={() => setFloaters((cur) => cur.filter((c) => c.id !== f.id))}
        />
      ))}

      {/* Jauge d'énergie de la foule */}
      <View style={styles.energyWrap}>
        <Text style={styles.energyLabel}>{level > 0.66 ? '🔥 ÇA CHAUFFE' : '⚡ ÉNERGIE'}</Text>
        <View style={styles.energyTrack}>
          <Animated.View
            style={{ height: '100%', borderRadius: 4, width: energy.interpolate({ inputRange: [0, 1], outputRange: ['4%', '100%'] }) }}>
            <LinearGradient
              colors={[Palette.primary, Palette.sideFuchsia]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flex: 1, borderRadius: 4 }}
            />
          </Animated.View>
        </View>
      </View>

      <View style={styles.bar}>
        {REACTIONS.map((r) => (
          <Pressable key={r} onPress={() => react(r)} style={styles.btn} hitSlop={6}>
            <Text style={{ fontSize: 24 }}>{r}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 340 },
  energyWrap: { position: 'absolute', bottom: 66, left: 16, right: 16 },
  energyLabel: { color: '#fff', fontSize: 9, letterSpacing: 1.4, fontWeight: '800', marginBottom: 5, fontFamily: 'Ticketing' },
  energyTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  bar: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: Radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  btn: { paddingHorizontal: 8, paddingVertical: 6 },
});
