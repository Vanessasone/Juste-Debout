/**
 * Conversation — fil de messages en temps réel + saisie.
 */
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { T } from '@/components/ui';
import { Radius, Space } from '@/constants/brand';
import { ThemeColors } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { getMessages, markRead, Message, sendMessage, subscribeMessages } from '@/lib/messaging';
import { useColors } from '@/lib/theme';

export default function Chat() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const { t, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const { session } = useAuth();
  const myId = session?.user?.id;

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    getMessages(id)
      .then((m) => {
        if (!alive) return;
        setMessages(m);
      })
      .catch(() => setMessages([]))
      .finally(() => alive && setLoading(false));
    markRead(id).catch(() => {});

    const unsub = subscribeMessages(id, (m) => {
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      if (m.sender_id !== myId) markRead(id).catch(() => {});
    });
    return () => {
      alive = false;
      unsub();
    };
  }, [id, myId]);

  async function onSend() {
    const text = draft.trim();
    if (!text || sending || !id) return;
    setDraft('');
    setSending(true);
    try {
      await sendMessage(id, text);
    } catch {
      setDraft(text); // restaure en cas d'échec
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={c.text} />
        </Pressable>
        <T variant="h3" numberOfLines={1} style={{ flex: 1 }}>
          {name || t('msg.conversation')}
        </T>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 52}>
        {loading ? (
          <ActivityIndicator color={c.accent} style={{ marginTop: Space.xl }} />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: Space.lg, gap: 8 }}
            onContentSizeChange={scrollToEnd}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', marginTop: Space.xl }}>
                <T variant="small" color={c.textDim} style={{ textAlign: 'center' }}>
                  {t('msg.sayHi')}
                </T>
              </View>
            }
            renderItem={({ item }) => {
              const mine = item.sender_id === myId;
              return (
                <View style={[styles.bubbleRow, { justifyContent: mine ? 'flex-end' : 'flex-start' }]}>
                  <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                    <T variant="body" color={mine ? c.black : c.text}>
                      {item.body}
                    </T>
                    <T variant="caption" color={mine ? '#00000099' : c.textMute} style={{ marginTop: 3, textAlign: 'right', fontSize: 10 }}>
                      {new Date(item.created_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                    </T>
                  </View>
                </View>
              );
            }}
          />
        )}

        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t('msg.inputPh')}
            placeholderTextColor={c.textMute}
            style={styles.input}
            multiline
            maxLength={4000}
          />
          <Pressable onPress={onSend} disabled={!draft.trim() || sending} style={[styles.send, { opacity: draft.trim() && !sending ? 1 : 0.4 }]}>
            <Ionicons name="arrow-up" size={20} color={c.black} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.sm,
      paddingHorizontal: Space.lg,
      paddingBottom: Space.md,
      paddingRight: Space.xl,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    back: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
    bubbleRow: { flexDirection: 'row' },
    bubble: { maxWidth: '80%', borderRadius: Radius.lg, paddingVertical: 9, paddingHorizontal: 13 },
    mine: { backgroundColor: c.primary, borderBottomRightRadius: 4 },
    theirs: { backgroundColor: c.surface2, borderBottomLeftRadius: 4 },
    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: Space.sm,
      paddingHorizontal: Space.lg,
      paddingTop: Space.sm,
      borderTopWidth: 1,
      borderTopColor: c.border,
      backgroundColor: c.bg,
    },
    input: {
      flex: 1,
      maxHeight: 120,
      minHeight: 44,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: Radius.lg,
      paddingHorizontal: 14,
      paddingTop: 11,
      paddingBottom: 11,
      color: c.text,
      fontSize: 15,
    },
    send: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
