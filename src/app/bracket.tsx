/**
 * Bracket — génère l'arbre depuis les matchs du 1er tour, le visualise,
 * et pilote chaque match. Le gagnant monte automatiquement au tour suivant.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { TeamPicker } from '@/components/TeamPicker';
import { Card, Chip, PageHeader, Screen, T } from '@/components/ui';
import { Palette, Radius, Space } from '@/constants/brand';
import { useT } from '@/lib/i18n';
import { Category, EventRow, getEventCategories, getEvents } from '@/lib/jdlive';
import { Team } from '@/lib/teams';
import {
  Bracket,
  createBracket,
  flagEmoji,
  getBracketPassages,
  getEventBrackets,
  getPassageVotes,
  Passage,
  setPassageWinner,
  tally,
  updatePassageStatus,
} from '@/lib/vote';

const SIZES = [8, 16, 32];
const LIME = Palette.sideLime;
const FUCHSIA = Palette.sideFuchsia;

export default function BracketScreen() {
  const router = useRouter();
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [, setEvents] = useState<EventRow[]>([]);
  const [eventId, setEventId] = useState<string | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [brackets, setBrackets] = useState<Bracket[]>([]);
  const [bracketId, setBracketId] = useState<string | null>(null);
  const [passages, setPassages] = useState<Passage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Formulaire
  const [catId, setCatId] = useState<string | null>(null);
  const [size, setSize] = useState(8);
  const [r1, setR1] = useState<{ a: Team | null; b: Team | null }[]>(makeRows(8));

  useEffect(() => {
    getEvents()
      .then((ev) => {
        setEvents(ev);
        if (ev.length) setEventId(ev[0].id);
      })
      .catch((e) => setError(e?.message ?? t('rg.err')))
      .finally(() => setLoading(false));
  }, []);

  const loadBrackets = async (id: string) => {
    const bs = await getEventBrackets(id).catch(() => []);
    setBrackets(bs);
    if (bs.length) {
      setBracketId(bs[0].id);
      setShowForm(false);
    } else {
      setShowForm(true);
    }
  };

  const refreshTree = async (id: string) => {
    setPassages(await getBracketPassages(id).catch(() => []));
  };

  useEffect(() => {
    if (!eventId) return;
    getEventCategories(eventId).then(setCats).catch(() => setCats([]));
    loadBrackets(eventId);
  }, [eventId]);

  useEffect(() => {
    if (bracketId) refreshTree(bracketId);
  }, [bracketId]);

  const setSizeAndRows = (n: number) => {
    setSize(n);
    setR1((cur) => {
      const rows = makeRows(n);
      for (let i = 0; i < Math.min(cur.length, rows.length); i++) rows[i] = cur[i];
      return rows;
    });
  };

  const generate = async () => {
    if (!eventId || !catId) return;
    setCreating(true);
    setError(null);
    try {
      const round1 = r1.map((m) => ({
        aName: m.a?.name || t('br.teamA'),
        aCountry: m.a?.country ?? undefined,
        aPhoto: m.a?.photo_url ?? undefined,
        bName: m.b?.name || t('br.teamB'),
        bCountry: m.b?.country ?? undefined,
        bPhoto: m.b?.photo_url ?? undefined,
      }));
      const id = await createBracket({ eventId, categoryId: catId, size, round1 });
      await loadBrackets(eventId);
      setBracketId(id);
      setShowForm(false);
    } catch (e: any) {
      setError(e?.message ?? t('br.genFail'));
    } finally {
      setCreating(false);
    }
  };

  const control = async (p: Passage, action: 'open' | 'locked' | 'reveal' | 'a' | 'b') => {
    setError(null);
    try {
      if (action === 'reveal') {
        const votes = await getPassageVotes(p.id);
        const tl = tally(votes);
        if (tl.count === 0) {
          // Pas de vote → ne pas produire un "tie" artificiel qui figerait l'arbre.
          setError(t('br.noVotes'));
          return;
        }
        await setPassageWinner(p.id, tl.winner);
      } else if (action === 'a' || action === 'b') {
        // Départage manuel d'une vraie égalité (débloque la propagation au tour suivant).
        await setPassageWinner(p.id, action);
      } else {
        await updatePassageStatus(p.id, action);
      }
      if (bracketId) refreshTree(bracketId);
    } catch (e: any) {
      setError(e?.message ?? t('br.actionFail'));
    }
  };

  const rounds = groupByRound(passages, t);

  if (loading) {
    return (
      <Screen scroll={false}>
        <PageHeader title="Bracket" subtitle={t('br.subLoading')} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={Palette.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader title="Bracket" subtitle={t('br.subtitle')} />

      {/* Sélecteur de bracket + nouveau */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Space.md }}>
        {brackets.map((b) => (
          <Pressable
            key={b.id}
            onPress={() => {
              setBracketId(b.id);
              setShowForm(false);
            }}
            style={[styles.tab, bracketId === b.id && !showForm && styles.tabActive]}>
            <T variant="label" color={bracketId === b.id && !showForm ? Palette.black : Palette.textDim}>
              {catName(cats, b.category_id)} · {b.size}
            </T>
          </Pressable>
        ))}
        <Pressable onPress={() => setShowForm(true)} style={[styles.tab, showForm && styles.tabActive]}>
          <Ionicons name="add" size={15} color={showForm ? Palette.black : Palette.primary} />
          <T variant="label" color={showForm ? Palette.black : Palette.primary} style={{ marginLeft: 4 }}>
            {t('br.new')}
          </T>
        </Pressable>
      </ScrollView>

      {error && (
        <T variant="small" color={Palette.danger} style={{ marginBottom: Space.sm }}>
          {error}
        </T>
      )}

      {showForm ? (
        /* ---------- CRÉATION ---------- */
        <Card>
          <T variant="caption" color={Palette.textMute}>
            {t('rg.discipline')}
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {cats.map((c) => (
              <Chip key={c.id} label={c.name} active={catId === c.id} onPress={() => setCatId(c.id)} color={Palette.primary} />
            ))}
          </View>

          <T variant="caption" color={Palette.textMute} style={{ marginTop: Space.lg }}>
            {t('br.size')}
          </T>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            {SIZES.map((n) => (
              <Chip key={n} label={`Top ${n}`} active={size === n} onPress={() => setSizeAndRows(n)} color={Palette.primary} />
            ))}
          </View>

          <T variant="caption" color={Palette.textMute} style={{ marginTop: Space.lg, marginBottom: 8 }}>
            {t('br.round1Matches')} ({r1.length})
          </T>
          {r1.map((row, i) => (
            <View key={i} style={styles.matchBlock}>
              <T variant="caption" color={Palette.textMute}>
                {t('br.match')} {i + 1}
              </T>
              <View style={{ marginTop: 6, gap: 6 }}>
                <TeamPicker
                  value={row.a}
                  color={LIME}
                  placeholder={`${t('br.duoLime')} ${i + 1}`}
                  onSelect={(t) => setR1((cur) => cur.map((x, j) => (j === i ? { ...x, a: t } : x)))}
                />
                <TeamPicker
                  value={row.b}
                  color={FUCHSIA}
                  placeholder={`${t('br.duoFuchsia')} ${i + 1}`}
                  onSelect={(t) => setR1((cur) => cur.map((x, j) => (j === i ? { ...x, b: t } : x)))}
                />
              </View>
            </View>
          ))}

          <Pressable
            onPress={generate}
            disabled={creating || !catId}
            style={[styles.cta, (creating || !catId) && { opacity: 0.4 }]}>
            {creating ? (
              <ActivityIndicator color={Palette.black} />
            ) : (
              <T variant="label" color={Palette.black}>
                {t('br.generate')}
              </T>
            )}
          </Pressable>
        </Card>
      ) : (
        /* ---------- ARBRE ---------- */
        <>
        {bracketId && (
          <Pressable
            onPress={() => router.push({ pathname: '/bracket-live', params: { bracketId } })}
            style={styles.liveBtn}>
            <Ionicons name="tv" size={16} color={Palette.black} />
            <T variant="label" color={Palette.black} style={{ marginLeft: 6 }}>
              {t('br.liveScreen')}
            </T>
          </Pressable>
        )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: Space.md }}>
            {rounds.map((col) => (
              <View key={col.round} style={{ width: 210 }}>
                <T variant="label" color={Palette.primary} style={{ marginBottom: Space.sm }}>
                  {col.label}
                </T>
                <View style={{ gap: Space.md }}>
                  {col.matches.map((p) => (
                    <MatchCard key={p.id} p={p} onControl={control} />
                  ))}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
        </>
      )}
    </Screen>
  );
}

