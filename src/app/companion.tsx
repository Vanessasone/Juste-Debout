import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { T } from '@/components/ui';
import { Gradients, Radius, Space } from '@/constants/brand';
import { ThemeColors } from '@/constants/theme';
import { askCompanion, ChatMsg } from '@/lib/companion';
import { useT } from '@/lib/i18n';
import { getNextEvent } from '@/lib/jdlive';
import { getMyProfile } from '@/lib/profile';
import { useColors } from '@/lib/theme';

type Msg = { id: string; from: 'ai' | 'user'; text: string };

const SUGGESTION_KEYS = ['comp.s1', 'comp.s2', 'comp.s3', 'comp.s4'];

export default function Companion() {
  const c = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Msg[]>([{ id: 'intro', from: 'ai', text: t('comp.intro') }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState<string | undefined>(undefined);
  const scrollRef = useRef<ScrollView>(null);
  const counter = useRef(0);

  // Contexte réel injecté dans le prompt (prochain événement + profil).
  useEffect(() => {
    (async () => {
      try {
        const [ev, me] = await Promise.all([getNextEvent(), getMyProfile()]);
        const parts: string[] = [];
        if (me) {
          parts.push(
            `Utilisateur : ${me.alias || me.full_name || 'danseur'}${me.level ? ` (${me.level})` : ''}${
              me.styles?.length ? `, disciplines : ${me.styles.join(', ')}` : ''
            }${me.city ? `, ${me.city}` : ''}.`,
          );
        }
        if (ev) {
          const when = ev.starts_on ? ` le ${ev.starts_on}` : '';
          parts.push(
            `Prochain événement dans l'app : ${ev.title}${ev.city ? ` à ${ev.city}` : ''}${when} (statut : ${ev.status}).`,
          );
        }
        setContext(parts.length ? parts.join('\n') : undefined);
      } catch {
        setContext(undefined);
      }
    })();
  }, []);

  const nextId = (p: string) => `${p}${counter.current++}`;

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || loading) return;
    const userMsg: Msg = { id: nextId('u'), from: 'user', text: q };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setLoading(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);

    // Historique pour l'IA : on exclut le message d'intro (doit commencer par l'utilisateur).
    const apiMessages: ChatMsg[] = history
      .filter((m) => m.id !== 'intro')
      .map((m) => ({ role: m.from === 'ai' ? 'assistant' : 'user', content: m.text }));

    try {
      const reply = await askCompanion(apiMessages, context);
      setMessages((m) => [...m, { id: nextId('a'), from: 'ai', text: reply }]);
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        { id: nextId('a'), from: 'ai', text: e?.message ?? t('comp.unreachable') },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Header */}
      <LinearGradient colors={Gradients.cyan} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.close}>
          <Ionicons name="chevron-down" size={22} color={c.black} />
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={styles.aiAvatar}>
            <Ionicons name="sparkles" size={20} color={c.black} />
          </View>
          <View style={{ marginLeft: Space.md }}>
            <T variant="h2" color={c.black}>Flow</T>
            <T variant="caption" color="rgba(0,0,0,0.7)">
              {loading ? t('comp.writing') : t('comp.online')}
            </T>
          </View>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: Space.lg, paddingBottom: Space.xl }}
          showsVerticalScrollIndicator={false}>
          {messages.map((m) => (
            <View key={m.id} style={[styles.bubble, m.from === 'ai' ? styles.ai : styles.user]}>
              <T variant="body" color={m.from === 'ai' ? c.text : c.black}>
                {m.text}
              </T>
            </View>
          ))}

          {loading && (
            <View style={[styles.bubble, styles.ai, { flexDirection: 'row', alignItems: 'center' }]}>
              <ActivityIndicator color={c.textMute} size="small" />
              <T variant="small" color={c.textMute} style={{ marginLeft: 8 }}>
                {t('comp.thinking')}
              </T>
            </View>
          )}

          {/* Suggestions (au début seulement) */}
          {messages.length <= 1 && !loading ? (
            <View style={{ marginTop: Space.md }}>
              {SUGGESTION_KEYS.map((k) => (
                <Pressable key={k} style={styles.suggestion} onPress={() => send(t(k))}>
                  <Ionicons name="arrow-forward-circle" size={18} color={c.cyan} />
                  <T variant="small" style={{ marginLeft: 8 }}>
                    {t(k)}
                  </T>
                </Pressable>
              ))}
            </View>
          ) : null}
        </ScrollView>

        {/* Input */}
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 10 }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={t('comp.placeholder')}
            placeholderTextColor={c.textMute}
            style={styles.input}
            editable={!loading}
            onSubmitEditing={() => send(input)}
          />
          <Pressable onPress={() => send(input)} disabled={loading} style={[styles.sendBtn, loading && { opacity: 0.5 }]}>
            <Ionicons name="arrow-up" size={20} color={c.black} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  header: { paddingHorizontal: Space.lg, paddingBottom: Space.lg },
  close: { alignSelf: 'center', marginBottom: Space.sm },
  aiAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: { maxWidth: '86%', padding: Space.md, borderRadius: Radius.lg, marginBottom: Space.md },
  ai: { backgroundColor: c.surface, alignSelf: 'flex-start', borderTopLeftRadius: 4 },
  user: { backgroundColor: c.cyan, alignSelf: 'flex-end', borderTopRightRadius: 4 },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: Radius.pill,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: Space.sm,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Space.lg,
    paddingTop: Space.md,
    borderTopWidth: 1,
    borderTopColor: c.border,
    backgroundColor: c.bgElevated,
  },
  input: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: Radius.pill,
    paddingVertical: 12,
    paddingHorizontal: 18,
    color: c.text,
    fontSize: 15,
    marginRight: Space.sm,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
