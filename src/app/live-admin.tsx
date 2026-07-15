/**
 * Console direct (staff) — créer un direct, coller l'URL HLS (Bunny), passer à l'antenne / couper.
 * Le broadcast vidéo se fait via encodeur externe (OBS / Larix) vers l'ingest RTMP de Bunny.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Card, PageHeader, Screen, Section, T } from '@/components/ui';
import { Radius, Space } from '@/constants/brand';
import { ThemeColors } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { createStream, endLive, getStreams, goLive, LiveStream, setPlaybackUrl } from '@/lib/streaming';
import { useColors } from '@/lib/theme';

export default function LiveAdmin() {
  const c = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    getStreams()
      .then(setStreams)
      .catch(() => setStreams([]))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => load(), [load]));

  async function create() {
    if (busy) return;
    setBusy(true);
    try {
      await createStream({ title: title.trim() || 'Direct Juste Debout', playback_url: url.trim() || null });
      setTitle('');
      setUrl('');
      load();
    } finally {
      setBusy(false);
    }
  }

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <PageHeader title={t('la.title')} subtitle={t('la.subtitle')} />

      <Card style={{ marginBottom: Space.md, backgroundColor: c.surface }}>
        <T variant="caption" color={c.textDim}>
          {t('la.howto1')}
          {'\n'}
          {t('la.howto2')}
        </T>
      </Card>

      <Section title={t('la.newLive')}>
        <Card>
          <T variant="caption" color={c.textMute} style={{ marginBottom: 6 }}>
            {t('la.titleField')}
          </T>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t('la.titlePh')}
            placeholderTextColor={c.textMute}
            style={styles.input}
          />
          <T variant="caption" color={c.textMute} style={{ marginTop: Space.md, marginBottom: 6 }}>
            {t('la.hlsField')}
          </T>
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="https://vz-xxxx.b-cdn.net/…/playlist.m3u8"
            placeholderTextColor={c.textMute}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
          <Pressable onPress={create} disabled={busy} style={[styles.cta, busy && { opacity: 0.5 }]}>
            {busy ? <ActivityIndicator color={c.black} /> : <T variant="label" color={c.black}>{t('la.create')}</T>}
          </Pressable>
        </Card>
      </Section>

      <Section title={t('la.list')}>
        {loading ? (
          <ActivityIndicator color={c.accent} style={{ marginTop: Space.lg }} />
        ) : streams.length === 0 ? (
          <T variant="small" color={c.textDim}>{t('la.none')}</T>
        ) : (
          streams.map((s) => {
            const live = s.status === 'live';
            const draft = drafts[s.id] ?? s.playback_url ?? '';
            return (
              <Card key={s.id} style={{ marginBottom: Space.md, borderColor: live ? c.danger : c.border }}>
                <View style={styles.rowBetween}>
                  <T variant="h3" style={{ flex: 1 }} numberOfLines={1}>
                    {s.title}
                  </T>
                  <View style={[styles.badge, { backgroundColor: live ? c.danger : c.surface2 }]}>
                    <T variant="caption" color={live ? '#fff' : c.textDim} style={{ fontWeight: '700', fontSize: 10, letterSpacing: 1 }}>
                      {live ? t('la.statusLive') : s.status === 'ended' ? t('la.statusEnded') : t('la.statusReady')}
                    </T>
                  </View>
                </View>

                <TextInput
                  value={draft}
                  onChangeText={(v) => setDrafts((d) => ({ ...d, [s.id]: v }))}
                  placeholder={t('la.hlsField')}
                  placeholderTextColor={c.textMute}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.input, { marginTop: Space.md }]}
                />
                <View style={{ flexDirection: 'row', gap: Space.sm, marginTop: Space.md }}>
                  <Pressable onPress={() => act(() => setPlaybackUrl(s.id, draft))} disabled={busy} style={[styles.smallBtn, { borderColor: c.border }]}>
                    <Ionicons name="save" size={15} color={c.text} />
                    <T variant="label" color={c.text} style={{ marginLeft: 6 }}>URL</T>
                  </Pressable>
                  {live ? (
                    <Pressable onPress={() => act(() => endLive(s.id))} disabled={busy} style={[styles.smallBtn, { borderColor: c.danger }]}>
                      <Ionicons name="stop" size={15} color={c.danger} />
                      <T variant="label" color={c.danger} style={{ marginLeft: 6 }}>{t('la.cut')}</T>
                    </Pressable>
                  ) : (
                    <Pressable onPress={() => act(() => goLive(s.id))} disabled={busy || !draft} style={[styles.smallBtn, styles.goLive, !draft && { opacity: 0.4 }]}>
                      <Ionicons name="radio" size={15} color={c.black} />
                      <T variant="label" color={c.black} style={{ marginLeft: 6 }}>{t('la.onAir')}</T>
                    </Pressable>
                  )}
                </View>
              </Card>
            );
          })
        )}
      </Section>
    </Screen>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    input: {
      backgroundColor: c.surface2,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: Radius.md,
      paddingHorizontal: 12,
      paddingVertical: 11,
      color: c.text,
      fontSize: 14,
    },
    cta: {
      backgroundColor: c.primary,
      borderRadius: Radius.pill,
      paddingVertical: 13,
      alignItems: 'center',
      marginTop: Space.lg,
      minHeight: 46,
      justifyContent: 'center',
    },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    badge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, marginLeft: 8 },
    smallBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderRadius: Radius.pill,
      paddingVertical: 10,
    },
    goLive: { backgroundColor: c.primary, borderColor: c.primary },
  });
