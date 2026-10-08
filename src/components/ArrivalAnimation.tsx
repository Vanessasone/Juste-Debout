import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, StyleSheet, View } from 'react-native';
import { useSegments } from 'expo-router';
import { Vitruve, Wordmark } from '@/components/Logo';

export function ArrivalAnimation() {
  const segments = useSegments();
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.88)).current;
  const bypass = ['ticket-success', 'ticket-cancel', 'shop-success', 'auth-callback', 'claim-ticket', 'scanner'].includes(segments[0]);
  useEffect(() => {
    if (bypass) return;
    let disposed = false;
    let animation: Animated.CompositeAnimation | undefined;
    void AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (disposed || reduced) return;
      if (Platform.OS === 'web') {
        try {
          if (sessionStorage.getItem('jd_arrival_seen_v1')) return;
          sessionStorage.setItem('jd_arrival_seen_v1', '1');
        } catch { /* animation remains limited to this app load */ }
      }
      setVisible(true);
      animation = Animated.sequence([
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
        Animated.delay(350),
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]);
      animation.start(() => { if (!disposed) setVisible(false); });
    }).catch(() => {});
    return () => { disposed = true; animation?.stop(); };
  }, [bypass, opacity, scale]);
  if (!visible || bypass) return null;
  return <Animated.View pointerEvents="none" accessible={false} style={[styles.overlay, { opacity }]}>
    <Animated.View style={{ alignItems: 'center', gap: 28, transform: [{ scale }] }}>
      <Vitruve size={140} color="#B5FA42" />
      <Wordmark height={58} color="#FFFFFF" />
      <View style={styles.line} />
    </Animated.View>
  </Animated.View>;
}
const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 9999, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center' },
  line: { width: 44, height: 2, backgroundColor: '#B5FA42' },
});
