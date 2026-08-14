/**
 * Réactions LIVE — la barre d'emoji + les emoji qui remontent (les tiens ET ceux
 * des autres spectateurs, en temps réel). Transforme le direct en foule vivante.
 * S'appuie sur le broadcast Supabase (voir lib/reactions).
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius } from '@/constants/brand';
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
        bottom: 66,
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

  const spawn = (kind: string) => {
    const id = ++SEQ;
    const x = 16 + Math.round(Math.random() * 250);
    const drift = (Math.random() - 0.5) * 60;
    setFloaters((f) => [...f, { id, kind, x, drift }].slice(-28));
  };

  useEffect(() => {
    const a = openReactions(channelKey, spawn);
    api.current = a;
    return () => a.close();
  }, [channelKey]);

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
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 320 },
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
