/**
 * Messagerie — liste des conversations privées.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Card, T } from '@/components/ui';
import { Space } from '@/constants/brand';
import { ThemeColors } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';
import { conversationName, ConversationSummary, getConversations } from '@/lib/messaging';
import { useColors } from '@/lib/theme';

function timeLabel(iso: string | null, locale: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

export default function Messages() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const { t, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const [convos, setConvos] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      getConversations()
        .then(setConvos)
        .catch(() => setConvos([]))
        .finally(() => setLoading(false));
    }, []),
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={c.text} />
        </Pressable>
        <T variant="title" style={{ fontSize: 24 }}>
          {t('msg.title')}
        </T>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: Space.lg, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={c.accent} style={{ marginTop: Space.xl }} />
        ) : convos.length === 0 ? (
          <Card>
            <View style={{ alignItems: 'center', paddingVertical: Space.lg }}>
              <Ionicons name="chatbubbles-outline" size={40} color={c.textMute} />
              <T variant="h3" style={{ marginTop: Space.md }}>
                {t('msg.empty')}
              </T>
              <T variant="small" color={c.textDim} style={{ textAlign: 'center', marginTop: 6 }}>
                {t('msg.emptyHint')}
              </T>
            </View>
          </Card>
        ) : (
          convos.map((cv) => {
            const name = conversationName(cv, t);
            return (
              <Card
                key={cv.id}
                style={styles.row}
                onPress={() =>
                  router.push({ pathname: '/chat/[id]', params: { id: cv.id, name } } as never)
                }>
                <Avatar name={name} uri={cv.other_photo ?? undefined} color={c.accent} size={50} />
                <View style={{ flex: 1, marginLeft: Space.md }}>
                  <View style={styles.rowBetween}>
                    <T variant="h3" numberOfLines={1} style={{ flex: 1 }}>
                      {name}
                    </T>
                    <T variant="caption" color={c.textMute} style={{ marginLeft: 8 }}>
                      {timeLabel(cv.last_message_at, locale)}
                    </T>
                  </View>
                  <View style={[styles.rowBetween, { marginTop: 2 }]}>
                    <T
                      variant="small"
                      color={cv.unread > 0 ? c.text : c.textDim}
                      numberOfLines={1}
                      style={{ flex: 1, fontWeight: cv.unread > 0 ? '700' : '400' }}>
                      {cv.last_message || t('msg.newConv')}
                    </T>
                    {cv.unread > 0 ? (
                      <View style={styles.badge}>
                        <T variant="caption" color={c.black} style={{ fontWeight: '800', fontSize: 11 }}>
                          {cv.unread}
                        </T>
                      </View>
                    ) : null}
                  </View>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Space.lg,
      paddingBottom: Space.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    back: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
    row: { flexDirection: 'row', alignItems: 'center', marginBottom: Space.md },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    badge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 6,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8,
    },
  });
