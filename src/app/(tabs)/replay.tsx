/**
 * Replay — galerie des vidéos YouTube de la chaîne Juste Debout.
 * Tap sur une vidéo → ouverture dans YouTube. Ajout de vidéos réservé à l'admin.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppHeader, Card, Screen, Section, T, Tag } from '@/components/ui';
import { Radius, Space } from '@/constants/brand';
import { ThemeColors } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { getMyProfile } from '@/lib/profile';
import { useColors } from '@/lib/theme';
import { addVideo, getVideos, Video, youtubeThumb } from '@/lib/videos';

export default function Replay() {
  const c = useColors();
  const router = useRouter();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Formulaire admin
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => getVideos().then(setVideos).catch(() => setVideos([])).finally(() => setLoading(false));

  useFocusEffect(
    useCallback(() => {
      load();
      getMyProfile()
        .then((p) => setIsAdmin(!!p?.roles?.some((r) => ['admin', 'organizer', 'staff'].includes(r))))
        .catch(() => {});
    }, []),
  );

  const submit = async () => {
    setAdding(true);
    setError(null);
    try {
      await addVideo({ url, title, discipline: discipline.trim() || null });
      setUrl('');
      setTitle('');
      setDiscipline('');
      load();
    } catch (e: any) {
      setError(e?.message ?? t('replay.addFail'));
    } finally {
      setAdding(false);
    }
  };

  return (
    <Screen>
      <AppHeader title={t('replay.title')} subtitle={t('replay.subtitle')} />

      {isAdmin && (
        <Card style={{ marginBottom: Space.md }}>
          <T variant="caption" color={c.textMute}>
            {t('replay.addVideo')}
          </T>
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="https://youtube.com/watch?v=…"
            placeholderTextColor={c.textMute}
            autoCapitalize="none"
            style={styles.input}
          />
          <View style={{ flexDirection: 'row', gap: Space.sm, marginTop: Space.sm }}>
            <TextInput value={title} onChangeText={setTitle} placeholder={t('replay.titlePh')} placeholderTextColor={c.textMute} style={[styles.input, { flex: 2 }]} />
            <TextInput value={discipline} onChangeText={setDiscipline} placeholder={t('replay.disciplinePh')} placeholderTextColor={c.textMute} style={[styles.input, { flex: 1 }]} />
          </View>
          {error && (
            <T variant="small" color={c.danger} style={{ marginTop: Space.sm }}>
              {error}
            </T>
          )}
          <Pressable onPress={submit} disabled={adding || !url.trim() || !title.trim()} style={[styles.addBtn, (adding || !url.trim() || !title.trim()) && { opacity: 0.4 }]}>
            {adding ? <ActivityIndicator color={c.black} /> : <T variant="label" color={c.black}>{t('replay.add')}</T>}
          </Pressable>
        </Card>
      )}

      {loading ? (
        <ActivityIndicator color={c.primary} style={{ marginTop: Space.xl }} />
      ) : videos.length === 0 ? (
        <Card>
          <T variant="small" color={c.textDim}>
            {t('replay.noVideos')}
          </T>
          <T variant="caption" color={c.textMute} style={{ marginTop: 6 }}>
            {isAdmin ? t('replay.adminHint') : t('replay.userHint')}
          </T>
        </Card>
      ) : (
        <Section title={`${videos.length} ${t('replay.videos')}`}>
          <View style={styles.grid}>
            {videos.map((v) => (
              <Pressable
                key={v.id}
                style={styles.vcard}
                onPress={() =>
                  router.push({
                    pathname: '/video',
                    params: { id: v.youtube_id, title: v.title, meta: [v.discipline, v.year].filter(Boolean).join(' · ') },
                  })
                }>

                <View style={styles.thumbWrap}>
                  <Image source={{ uri: youtubeThumb(v.youtube_id) }} style={styles.thumb} resizeMode="cover" />
                  <View style={styles.playBadge}>
                    <Ionicons name="play" size={16} color={c.black} />
                  </View>
                </View>
                <T variant="small" numberOfLines={2} style={{ marginTop: 8 }}>
                  {v.title}
                </T>
                {(v.discipline || v.year) && (
                  <View style={{ marginTop: 6 }}>
                    <Tag label={[v.discipline, v.year].filter(Boolean).join(' · ')} color={c.primary} />
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        </Section>
      )}
    </Screen>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    input: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: Radius.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: c.text,
      fontSize: 14,
      marginTop: Space.sm,
    },
    addBtn: {
      backgroundColor: c.primary,
      borderRadius: Radius.pill,
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: Space.md,
      minHeight: 44,
      justifyContent: 'center',
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    vcard: { width: '48%', marginBottom: Space.lg },
    thumbWrap: { position: 'relative', borderRadius: Radius.md, overflow: 'hidden', backgroundColor: c.surface2 },
    thumb: { width: '100%', aspectRatio: 16 / 9 },
    playBadge: {
      position: 'absolute',
      bottom: 8,
      right: 8,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