function MatchCard({ p, onControl }: { p: Passage; onControl: (p: Passage, a: 'open' | 'locked' | 'reveal' | 'a' | 'b') => void }) {
  const t = useT();
  const isTie = p.status === 'revealed' && p.winner === 'tie';
  return (
    <Card style={{ padding: Space.md }}>
      <SideRow name={p.side_a_name} country={p.side_a_country} color={p.side_a_color} win={p.winner === 'a'} />
      <View style={styles.divider} />
      <SideRow name={p.side_b_name} country={p.side_b_country} color={p.side_b_color} win={p.winner === 'b'} />

      <View style={styles.matchFooter}>
        <T variant="caption" color={isTie ? Palette.danger : Palette.textMute}>
          {isTie ? t('br.tieBreak') : statusLabel(p.status, t)}
        </T>
        {p.status === 'draft' && <Mini label={t('br.open')} onPress={() => onControl(p, 'open')} />}
        {p.status === 'open' && <Mini label={t('br.close')} onPress={() => onControl(p, 'locked')} />}
        {p.status === 'locked' && <Mini label={t('br.reveal')} onPress={() => onControl(p, 'reveal')} primary />}
        {isTie && (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Mini label={p.side_a_name} onPress={() => onControl(p, 'a')} />
            <Mini label={p.side_b_name} onPress={() => onControl(p, 'b')} primary />
          </View>
        )}
        {p.status === 'revealed' && !isTie && (
          <Ionicons name="trophy" size={14} color={Palette.primary} />
        )}
      </View>
    </Card>
  );
}

