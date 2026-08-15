/**
 * Regarder en direct — lecture du flux HLS (Bunny Stream) via expo-video.
 * Le broadcast se fait via encodeur externe (OBS/Larix) → ingest RTMP Bunny.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LiveCaptions } from '@/components/LiveCaptions';
import { LiveGifts } from '@/components/LiveGifts';
import { LiveReactions } from '@/components/LiveReactions';
import { LiveVotePanel } from '@/components/LiveVotePanel';
import { getMyProfile } from '@/lib/profile';
import { Card, T } from '@/components/ui';
import { Palette, Radius, Space } from '@/constants/brand';
import { ThemeColors } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { getActiveLive, LiveStream, subscribeLive } from '@/lib/streaming';
import { useColors } from '@/lib/theme';

/** Lecteur natif (HLS). Monté uniquement quand une URL est disponible. */
function Player({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
    p.play();
  });
  return <VideoView player={player} style={styles.video} contentFit="contain" nativeControls />;
}

export default function Watch() {
  const c = useColors();
  const t = useT();
  const styles2 = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [stream, setStream] = useState<LiveStream | null>(null);
  const [loading, setLoading] = useState(true);
  const [who, setWho] = useState('Fan');

  useEffect(() => {
    getMyProfile()
      .then((p) => setWho(p?.alias || p?.full_name || 'Fan'))
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    getActiveLive()
      .then(setStream)
      .catch(() => setStream(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const unsub = subscribeLive(load);
    return unsub;
  }, [load]);

  const url = stream?.playback_url ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={[styles2.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles2.back}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
        {stream?.status === 'live' ? (
          <View style={styles2.liveTag}>
            <View style={styles2.liveDot} />
            <T variant="caption" color="#fff" style={{ fontWeight: '800', fontSize: 11, letterSpacing: 1 }}>
              {t('watch.badge')}
            </T>
          </View>
        ) : null}
        <View style={{ width: 38 }} />
      </View>

      <View style={{ flex: 1, justifyContent: 'center' }}>
        {loading ? (
          <ActivityIndicator color={Palette.primary} />
        ) : !stream ? (
          <Empty c={c} icon="videocam-off" title={t('watch.noneTitle')} sub={t('watch.noneSub')} />
        ) : !url ? (
          <Empty c={c} icon="hourglass" title={t('watch.soonTitle')} sub={t('watch.soonSub')} />
        ) : Platform.OS === 'web' ? (
          <View style={{ padding: Space.lg }}>
            <Card style={{ alignItems: 'center', paddingVertical: Space.xl }}>
              <Ionicons name="tv" size={44} color={Palette.primary} />
              <T variant="h3" color={c.text} style={{ marginTop: Space.md, textAlign: 'center' }}>
                {stream.title}
              </T>
              <T variant="small" color={c.textDim} style={{ textAlign: 'center', marginTop: 6 }}>
                {t('watch.optim')}
              </T>
              <Pressable onPress={() => Linking.openURL(url)} style={styles2.openBtn}>
                <T variant="label" color={c.black}>{t('watch.open')}</T>
              </Pressable>
            </Card>
            {stream.event_id ? <LiveCaptions eventId={stream.event_id} /> : null}
            {stream.event_id ? <LiveVotePanel eventId={stream.event_id} /> : null}
          </View>
        ) : (
          <View>
            <Player url={url} />
            {stream.event_id ? <LiveCaptions eventId={stream.event_id} /> : null}
            <T variant="h3" color="#fff" style={{ paddingHorizontal: Space.lg, marginTop: Space.md }}>
              {stream.title}
            </T>
            {stream.event_id ? <LiveVotePanel eventId={stream.event_id} /> : null}
          </View>
        )}
      </View>

      {/* Réactions live — la foule qui vibre en temps réel */}
      {stream ? <LiveReactions channelKey={stream.id} /> : null}
      {/* Cadeaux live — soutien premium attribué au danseur */}
      {stream?.event_id ? <LiveGifts channelKey={stream.id} eventId={stream.event_id} who={who} /> : null}
    </View>
  );
}

function Empty({ c, icon, title, sub }: { c: ThemeColors; icon: keyof typeof Ionicons.glyphMap; title: string; sub: string }) {
  return (
    <View style={{ alignItems: 'center', paddingHorizontal: Space.xl }}>
      <Ionicons name={icon} size={46} color={c.textMute} />
      <T variant="h3" color="#fff" style={{ marginTop: Space.md, textAlign: 'center' }}>
        {title}
      </T>
      <T variant="small" color={c.textDim} style={{ textAlign: 'center', marginTop: 8 }}>
        {sub}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
});

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Space.lg,
      paddingBottom: Space.md,
    },
    back: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
    liveTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.danger,
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 6,
    },
    liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
    openBtn: {
      backgroundColor: c.primary,
      borderRadius: Radius.pill,
      paddingVertical: 12,
      paddingHorizontal: 24,
      marginTop: Space.lg,
    },
  });
