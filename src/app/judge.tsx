/**
 * Espace juge — voter sur le passage en cours (réservé au rôle « juge »).
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PageHeader, Screen, T } from '@/components/ui';
import { Palette, Radius, Space } from '@/constants/brand';
import { useT } from '@/lib/i18n';
import { Category, EventRow, getEventCategories, getEvents } from '@/lib/jdlive';
import {
  castVote,
  getCurrentPassage,
  getMyVote,
  Passage,
  Side,
  Vote,
} from '@/lib/vote';

export default function Judge() {
  const t = useT();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventId, setEventId] = useState<string | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [passage, setPassage] = useState<Passage | null>(null);
  const [myVote, setMyVote] = useState<Vote | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getEvents()
      .then((ev) => {
        setEvents(ev);
        if (ev.length) setEventId(ev[0].id);
      })
      .catch((e) => setError(e?.message ?? t('rg.err')))
      .finally(() => setLoading(false));
  }, []);

  const refresh = async (id: string) => {
    try {
      const p = await getCurrentPassage(id);
      setPassage(p);
      setMyVote(p ? await getMyVote(p.id) : null);
    } catch (e: any) {
      setError(e?.message ?? t('rg.err'));
    }
  };

  useEffect(() => {
    if (!eventId) return;
    getEventCategories(eventId).then(setCats).catch(() => setCats([]));
    refresh(eventId);
    timer.current = setInterval(() => refresh(eventId), 4000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [eventId]);

  const vote = async (side: Side) => {
    if (!passage) return;
    setVoting(true);
    setError(null);
    try {
      await castVote(passage.id, side);
      setMyVote(await getMyVote(passage.id));
    } catch (e: any) {
      const m = (e?.message ?? '').toLowerCase();
      if (m.includes('duplicate')) {
        setError(t('jd.already'));
        // Resynchronise l'UI avec le vote réellement enregistré côté serveur.
        try {
          setMyVote(await getMyVote(passage.id));
        } catch {}
      }
      else if (m.includes('row-level') || m.includes('policy'))
        setError(t("jd.refused"));
      else setError(e?.message ?? t('jd.voteFail'));
    } finally {
      setVoting(false);
    }
  };

  const catName = passage
    ? cats.find((c) => c.id === passage.category_id)?.name ?? ''
    : '';

  if (loading) {
    return (
      <Screen scroll={false}>
        <PageHeader title={t('profile.judge')} subtitle={t('jd.subVote')} />
        <View style={styles.center}>
          <ActivityIndicator color={Palette.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <PageHeader title={t('profile.judge')} subtitle={t('jd.subYourVote')} />

      {events.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 44, marginBottom: Space.sm }}>
          {events.map((e) => (
            <Pressable
              key={e.id}
              onPress={() => setEventId(e.id)}
              style={[styles.evChip, eventId === e.id && styles.evChipActive]}>
              <T variant="label" color={eventId === e.id ? Palette.black : Palette.textDim}>
                {e.city ?? e.title}
              </T>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {!passage ? (
        <View style={styles.center}>
          <Ionicons name="hourglass" size={40} color={Palette.textMute} />
          <T variant="h2" color={Palette.textDim} style={{ marginTop: Space.md, textAlign: 'center' }}>
            {t('jd.waiting')}
          </T>
          <T variant="small" color={Palette.textMute} style={{ marginTop: 6, textAlign: 'center' }}>
            {t('jd.regieSoon')}
          </T>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={styles.meta}>
            <T variant="caption" color={Palette.primary}>
              {catName ? `${catName} · ` : ''}
              {passage.round ?? ''}
            </T>
            <T variant="caption" color={passage.status === 'open' ? Palette.primary : Palette.textMute}>
              {statusLabel(passage.status, t)}
            </T>
          </View>

          <View style={{ flex: 1, gap: Space.md, marginTop: Space.md }}>
            <SideButton
              side="a"
              name={passage.side_a_name}
              color={passage.side_a_color}
              disabled={passage.status !== 'open' || !!myVote || voting}
              chosen={myVote?.choice === 'a'}
              winner={passage.status === 'revealed' && passage.winner === 'a'}
              onPress={() => vote('a')}
            />
            <SideButton
              side="b"
              name={passage.side_b_name}
              color={passage.side_b_color}
              disabled={passage.status !== 'open' || !!myVote || voting}
              chosen={myVote?.choice === 'b'}
              winner={passage.status === 'revealed' && passage.winner === 'b'}
              onPress={() => vote('b')}
            />
          </View>

          {/* Bandeau d'état */}
          <View style={styles.footer}>
            {voting ? (
              <ActivityIndicator color={Palette.primary} />
            ) : myVote ? (
              <T variant="label" color={Palette.primary}>
                {t('jd.voteSaved', { w: myVote.weight })}
              </T>
            ) : passage.status === 'open' ? (
              <T variant="label" color={Palette.textDim}>
                {t('jd.chooseWinner')}
              </T>
            ) : (
              <T variant="label" color={Palette.textMute}>
                {t('jd.voteClosed')}
              </T>
            )}
          </View>

          {error && (
            <T variant="small" color={Palette.danger} style={{ textAlign: 'center', marginTop: Space.sm }}>
              {error}
            </T>
          )}
        </View>
      )}
    </Screen>
  );
}

function SideButton({
  side,
  name,
  color,
  disabled,
  chosen,
  winner,
  onPress,
}: {
  side: Side;
  name: string;
  color: string;
  disabled: boolean;
  chosen: boolean;
  winner: boolean;
  onPress: () => void;
}) {
  const t = useT();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.side,
        { backgroundColor: color + '1A', borderColor: color },
        chosen && { backgroundColor: color },
        disabled && !chosen && !winner && { opacity: 0.5 },
      ]}>
      <T variant="caption" color={chosen ? Palette.black : color}>
        {t('jd.side', { s: side.toUpperCase() })}
      </T>
      <T variant="title" color={chosen ? Palette.black : Palette.white} style={{ fontSize: 30, marginTop: 4 }}>
        {name}
      </T>
      {chosen && (
        <View style={styles.badge}>
          <Ionicons name="checkmark-circle" size={20} color={Palette.black} />
          <T variant="label" color={Palette.black} style={{ marginLeft: 6 }}>
            {t('jd.yourVote')}
          </T>
        </View>
      )}
      {winner && !chosen && (
        <View style={styles.badge}>
          <Ionicons name="trophy" size={18} color={color} />
          <T variant="label" color={color} style={{ marginLeft: 6 }}>
            {t('jd.winner')}
          </T>
        </View>
      )}
    </Pressable>
  );
}

function statusLabel(s: string, t: (k: string) => string): string {
  return { draft: t('rg.stDraft'), open: t('rg.stOpen'), locked: t('rg.stLocked'), revealed: t('jd.stRevealed') }[s] ?? s;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  evChip: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
    marginRight: 8,
  },
  evChipActive: { backgroundColor: Palette.primary, borderColor: Palette.primary },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  side: {
    flex: 1,
    borderWidth: 2,
    borderRadius: Radius.xl,
    padding: Space.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: { flexDirection: 'row', alignItems: 'center', marginTop: Space.md },
  footer: { alignItems: 'center', paddingVertical: Space.lg },
});
