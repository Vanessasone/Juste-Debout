/**
 * Cérémonie d'accueil — présentée UNE SEULE FOIS, à la première connexion.
 * « Aujourd'hui, tu n'as pas simplement créé un compte… » — accueil signé Flow.
 * Le drapeau WELCOME_FLAG (AsyncStorage) évite de la rejouer.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Vitruve, Wordmark } from '@/components/Logo';
import { T } from '@/components/ui';
import { Palette, Radius, Space } from '@/constants/brand';
import { useT } from '@/lib/i18n';

export const WELCOME_FLAG = 'jd_welcomed';

export default function Welcome() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fade = useMemo(() => new Animated.Value(0), []);
  const rise = useMemo(() => new Animated.Value(16), []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 1100, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 1100, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();
  }, [fade, rise]);

  const enter = async () => {
    await AsyncStorage.setItem(WELCOME_FLAG, '1').catch(() => {});
    router.replace('/(tabs)');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }], alignItems: 'center' }}>
          <Vitruve size={78} color={Palette.primary} />
          <View style={{ marginTop: Space.lg }}>
            <Wordmark height={28} color={Palette.white} />
          </View>

          <T variant="title" color={Palette.white} style={styles.hello}>
            {t('welcome.hello')}
          </T>

          <T variant="body" color={Palette.textDim} style={styles.body}>
            {t('welcome.body')}
          </T>

          <T variant="h3" color={Palette.primary} style={styles.signature}>
            {t('welcome.signature')}
          </T>

          <T variant="caption" color={Palette.textMute} style={styles.by}>
            {t('welcome.by')}
          </T>
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Space.lg }]}>
        <Pressable onPress={enter} style={styles.cta}>
          <T variant="label" color={Palette.black} style={{ fontSize: 15 }}>
            {t('welcome.enter')}
          </T>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.black },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: Space.xl, paddingVertical: Space.xxxl },
  hello: { marginTop: Space.xxxl, fontSize: 42, textAlign: 'center' },
  body: { marginTop: Space.xl, textAlign: 'center', lineHeight: 25 },
  signature: { marginTop: Space.xl, textAlign: 'center' },
  by: { marginTop: Space.md, textAlign: 'center', letterSpacing: 0.5 },
  footer: { paddingHorizontal: Space.xl, paddingTop: Space.md },
  cta: {
    backgroundColor: Palette.primary,
    borderRadius: Radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
});