function SideRow({ name, country, color, win }: { name: string; country: string | null; color: string; win: boolean }) {
  const flag = flagEmoji(country);
  return (
    <View style={styles.sideRow}>
      <View style={[styles.sideDot, { backgroundColor: color }]} />
      <T variant="small" color={win ? Palette.white : Palette.textDim} numberOfLines={1} style={{ flex: 1, fontWeight: win ? '700' : '500' }}>
        {flag ? `${flag} ` : ''}
        {name}
      </T>
      {win && <Ionicons name="checkmark-circle" size={15} color={color} />}
    </View>
  );
}

function Mini({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.mini, primary ? { backgroundColor: Palette.primary } : { borderWidth: 1, borderColor: Palette.border }]}>
      <T variant="caption" color={primary ? Palette.black : Palette.text}>
        {label}
      </T>
    </Pressable>
  );
}

/* helpers */
function makeRows(size: number): { a: Team | null; b: Team | null }[] {
  return Array.from({ length: size / 2 }, () => ({ a: null, b: null }));
}
function catName(cats: Category[], id: string | null) {
  return cats.find((c) => c.id === id)?.name ?? 'Bracket';
}
function statusLabel(s: string, t: (k: string) => string) {
  return { draft: t('br.stDraft'), open: t('rg.stOpen'), locked: t('br.stLocked'), revealed: t('br.stRevealed') }[s] ?? s;
}
function groupByRound(passages: Passage[], t: (k: string, o?: Record<string, unknown>) => string) {
  const byRound = new Map<number, Passage[]>();
  passages.forEach((p) => {
    const r = p.round_no ?? 0;
    if (!byRound.has(r)) byRound.set(r, []);
    byRound.get(r)!.push(p);
  });
  return [...byRound.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([round, matches]) => ({
      round,
      label: matches[0]?.round ?? t('br.roundN', { n: round }),
      matches: matches.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    }));
}

const styles = StyleSheet.create({
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
    marginRight: 8,
  },
  tabActive: { backgroundColor: Palette.primary, borderColor: Palette.primary },
  liveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.primary,
    borderRadius: Radius.pill,
    paddingVertical: 12,
    marginBottom: Space.md,
  },
  input: {
    flex: 1,
    backgroundColor: Palette.surface2,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: Palette.text,
    fontSize: 13,
  },
  countryInput: {
    width: 42,
    backgroundColor: Palette.surface2,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.sm,
    paddingVertical: 9,
    color: Palette.text,
    fontSize: 12,
    textAlign: 'center',
  },
  matchInput: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 4 },
  matchBlock: { marginBottom: Space.md },
  sideDot: { width: 10, height: 10, borderRadius: 5, marginHorizontal: 6 },
  cta: {
    backgroundColor: Palette.primary,
    borderRadius: Radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Space.lg,
  },
  sideRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  divider: { height: 1, backgroundColor: Palette.borderSoft },
  matchFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Space.sm,
    borderTopWidth: 1,
    borderTopColor: Palette.borderSoft,
    paddingTop: Space.sm,
  },
  mini: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: Radius.pill },
});
