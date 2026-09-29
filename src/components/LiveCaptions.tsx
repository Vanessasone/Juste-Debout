/**
 * Légendes live (CC) — le commentaire écrit du commentateur, affiché en surimpression
 * sous la vidéo, DANS LA LANGUE du spectateur (traduction auto), activable/désactivable.
 * Le commentaire principal reste l'AUDIO ; ceci sert au son coupé / autre langue / accessibilité.
 */
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { T } from '@/components/ui';
import { Radius, Space } from '@/constants/brand';
import { useI18n } from '@/lib/i18n';
import { captionFor, Commentary, getCommentaries, subscribeCommentaries } from '@/lib/livemedia';

export function LiveCaptions({ eventId }: { eventId: string }) {
  const { locale, t } = useI18n();
  const [on, setOn] = useState(true);
  const [last, setLast] = useState<Commentary | null>(null);
  const fade = useRef(new Animated.Value(0)).current;

  // Charge la dernière légende + s'abonne aux nouvelles.
  useEffect(() => {
    let alive = true;
    getCommentaries(eventId, 1)
      .then((rows) => alive && rows.length && setLast(rows[rows.length - 1]))
      .catch(() => {});
    const unsub = subscribeCommentaries(eventId, (c) => alive && setLast(c));
    return () => {
      alive = false;
      unsub();
    };
  }, [eventId]);

  // Fondu à chaque nouvelle ligne.
  useEffect(() => {
    if (!on || !last) return;
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [last, on, fade]);

  const toggle = useCallback(() => setOn((v) => !v), []);

  const line = last ? captionFor(last, locale) : '';

  return (
    <View style={styles.wrap}>
      {on && line ? (
        <Animated.View style={[styles.band, { opacity: fade }]}>
          <T variant="small" color="#fff" style={styles.caption}>
            {line}
          </T>
        </Animated.View>
      ) : null}

      <Pressable onPress={toggle} hitSlop={8} style={[styles.cc, on ? styles.ccOn : styles.ccOff]}>
        <Ionicons name="text" size={12} color={on ? '#0A0A0A' : '#fff'} />
        <T variant="caption" color={on ? '#0A0A0A' : '#fff'} style={styles.ccTxt}>
          {t('watch.cc')}
        </T>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: Space.lg, marginTop: Space.sm, alignItems: 'center', gap: 8 },
  band: {
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: Radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 14,
    maxWidth: 640,
  },
  caption: { textAlign: 'center', lineHeight: 20, fontStyle: 'italic' },
  cc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  ccOn: { backgroundColor: '#A4FA00', borderColor: '#A4FA00' },
  ccOff: { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.4)' },
  ccTxt: { fontWeight: '800', letterSpacing: 1, fontSize: 10 },
});
