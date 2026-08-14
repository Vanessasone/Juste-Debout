/**
 * Primitives d'animation réutilisables — modernise & dynamise l'app.
 *  - FadeInUp      : entrée en fondu + léger glissé (avec délai pour effet cascade)
 *  - PressableScale: feedback tactile (la carte/bouton « s'enfonce » au toucher)
 *  - useCountUp    : compteur qui monte (JD Coins, points…)
 *  - Skeleton      : placeholder scintillant pendant le chargement
 * Compatible web (pas de useNativeDriver sur web pour éviter les warnings).
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
} from 'react-native';

const NATIVE = Platform.OS !== 'web';

/** Entrée en fondu + glissé. `delay` (ms) pour un effet cascade entre plusieurs éléments. */
export function FadeInUp({
  children,
  delay = 0,
  distance = 14,
  duration = 450,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const v = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    const anim = Animated.timing(v, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: NATIVE,
    });
    anim.start();
    return () => anim.stop();
  }, [v, delay, duration]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v,
          transform: [
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) },
          ],
        },
      ]}>
      {children}
    </Animated.View>
  );
}

/** Pressable qui « s'enfonce » légèrement au toucher (feedback tactile moderne). */
export function PressableScale({
  children,
  style,
  scaleTo = 0.96,
  ...rest
}: PressableProps & { children: React.ReactNode; scaleTo?: number; style?: StyleProp<ViewStyle> }) {
  const s = useMemo(() => new Animated.Value(1), []);
  const to = (t: number) =>
    Animated.spring(s, { toValue: t, useNativeDriver: NATIVE, friction: 6, tension: 220 }).start();
  return (
    <Pressable onPressIn={() => to(scaleTo)} onPressOut={() => to(1)} {...rest}>
      <Animated.View style={[style, { transform: [{ scale: s }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Compteur animé : renvoie le nombre courant qui monte de 0 → value. */
export function useCountUp(value: number, duration = 900): number {
  const [n, setN] = useState(0);
  const a = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    const id = a.addListener(({ value: cur }) => setN(Math.round(cur)));
    a.setValue(0);
    Animated.timing(a, {
      toValue: value,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => a.removeListener(id);
  }, [value, duration, a]);
  return n;
}

/** Placeholder scintillant (chargement élégant au lieu d'une roue qui tourne). */
export function Skeleton({
  height = 16,
  width = '100%',
  radius = 8,
  style,
}: {
  height?: number;
  width?: number | `${number}%`;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const o = useMemo(() => new Animated.Value(0.4), []);
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(o, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: NATIVE }),
        Animated.timing(o, { toValue: 0.4, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: NATIVE }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [o]);
  return (
    <Animated.View
      style={[
        { height, width, borderRadius: radius, backgroundColor: 'rgba(255,255,255,0.08)', opacity: o },
        style,
      ]}
    />
  );
}
