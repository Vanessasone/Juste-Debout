/**
 * Console commentateur (JD Live+) — poster le direct commenté, avec assistance IA.
 * Accès : rôle commentator / organizer / staff / admin (RLS).
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Card, PageHeader, Screen, Section, T } from '@/components/ui';
import { Palette, Radius, Space } from '@/constants/brand';
import { useT } from '@/lib/i18n';
import { getEvents, EventRow } from '@/lib/jdlive';
import {
  Commentary,
  generateCommentary,
  getCommentaries,
  postCommentary,
  subscribeCommentaries,
} from '@/lib/livemedia';
import { getMyProfile } from '@/lib/profile';
import { getCurrentPassage, getPublicTally, Passage } from '@/lib/vote';

// Boutons « temps forts » : clés i18n (label + texte traduits à l'affichage).
const QUICK: { lk: string; tk: string; tag: string }[] = [
  { lk: 'co.qStartL', tk: 'co.qStartT', tag: 'start' },
  { lk: 'co.qHotL', tk: 'co.qHotT', tag: 'highlight' },
  { lk: 'co.qTieL', tk: 'co.qTieT', tag: 'tie' },
  { lk: 'co.qUpsetL', tk: 'co.qUpsetT', tag: 'upset' },
];

export default function Commentator() {
  const t = useT();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventId, setEventId] = useState<string | null>(null);
  const [passage, setPassage] = useState<Passage | null>(null);
  const [feed, setFeed] = useState<Commentary[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    getMyProfile()
      .then((p) => setAllowed(!!p?.roles?.some((r) => ['commentator', 'organizer', 'staff', 'admin'].includes(r))))
      .catch(() => setAllowed(false));
    getEvents()
      .then((ev) => {
        setEvents(ev);
        if (ev.length) setEventId(ev[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!eventId) return;
    getCommentaries(eventId).then(setFeed).catch(() => setFeed([]));
    getCurrentPassage(eventId).then(setPassage).catch(() => setPassage(null));
    const unsub = subscribeCommentaries(eventId, (c) => setFeed((cur) => [...cur, c]));
    const t = setInterval(() => getCurrentPassage(eventId).then(setPassage).catch(() => {}), 4000);
    return () => {
      unsub();
      clearInterval(t);
    };
  }, [eventId]);

  const send = async (raw: string, tag?: string) => {
    const body = raw.trim();
    if (!body || !eventId || sending) return;
    setSending(true);
    setError(null);
    try {
      await postCommentary({ eventId, passageId: passage?.id ?? null, text: body, tag: tag ?? null });
      setText('');
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    } catch (e: any) {
      setError(e?.message ?? t('co.publishFail'));
    } finally {
      setSending(false);
    }
  };

  const buildContext = async (): Promise<string> => {
    if (!passage) return 'Aucun passage en cours.';
    const parts = [
      `Côté vert : ${passage.side_a_name}. Côté rose : ${passage.side_b_name}.`,
      passage.round ? `Tour : ${passage.round}.` : '',
      `Statut : ${passage.status}.`,
      passage.winner ? `Vainqueur : ${passage.winner === 'a' ? passage.side_a_name : passage.winner === 'b' ? passage.side_b_name : 'égalité'}.` : '',
    ];
    try {
      const pt = await getPublicTally(passage.id);
      if (pt.total) parts.push(`Public : ${Math.round((pt.a / pt.total) * 100)}% côté vert, ${Math.round((pt.b / pt.total) * 100)}% côté rose (${pt.total} votes).`);
    } catch {
      /* ignore */
    }
    return parts.filter(Boolean).join(' ');
  };

  const generate = async () => {
    setAiBusy(true);
    setError(null);
    try {
      const line = await generateCommentary('live', await buildContext());
      if (line) setText(line);
    } catch (e: any) {
      setError(e?.message ?? t('co.aiUnavailable'));
    } finally {
      setAiBusy(false);
    }
  };

  if (allowed === false) {
    return (
      <Screen>
        <PageHeader title={t('co.header')} subtitle={t('co.headerSub')} />
        <Card>
          <T variant="small" color={Palette.textDim}>
            {t('co.accessDenied')}
          </T>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader title={t('co.header')} subtitle={t('co.headerSub')} />

      {events.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Space.sm }}>
          {events.map((e) => (
            <Pressable
              key={e.id}
              onPress={() => setEventId(e.id)}
              style={[styles.chip, eventId === e.id && styles.chipActive]}>
              <T variant="label" color={eventId === e.id ? Palette.black : Palette.textDim}>
                {e.city ?? e.title}
              </T>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <Card>
        <T variant="caption" color={Palette.textMute}>
          {t('co.currentPassage')}
        </T>
        {passage ? (
          <T variant="h3" style={{ marginTop: 4 }}>
            {passage.side_a_name} vs {passage.side_b_name}
            <T variant="caption" color={Palette.textMute}>
              {'  '}· {passage.status}
            </T>
          </T>
        ) : (
          <T variant="small" color={Palette.textDim} style={{ marginTop: 4 }}>
            {t('co.noActivePassage')}
          </T>
        )}
      </Card>

      {/* Temps forts rapides */}
      <View style={styles.quickRow}>
        {QUICK.map((q) => (
          <Pressable key={q.lk} onPress={() => send(t(q.tk), q.tag)} style={styles.quickBtn}>
            <T variant="caption" color={Palette.text}>
              {t(q.lk)}
            </T>
          </Pressable>
        ))}
      </View>

      {/* Saisie */}
      <View style={styles.inputBar}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t('co.inputPh')}
          placeholderTextColor={Palette.textMute}
          style={styles.input}
          multiline
        />
      </View>
      <View style={{ flexDirection: 'row', gap: Space.sm, marginTop: Space.sm }}>
        <Pressable onPress={generate} disabled={aiBusy} style={[styles.aiBtn, aiBusy && { opacity: 0.6 }]}>
          {aiBusy ? (
            <ActivityIndicator color={Palette.primary} size="small" />
          ) : (
            <>
              <Ionicons name="sparkles" size={16} color={Palette.primary} />
              <T variant="label" color={Palette.primary} style={{ marginLeft: 6 }}>
                {t('co.aiSuggest')}
              </T>
            </>
          )}
        </Pressable>
        <Pressable onPress={() => send(text)} disabled={sending || !text.trim()} style={[styles.sendBtn, (sending || !text.trim()) && { opacity: 0.5 }]}>
          <Ionicons name="send" size={16} color={Palette.black} />
          <T variant="label" color={Palette.black} style={{ marginLeft: 6 }}>
            {t('co.publish')}
          </T>
        </Pressable>
      </View>

      {error && (
        <T variant="small" color={Palette.danger} style={{ marginTop: Space.md }}>
          {error}
        </T>
      )}

      {/* Aperçu du fil */}
      <Section title={t('co.feedTitle')}>
        <ScrollView ref={scrollRef} style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
          {feed.length === 0 ? (
            <T variant="small" color={Palette.textMute}>
              {t('co.feedEmpty')}
            </T>
          ) : (
            feed.map((c) => <FeedLine key={c.id} c={c} />)
          )}
        </ScrollView>
      </Section>
    </Screen>
  );
}

function FeedLine({ c }: { c: Commentary }) {
  const isAi = c.kind === 'ai';
  return (
    <View style={styles.feedLine}>
      <View style={[styles.feedDot, { backgroundColor: isAi ? Palette.cyan : Palette.primary }]} />
      <View style={{ flex: 1 }}>
        <T variant="small" color={Palette.text}>
          {c.text}
        </T>
        <T variant="caption" color={Palette.textMute} style={{ marginTop: 2 }}>
          {isAi ? 'IA' : 'MC'}
          {c.tag ? ` · ${c.tag}` : ''}
        </T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
    marginRight: 8,
  },
  chipActive: { backgroundColor: Palette.primary, borderColor: Palette.primary },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: Space.md },
  quickBtn: {
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.pill,
    paddingVertical: 9,
    paddingHorizontal: 14,
    backgroundColor: Palette.surface,
  },
  inputBar: { marginTop: Space.md },
  input: {
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Palette.text,
    fontSize: 15,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  aiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Palette.primary,
    borderRadius: Radius.pill,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  sendBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.primary,
    borderRadius: Radius.pill,
    paddingVertical: 12,
  },
  feedLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 },
  feedDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
});
