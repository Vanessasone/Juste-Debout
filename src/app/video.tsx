/**
 * Lecteur vidéo intégré (YouTube dans l'app) — Replay.
 */
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { T } from '@/components/ui';
import { Space } from '@/constants/brand';
import { useT } from '@/lib/i18n';
import { youtubeWatchUrl } from '@/lib/videos';

// Le lecteur natif (WebView) n'est chargé que hors web (require conditionnel volontaire).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YoutubePlayer: any = Platform.OS === 'web' ? null : require('react-native-youtube-iframe').default;

export default function VideoScreen() {
  const { id, title, meta } = useLocalSearchParams<{ id: string; title?: string; meta?: string }>();
  const router = useRouter();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const playerH = Math.round(width * (9 / 16));
  const vid = (id ?? '') as string;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: Space.md, paddingBottom: 6 }}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </Pressable>
      </View>

      {YoutubePlayer ? (
        <YoutubePlayer height={playerH} width={width} play videoId={vid} />
      ) : (
        <Pressable
          onPress={() => Linking.openURL(youtubeWatchUrl(vid))}
          style={{ height: playerH, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="play-circle" size={56} color="#A4FA00" />
          <T variant="small" color="#B7B7B0" style={{ marginTop: 8 }}>
            {t('vid.open')}
          </T>
        </Pressable>
      )}

      <ScrollView contentContainerStyle={{ padding: Space.lg }}>
        <T variant="h2" color="#fff">
          {title ?? t('replay.title')}
        </T>
        {meta ? (
          <T variant="small" color="#B7B7B0" style={{ marginTop: 6 }}>
            {meta}
          </T>
        ) : null}
      </ScrollView>
    </View>
  );
}
