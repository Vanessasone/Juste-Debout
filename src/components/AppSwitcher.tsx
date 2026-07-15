/**
 * Bascule entre l'app Juste Debout (événement) et l'espace Juste Debout School.
 * Effet « deux applications » avec une session/compte partagés.
 */
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { T } from '@/components/ui';
import { Radius, Space } from '@/constants/brand';
import { ThemeColors } from '@/constants/theme';
import { openSchoolApp } from '@/lib/school';
import { useColors } from '@/lib/theme';

export function AppSwitcher({ current }: { current: 'jd' | 'school' }) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();

  const renderSeg = (id: 'jd' | 'school', label: string) => {
    const active = current === id;
    const go = () => {
      if (active) return;
      // « Juste Debout » = app événement (interne) ; « JD School » = ouvre la vraie app School
      // avec transfert de session (SSO) via un fragment d'URL.
      if (id === 'jd') router.replace('/(tabs)');
      else openSchoolApp();
    };
    return (
      <Pressable key={id} onPress={go} style={[styles.seg, active && styles.segActive]} disabled={active}>
        <T variant="label" color={active ? c.black : c.textDim}>
          {label}
        </T>
      </Pressable>
    );
  };

  return (
    <View style={styles.wrap}>
      {renderSeg('jd', 'Juste Debout')}
      {renderSeg('school', 'JD School')}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      backgroundColor: c.surface,
      borderRadius: Radius.pill,
      padding: 4,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: Space.md,
    },
    seg: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: Radius.pill },
    segActive: { backgroundColor: c.primary },
  });
