/**
 * Régie / MC — préparer et piloter les passages, dépouillement pondéré en direct.
 * (Admin / organisateur uniquement — contrôlé par RLS.)
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Card, Chip, PageHeader, Screen, Section, T } from '@/components/ui';
import { Palette, Radius, Space } from '@/constants/brand';
import { useT } from '@/lib/i18n';
import { Category, EventRow, getEventCategories, getEventRegistrations, getEvents } from '@/lib/jdlive';
import { attachParticipants } from '@/lib/palmares';
import { pickAndUploadPassageSide } from '@/lib/photos';
import {
  createPassage,
  flagEmoji,
  getEventPassages,
  getPassageVotes,
  getPublicTally,
  Passage,
  setPassageSidePhoto,
  setPassageWinner,
  Side,
  tally,
  updatePassageStatus,
  Vote,
} from '@/lib/vote';

const LIME = '#A4FA00';
const FUCHSIA = '#FF2D9E';

export default function Regie() {
  const router = useRouter();
  const t = useT();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventId, setEventId] = useState<string | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [passages, setPassages] = useState<Passage[]>([]);
  const [votesBy, setVotesBy] = useState<Record<string, Vote[]>>({});
  const [publicBy, setPublicBy] = useState<Record<string, { a: number; b: number; total: number }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Formulaire nouveau passage
  const [catId, setCatId] = useState<string | null>(null);
  const [round, setRound] = useState('');
  const [aName, setAName] = useState('');
  const [bName, setBName] = useState('');
  const [aCountry, setACountry] = useState('');
  const [bCountry, setBCountry] = useState('');
  const [creating, setCreating] = useState(false);
  // Danseurs inscrits (pour lier au palmarès) + sélection par côté
  const [eventDancers, setEventDancers] = useState<{ id: string; name: string }[]>([]);
  const [aSel, setASel] = useState<string[]>([]);
  const [bSel, setBSel] = useState<string[]>([]);

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
      const ps = await getEventPassages(id);
      setPassages(ps);
      const active = ps.filter((p) => p.status === 'open' || p.status === 'locked');
      const entries = await Promise.all(
        active.map(async (p) => [p.id, await getPassageVotes(p.id)] as const),
      );
      setVotesBy((prev) => {
        const next = { ...prev };
        entries.forEach(([pid, v]) => (next[pid] = v));
        return next;
      });
      // Baromètre public pour tous les passages en cours ou révélés (départage).
      const nonDraft = ps.filter((p) => p.status !== 'draft');
      const pubEntries = await Promise.all(
        nonDraft.map(async (p) => [p.id, await getPublicTally(p.id)] as const),
      );
      setPublicBy((prev) => {
        const next = { ...prev };
        pubEntries.forEach(([pid, v]) => (next[pid] = v));
        return next;
      });
    } catch (e: any) {
      setError(e?.message ?? t('rg.err'));
    }
  };

  useEffect(() => {
    if (!eventId) return;
    getEventCategories(eventId).then(setCats).catch(() => setCats([]));
    getEventRegistrations(eventId)
      .then((regs) =>
        setEventDancers(
          regs
            .filter((r) => r.type === 'dancer' && r.profiles)
            .map((r) => ({
              id: r.profiles!.id,
              name: r.profiles!.alias || r.profiles!.full_name || t('profile.dancer'),
            })),
        ),
      )
      .catch(() => setEventDancers([]));
    refresh(eventId);
    timer.current = setInterval(() => refresh(eventId), 4000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [eventId]);

  const create = async () => {
    if (!eventId || !catId || !aName.trim() || !bName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const passage = await createPassage({
        eventId,
        categoryId: catId,
        round: round.trim() || undefined,
        aName: aName.trim(),
        bName: bName.trim(),
        aColor: LIME,
        bColor: FUCHSIA,
        aCountry: aCountry.trim() || undefined,
        bCountry: bCountry.trim() || undefined,
      });
      // Lien danseurs ↔ passage (palmarès) si des danseurs ont été sélectionnés.
      if (aSel.length || bSel.length) {
        await attachParticipants(passage.id, aSel, bSel);
      }
      setAName('');
      setBName('');
      setACountry('');
      setBCountry('');
      setRound('');
      setASel([]);
      setBSel([]);
      await refresh(eventId);
    } catch (e: any) {
      setError(e?.message ?? t('rg.createFail'));
    } finally {
      setCreating(false);
    }
  };

  const setStatus = async (p: Passage, status: Passage['status']) => {
    await updatePassageStatus(p.id, status);
    if (eventId) refresh(eventId);
  };

  const reveal = async (p: Passage) => {
    const t = tally(votesBy[p.id] ?? []);
    await setPassageWinner(p.id, t.winner);
    if (eventId) refresh(eventId);
  };

  // --- Départage (tie-break) en cas d'égalité des juges ---
  const forceWinner = async (p: Passage, side: Side) => {
    await setPassageWinner(p.id, side);
    if (eventId) refresh(eventId);
  };

  const breakByPublic = async (p: Passage) => {
    setError(null);
    try {
      // Décision DÉFINITIVE (départage) : on refait toujours le comptage à l'instant
      // de l'action plutôt que d'utiliser le cache (jusqu'à 4 s de retard).
      const pt = await getPublicTally(p.id);
      if (pt.a === pt.b) {
        setError(t('rg.publicTie'));
        return;
      }
      await setPassageWinner(p.id, pt.a > pt.b ? 'a' : 'b');
      if (eventId) refresh(eventId);
    } catch (e: any) {
      setError(e?.message ?? t('rg.tieFail'));
    }
  };

  const extraRound = async (p: Passage) => {
    if (!eventId) return;
    setError(null);
    try {
      await createPassage({
        eventId,
        categoryId: p.category_id,
        round: [p.round, t('rg.tie')].filter(Boolean).join(' · '),
        aName: p.side_a_name,
        bName: p.side_b_name,
        aColor: p.side_a_color,
        bColor: p.side_b_color,
        aCountry: p.side_a_country ?? undefined,
        bCountry: p.side_b_country ?? undefined,
      });
      await refresh(eventId);
    } catch (e: any) {
      setError(e?.message ?? t('rg.extraFail'));
    }
  };

  const [photoBusy, setPhotoBusy] = useState<string | null>(null);
  const addSidePhoto = async (p: Passage, side: 'a' | 'b', source: 'camera' | 'library') => {
    setPhotoBusy(p.id + side);
    setError(null);
    try {
      const url = await pickAndUploadPassageSide(p.id, side, source);
      if (url) {
        await setPassageSidePhoto(p.id, side, url);
        if (eventId) refresh(eventId);
      }
    } catch (e: any) {
      setError(e?.message ?? t('rg.photoFail'));
    } finally {
      setPhotoBusy(null);
    }
  };

  if (loading) {
    return (
      <Screen scroll={false}>
        <PageHeader title={t('rg.title')} subtitle={t('rg.subtitle')} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={Palette.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader title={t('rg.title')} subtitle={t('rg.subtitle')} />

      {eventId && (
        <View style={{ flexDirection: 'row', gap: Space.sm, marginBottom: Space.sm }}>
          <Pressable
            onPress={() => router.push({ pathname: '/live', params: { eventId } })}
            style={[styles.liveBtn, { flex: 1, marginBottom: 0 }]}>
            <Ionicons name="tv" size={16} color={Palette.black} />
            <T variant="label" color={Palette.black} style={{ marginLeft: 6 }}>
              {t('rg.liveScreen')}
            </T>
          </Pressable>
          <Pressable onPress={() => router.push('/bracket')} style={styles.bracketBtn}>
            <Ionicons name="git-network" size={16} color={Palette.text} />
            <T variant="label" color={Palette.text} style={{ marginLeft: 6 }}>
              Bracket
            </T>
          </Pressable>
          <Pressable onPress={() => router.push('/commentator')} style={styles.bracketBtn}>
            <Ionicons name="mic" size={16} color={Palette.text} />
            <T variant="label" color={Palette.text} style={{ marginLeft: 6 }}>
              {t('rg.console')}
            </T>
          </Pressable>
        </View>
      )}

      {events.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Space.sm }}>
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

      {/* Nouveau passage */}
      <Section title={t('rg.newPassage')}>
        <Card>
          <T variant="caption" color={Palette.textMute}>
            {t('rg.discipline')}
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: Space.md }}>
            {cats.map((c) => (
              <Chip key={c.id} label={c.name} active={catId === c.id} onPress={() => setCatId(c.id)} color={Palette.primary} />
            ))}
          </View>
          <TextInput
            value={round}
            onChangeText={setRound}
            placeholder={t('rg.roundPh')}
            placeholderTextColor={Palette.textMute}
            style={styles.input}
          />
          <View style={{ flexDirection: 'row', gap: Space.md, marginTop: Space.md }}>
            <TextInput
              value={aName}
              onChangeText={setAName}
              placeholder={t('rg.sideLimePh')}
              placeholderTextColor={Palette.textMute}
              style={[styles.input, styles.half, { borderColor: LIME }]}
            />
            <TextInput
              value={bName}
              onChangeText={setBName}
              placeholder={t('rg.sideFuchsiaPh')}
              placeholderTextColor={Palette.textMute}
              style={[styles.input, styles.half, { borderColor: FUCHSIA }]}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: Space.md, marginTop: Space.sm }}>
            <TextInput
              value={aCountry}
              onChangeText={(v) => setACountry(v.toUpperCase())}
              placeholder={t('rg.countryLimePh')}
              maxLength={2}
              autoCapitalize="characters"
              placeholderTextColor={Palette.textMute}
              style={[styles.input, styles.half]}
            />
            <TextInput
              value={bCountry}
              onChangeText={(v) => setBCountry(v.toUpperCase())}
              placeholder={t('rg.countryFuchsiaPh')}
              maxLength={2}
              autoCapitalize="characters"
              placeholderTextColor={Palette.textMute}
              style={[styles.input, styles.half]}
            />
          </View>
          {/* Lier des danseurs inscrits (optionnel) → palmarès */}
          {eventDancers.length > 0 && (
            <View style={{ marginTop: Space.lg }}>
              <T variant="caption" color={Palette.textMute}>
                {t('rg.linkDancers')}
              </T>
              <View style={{ flexDirection: 'row', gap: Space.md, marginTop: 8 }}>
                {(['a', 'b'] as const).map((side) => {
                  const sel = side === 'a' ? aSel : bSel;
                  const setSel = side === 'a' ? setASel : setBSel;
                  return (
                    <View key={side} style={{ flex: 1 }}>
                      <T variant="caption" color={side === 'a' ? LIME : FUCHSIA}>
                        {side === 'a' ? t('rg.sideLime') : t('rg.sideFuchsia')}
                      </T>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                        {eventDancers.map((d) => (
                          <Chip
                            key={d.id}
                            label={d.name}
                            active={sel.includes(d.id)}
                            onPress={() =>
                              setSel((cur) =>
                                cur.includes(d.id) ? cur.filter((x) => x !== d.id) : [...cur, d.id],
                              )
                            }
                            color={side === 'a' ? LIME : FUCHSIA}
                          />
                        ))}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          <Pressable
            onPress={create}
            disabled={creating || !catId || !aName.trim() || !bName.trim()}
            style={[styles.cta, (creating || !catId || !aName.trim() || !bName.trim()) && { opacity: 0.4 }]}>
            {creating ? (
              <ActivityIndicator color={Palette.black} />
            ) : (
              <T variant="label" color={Palette.black}>
                {t('rg.createPassage')}
              </T>
            )}
          </Pressable>
        </Card>
      </Section>

      {error && (
        <T variant="small" color={Palette.danger} style={{ marginTop: Space.md }}>
          {error}
        </T>
      )}

      {/* Passages */}
      <Section title={`${t('rg.passages')} (${passages.length})`}>
        {passages.map((p) => {
          const tl = tally(votesBy[p.id] ?? []);
          const catName = cats.find((c) => c.id === p.category_id)?.name ?? '';
          return (
            <Card key={p.id} style={{ marginBottom: Space.md }}>
              <View style={styles.rowBetween}>
                <T variant="caption" color={Palette.primary}>
                  {[catName, p.round].filter(Boolean).join(' · ')}
                </T>
                <T variant="caption" color={Palette.textMute}>
                  {statusLabel(p.status, t)}
                </T>
              </View>

              {/* Score pondéré */}
              <View style={styles.scoreRow}>
                <ScoreSide name={p.side_a_name} country={p.side_a_country} color={p.side_a_color} score={tl.a} win={p.winner === 'a'} />
                <T variant="data" color={Palette.textMute}>
                  {p.status === 'draft' ? 'vs' : t('rg.votes', { n: tl.count })}
                </T>
                <ScoreSide name={p.side_b_name} country={p.side_b_country} color={p.side_b_color} score={tl.b} win={p.winner === 'b'} right />
              </View>

              {/* Photos des duos (pour l'écran live) */}
              <View style={styles.photoRow}>
                <SidePhoto
                  label={t('rg.photoLime')}
                  color={p.side_a_color}
                  photo={p.side_a_photo}
                  busy={photoBusy === p.id + 'a'}
                  onPick={(s) => addSidePhoto(p, 'a', s)}
                />
                <SidePhoto
                  label={t('rg.photoFuchsia')}
                  color={p.side_b_color}
                  photo={p.side_b_photo}
                  busy={photoBusy === p.id + 'b'}
                  onPick={(s) => addSidePhoto(p, 'b', s)}
                />
              </View>

              {p.status === 'revealed' && p.winner === 'tie' && (
                <View style={styles.tieBox}>
                  <View style={styles.rowBetween}>
                    <T variant="label" color={Palette.text}>
                      {t('rg.tieBreak')}
                    </T>
                    <T variant="caption" color={Palette.textMute}>
                      {t('rg.public')} {publicBy[p.id]?.a ?? 0} · {publicBy[p.id]?.b ?? 0}
                    </T>
                  </View>
                  <View style={{ flexDirection: 'row', gap: Space.sm, marginTop: Space.md }}>
                    <Ctrl label={t('rg.extraRound')} icon="repeat" onPress={() => extraRound(p)} />
                    <Ctrl label={t('rg.publicVote')} icon="people" onPress={() => breakByPublic(p)} primary />
                  </View>
                  <View style={{ flexDirection: 'row', gap: Space.sm, marginTop: Space.sm }}>
                    <Ctrl label={`${t('rg.decide')} : ${p.side_a_name}`} icon="hand-left" onPress={() => forceWinner(p, 'a')} />
                    <Ctrl label={`${t('rg.decide')} : ${p.side_b_name}`} icon="hand-right" onPress={() => forceWinner(p, 'b')} />
                  </View>
                </View>
              )}

              {/* Contrôles */}
              <View style={styles.controls}>
                {p.status === 'draft' && (
                  <Ctrl label={t('rg.openVote')} icon="play" onPress={() => setStatus(p, 'open')} primary />
                )}
                {p.status === 'open' && (
                  <Ctrl label={t('rg.lock')} icon="lock-closed" onPress={() => setStatus(p, 'locked')} />
                )}
                {p.status === 'locked' && (
                  <Ctrl label={t('rg.reveal')} icon="trophy" onPress={() => reveal(p)} primary />
                )}
                {p.status === 'revealed' && (
                  <T variant="label" color={Palette.primary}>
                    {t('rg.revealed')}
                  </T>
                )}
              </View>
            </Card>
          );
        })}
      </Section>
    </Screen>
  );
}

function ScoreSide({
  name,
  country,
  color,
  score,
  win,
  right,
}: {
  name: string;
  country: string | null;
  color: string;
  score: number;
  win: boolean;
  right?: boolean;
}) {
  const flag = flagEmoji(country);
  return (
    <View style={{ flex: 1, alignItems: right ? 'flex-end' : 'flex-start' }}>
      <View style={[styles.chipColor, { backgroundColor: color }]} />
      <T variant="h3" style={{ marginTop: 6 }} numberOfLines={1}>
        {flag ? `${flag} ` : ''}
        {name}
      </T>
      <T variant="title" color={color} style={{ fontSize: 30 }}>
        {score}
        {win ? ' ★' : ''}
      </T>
    </View>
  );
}

function SidePhoto({
  label,
  color,
  photo,
  busy,
  onPick,
}: {
  label: string;
  color: string;
  photo: string | null;
  busy: boolean;
  onPick: (source: 'camera' | 'library') => void;
}) {
  return (
    <View style={styles.sidePhoto}>
      {busy ? (
        <View style={styles.sidePhotoThumb}>
          <ActivityIndicator color={Palette.primary} size="small" />
        </View>
      ) : photo ? (
        <Image source={{ uri: photo }} style={[styles.sidePhotoThumb, { borderColor: color }]} />
      ) : (
        <View style={[styles.sidePhotoThumb, { borderColor: color, borderStyle: 'dashed' }]}>
          <Ionicons name="people" size={20} color={color} />
        </View>
      )}
      <T variant="caption" color={Palette.textMute} style={{ marginTop: 4, textAlign: 'center' }} numberOfLines={1}>
        {label}
      </T>
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
        <Pressable onPress={() => onPick('camera')} hitSlop={8}>
          <Ionicons name="camera" size={16} color={Palette.primary} />
        </Pressable>
        <Pressable onPress={() => onPick('library')} hitSlop={8}>
          <Ionicons name="images" size={16} color={Palette.primary} />
        </Pressable>
      </View>
    </View>
  );
}

function Ctrl({
  label,
  icon,
  onPress,
  primary,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.ctrl, primary ? styles.ctrlPrimary : styles.ctrlGhost]}>
      <Ionicons name={icon} size={16} color={primary ? Palette.black : Palette.text} />
      <T variant="label" color={primary ? Palette.black : Palette.text} style={{ marginLeft: 6 }}>
        {label}
      </T>
    </Pressable>
  );
}

function statusLabel(s: string, t: (k: string) => string): string {
  return { draft: t('rg.stDraft'), open: t('rg.stOpen'), locked: t('rg.stLocked'), revealed: t('rg.stRevealed') }[s] ?? s;
}

const styles = StyleSheet.create({
  evChip: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
    marginRight: 8,
  },
  evChipActive: { backgroundColor: Palette.primary, borderColor: Palette.primary },
  liveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.primary,
    borderRadius: Radius.pill,
    paddingVertical: 12,
    marginBottom: Space.sm,
  },
  bracketBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.pill,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  input: {
    backgroundColor: Palette.surface2,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Palette.text,
    fontSize: 15,
  },
  half: { flex: 1 },
  cta: {
    backgroundColor: Palette.primary,
    borderRadius: Radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Space.lg,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Space.md,
    gap: Space.md,
  },
  chipColor: { width: 26, height: 6, borderRadius: 3 },
  tieBox: {
    marginTop: Space.md,
    padding: Space.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface2,
  },
  photoRow: { flexDirection: 'row', gap: Space.md, marginTop: Space.lg },
  sidePhoto: { flex: 1, alignItems: 'center' },
  sidePhotoThumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.surface2,
  },
  controls: {
    flexDirection: 'row',
    gap: Space.sm,
    marginTop: Space.lg,
    borderTopWidth: 1,
    borderTopColor: Palette.borderSoft,
    paddingTop: Space.md,
  },
  ctrl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: Radius.pill,
    flex: 1,
  },
  ctrlPrimary: { backgroundColor: Palette.primary },
  ctrlGhost: { borderWidth: 1, borderColor: Palette.border },
});
