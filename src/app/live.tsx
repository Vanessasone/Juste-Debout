/**
 * Écran LIVE — style broadcast Juste Debout.
 * En cours : carte « VS » (photos des 2 duos + wordmark + catégorie + bandeaux de noms colorés).
 * À la révélation : LE VAINQUEUR en grand (photo + nom).
 * La couleur d'un nom suit le CÔTÉ du passage (vert / rose), pas l'équipe.
 */
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Vitruve, Wordmark } from '@/components/Logo';
import { T } from '@/components/ui';
import { Font, JD_COORDS, Palette, Radius, Space } from '@/constants/brand';
import { useT } from '@/lib/i18n';
import { Category, getEventCategories, getEvents } from '@/lib/jdlive';
import { Commentary, getCommentaries, subscribeCommentaries } from '@/lib/livemedia';
import { playReveal, playSuspense, stopSuspense } from '@/lib/sound';
import {
  castPublicVote,
  flagEmoji,
  getCurrentPassage,
  getMyPublicVote,
  getPassageVotes,
  getPublicTally,
  Passage,
  Side,
  tally,
} from '@/lib/vote';

/** Noir ou blanc selon la luminance de la couleur du côté. */
function textOn(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#0A0A0A' : '#FFFFFF';
}

export default function Live() {
  const t = useT();
  const params = useLocalSearchParams<{ eventId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [eventId, setEventId] = useState<string | null>(params.eventId ?? null);
  const [cats, setCats] = useState<Category[]>([]);
  const [passage, setPassage] = useState<Passage | null>(null);
  const [score, setScore] = useState({ a: 0, b: 0, count: 0, winner: 'tie' as 'a' | 'b' | 'tie' });
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const anim = useMemo(() => new Animated.Value(0), []);
  const suspenseAnim = useMemo(() => new Animated.Value(0), []);
  const countAnim = useMemo(() => new Animated.Value(0), []);
  const [suspense, setSuspense] = useState(false);
  const [count, setCount] = useState(3);
  // Vote du public (spectateurs)
  const [myPublicVote, setMyPublicVote] = useState<Side | null>(null);
  const [publicTally, setPublicTally] = useState({ a: 0, b: 0, total: 0 });
  const [ticker, setTicker] = useState<Commentary | null>(null);

  useEffect(() => {
    if (eventId) return;
    getEvents().then((ev) => ev.length && setEventId(ev[0].id));
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    getEventCategories(eventId).then(setCats).catch(() => setCats([]));
    const tick = async () => {
      const p = await getCurrentPassage(eventId);
      setPassage(p);
      if (p) {
        try {
          setScore(tally(await getPassageVotes(p.id)));
        } catch {
          /* non-admin : le vainqueur reste visible via passage.winner */
        }
        // Baromètre public (lecture ouverte à tous les connectés)
        try {
          const [pt, mv] = await Promise.all([getPublicTally(p.id), getMyPublicVote(p.id)]);
          setPublicTally(pt);
          setMyPublicVote(mv?.choice ?? null);
        } catch {
          /* ignore */
        }
      } else {
        setPublicTally({ a: 0, b: 0, total: 0 });
        setMyPublicVote(null);
      }
    };
    tick();
    timer.current = setInterval(tick, 3000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [eventId]);

  // Ticker du direct commenté (temps réel).
  useEffect(() => {
    if (!eventId) return;
    getCommentaries(eventId, 1)
      .then((cs) => setTicker(cs[cs.length - 1] ?? null))
      .catch(() => {});
    const unsub = subscribeCommentaries(eventId, (c) => setTicker(c));
    return unsub;
  }, [eventId]);

  // Suspense : compte à rebours 3-2-1 puis révélation animée du vainqueur.
  useEffect(() => {
    const isWinner = passage?.status === 'revealed' && (passage.winner === 'a' || passage.winner === 'b');
    if (!isWinner) {
      setSuspense(false);
      return;
    }
    setSuspense(true);
    setCount(3);
    playSuspense(); // montée de tension
    suspenseAnim.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(suspenseAnim, { toValue: 1, duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(suspenseAnim, { toValue: 0, duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    const t1 = setTimeout(() => setCount(2), 900);
    const t2 = setTimeout(() => setCount(1), 1800);
    const t3 = setTimeout(() => {
      loop.stop();
      setSuspense(false);
      stopSuspense();
      playReveal(); // impact de révélation
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }).start();
    }, 2700);
    return () => {
      loop.stop();
      stopSuspense();
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [passage?.status, passage?.id, passage?.winner, anim, suspenseAnim]);

  // Pop du chiffre à chaque décompte.
  useEffect(() => {
    if (!suspense) return;
    countAnim.setValue(0);
    Animated.spring(countAnim, { toValue: 1, useNativeDriver: true, friction: 4, tension: 90 }).start();
  }, [count, suspense, countAnim]);

  const votePublic = async (side: Side) => {
    if (!passage || passage.status !== 'open') return;
    setMyPublicVote(side); // optimiste
    try {
      await castPublicVote(passage.id, side);
      setPublicTally(await getPublicTally(passage.id));
    } catch {
      /* ignore — RLS refusera si le passage n'est plus ouvert */
    }
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
  const catName = passage ? cats.find((c) => c.id === passage.category_id)?.name ?? '' : '';
  const revealed = passage?.status === 'revealed';
  const winnerSide = passage?.winner;
  const bigWinner = revealed && (winnerSide === 'a' || winnerSide === 'b');

  return (
    <View style={[styles.root, { paddingTop: insets.top + Space.md, paddingBottom: insets.bottom + Space.md }]}>
      {/* En-tête */}
      <View style={styles.top}>
        <Pressable onPress={goBack} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={Palette.text} />
        </Pressable>
        <T variant="caption" color={Palette.textMute}>
          {passage ? statusShort(passage.status, t) : JD_COORDS}
        </T>
      </View>

      {!passage ? (
        <View style={styles.center}>
          <Vitruve size={130} color={Palette.primary} opacity={0.5} />
          <T variant="h1" color={Palette.textDim} style={{ marginTop: Space.xl }}>
            {t('live.waiting')}
          </T>
        </View>
      ) : bigWinner ? (
        suspense ? (
          <Suspense passage={passage} anim={suspenseAnim} count={count} countAnim={countAnim} catName={catName} />
        ) : (
          <WinnerBig
            passage={passage}
            side={winnerSide as 'a' | 'b'}
            catName={catName}
            size={Math.min(width * 0.62, height * 0.42, 360)}
            anim={anim}
          />
        )
      ) : (
        /* ---------- CARTE VS (broadcast) ---------- */
        <View style={styles.card}>
          <View style={styles.photos}>
            <TeamPhoto photo={passage.side_a_photo} color={passage.side_a_color} />
            <TeamPhoto photo={passage.side_b_photo} color={passage.side_b_color} />
            <View style={styles.overlay} pointerEvents="none">
              <Wordmark height={Math.min(width * 0.1, 48)} color={Palette.white} />
              <View style={styles.badge}>
                <T variant="label" color={Palette.white} style={{ fontSize: 13 }}>
                  {[passage.round, catName].filter(Boolean).join(' ')}
                </T>
              </View>
            </View>
          </View>

          {/* Bandeaux de noms colorés */}
          <View style={styles.nameBar}>
            <NamePill name={passage.side_a_name} country={passage.side_a_country} color={passage.side_a_color} score={score.a} revealed={revealed} />
            <View style={styles.vs}>
              <T variant="display" color={Palette.white} style={{ fontSize: 26 }}>
                VS
              </T>
            </View>
            <NamePill name={passage.side_b_name} country={passage.side_b_country} color={passage.side_b_color} score={score.b} revealed={revealed} />
          </View>

          {/* Statut live */}
          <View style={styles.statusRow}>
            {passage.status === 'open' ? (
              <View style={styles.liveTag}>
                <View style={styles.liveDot} />
                <T variant="label" color={Palette.white}>
                  {t('live.votingInProgress')} · {t('live.judges', { n: score.count })}
                </T>
              </View>
            ) : winnerSide === 'tie' && revealed ? (
              <T variant="label" color={Palette.textDim}>
                Égalité — départage
              </T>
            ) : (
              <T variant="label" color={Palette.textMute}>
                Dépouillement…
              </T>
            )}
          </View>

          {/* Vote du public (spectateurs) */}
          <SpectatorBar passage={passage} tally={publicTally} myVote={myPublicVote} onVote={votePublic} />
        </View>
      )}

      {/* Ticker du direct commenté */}
      {ticker && (
        <View style={styles.ticker}>
          <View style={styles.tickerTag}>
            <Ionicons name={ticker.kind === 'ai' ? 'sparkles' : 'mic'} size={13} color={Palette.black} />
          </View>
          <T variant="small" color={Palette.white} numberOfLines={2} style={{ flex: 1, marginLeft: 10 }}>
            {ticker.text}
          </T>
        </View>
      )}
    </View>
  );
}

function SpectatorBar({
  passage,
  tally,
  myVote,
  onVote,
}: {
  passage: Passage;
  tally: { a: number; b: number; total: number };
  myVote: Side | null;
  onVote: (side: Side) => void;
}) {
  const t = useT();
  const open = passage.status === 'open';
  const pctA = tally.total ? tally.a / tally.total : 0.5;
  const aFg = textOn(passage.side_a_color);
  const bFg = textOn(passage.side_b_color);
  return (
    <View style={styles.spectator}>
      <View style={styles.rowBetween}>
        <T variant="caption" color={Palette.textMute}>
          {t('live.publicVote')}
        </T>
        <T variant="caption" color={Palette.textMute}>
          {t('live.voters', { n: tally.total })}
        </T>
      </View>

      {/* Baromètre */}
      <View style={styles.meter}>
        <View style={{ flex: Math.max(pctA, 0.001), backgroundColor: passage.side_a_color }} />
        <View style={{ flex: Math.max(1 - pctA, 0.001), backgroundColor: passage.side_b_color }} />
      </View>
      <View style={styles.rowBetween}>
        <T variant="caption" color={Palette.textDim}>
          {Math.round(pctA * 100)}%
        </T>
        <T variant="caption" color={Palette.textDim}>
          {Math.round((1 - pctA) * 100)}%
        </T>
      </View>

      {/* Boutons — actifs seulement quand le passage est ouvert */}
      {open ? (
        <View style={styles.voteRow}>
          {(['a', 'b'] as Side[]).map((side) => {
            const color = side === 'a' ? passage.side_a_color : passage.side_b_color;
            const fg = side === 'a' ? aFg : bFg;
            const name = side === 'a' ? passage.side_a_name : passage.side_b_name;
            const mine = myVote === side;
            return (
              <Pressable
                key={side}
                onPress={() => onVote(side)}
                style={[
                  styles.voteBtn,
                  { backgroundColor: mine ? color : 'transparent', borderColor: color },
                ]}>
                {mine && <Ionicons name="checkmark-circle" size={16} color={fg} style={{ marginRight: 6 }} />}
                <T variant="label" color={mine ? fg : Palette.text} numberOfLines={1} style={{ maxWidth: 120 }}>
                  {name}
                </T>
              </Pressable>
            );
          })}
        </View>
      ) : myVote ? (
        <T variant="caption" color={Palette.textMute} style={{ textAlign: 'center', marginTop: 8 }}>
          {t('live.voteCounted')}
        </T>
      ) : null}
    </View>
  );
}

function TeamPhoto({ photo, color }: { photo: string | null; color: string }) {
  if (photo) {
    return <Image source={{ uri: photo }} style={styles.teamPhoto} resizeMode="cover" />;
  }
  return (
    <View style={[styles.teamPhoto, styles.teamPlaceholder, { backgroundColor: color + '14' }]}>
      <Ionicons name="people" size={54} color={color} />
    </View>
  );
}

function NamePill({
  name,
  country,
  color,
  score,
  revealed,
}: {
  name: string;
  country: string | null;
  color: string;
  score: number;
  revealed: boolean;
}) {
  const t = useT();
  const fg = textOn(color);
  const flag = flagEmoji(country);
  return (
    <View style={[styles.pill, { backgroundColor: color }]}>
      <T variant="h3" color={fg} style={{ textAlign: 'center' }} numberOfLines={2}>
        {flag ? `${flag} ` : ''}
        {name}
      </T>
      {(revealed || score > 0) && (
        <T variant="data" color={fg} style={{ marginTop: 2 }}>
          {score} {t('ranking.pts')}
        </T>
      )}
    </View>
  );
}

function Suspense({
  passage,
  anim,
  count,
  countAnim,
  catName,
}: {
  passage: Passage;
  anim: Animated.Value;
  count: number;
  countAnim: Animated.Value;
  catName: string;
}) {
  const t = useT();
  const aOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.06, 0.5] });
  const bOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.06] });
  const numScale = countAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
  return (
    <View style={styles.center}>
      <Animated.View style={[styles.flashLeft, { backgroundColor: passage.side_a_color, opacity: aOpacity }]} />
      <Animated.View style={[styles.flashRight, { backgroundColor: passage.side_b_color, opacity: bOpacity }]} />
      <T variant="caption" color={Palette.textDim}>
        {catName}
      </T>
      <T variant="display" color={Palette.white} style={{ fontSize: 24, marginTop: 8, textAlign: 'center' }}>
        {t('live.winnerIs')}
      </T>
      <Animated.Text
        style={{
          fontFamily: Font.screamer,
          color: Palette.primary,
          fontSize: 170,
          marginTop: Space.md,
          opacity: countAnim,
          transform: [{ scale: numScale }],
        }}>
        {count}
      </Animated.Text>
    </View>
  );
}

function WinnerBig({
  passage,
  side,
  catName,
  size,
  anim,
}: {
  passage: Passage;
  side: 'a' | 'b';
  catName: string;
  size: number;
  anim: Animated.Value;
}) {
  const name = side === 'a' ? passage.side_a_name : passage.side_b_name;
  const color = side === 'a' ? passage.side_a_color : passage.side_b_color;
  const photo = side === 'a' ? passage.side_a_photo : passage.side_b_photo;
  const flag = flagEmoji(side === 'a' ? passage.side_a_country : passage.side_b_country);
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  const t = useT();

  return (
    <Animated.View style={[styles.center, { opacity: anim, transform: [{ scale }] }]}>
      <T variant="caption" color={color}>
        {catName} · {t('live.winner')}
      </T>
      <View style={{ marginTop: Space.lg }}>
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={{ width: size, height: size, borderRadius: Radius.xl, borderWidth: 4, borderColor: color }}
            resizeMode="cover"
          />
        ) : (
          <View
            style={{
              width: size,
              height: size,
              borderRadius: Radius.xl,
              borderWidth: 4,
              borderColor: color,
              backgroundColor: color + '1A',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Vitruve size={size * 0.6} color={color} />
          </View>
        )}
        <View style={[styles.trophy, { backgroundColor: color }]}>
          <Ionicons name="trophy" size={26} color={Palette.black} />
        </View>
      </View>
      <T
        variant="display"
        color={Palette.white}
        style={{ fontSize: Math.min(size * 0.22, 64), marginTop: Space.xl, textAlign: 'center', paddingHorizontal: Space.lg }}>
        {flag ? `${flag} ` : ''}
        {name}
      </T>
      <View style={[styles.winnerPill, { backgroundColor: color }]}>
        <T variant="label" color={textOn(color)} style={{ fontSize: 15 }}>
          Vainqueur
        </T>
      </View>
    </Animated.View>
  );
}

function statusShort(s: string, t: (k: string) => string): string {
  return { draft: t('live.prep'), open: t('live.live'), locked: t('live.counting'), revealed: t('live.result') }[s] ?? '';
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.bg, paddingHorizontal: Space.lg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  flashLeft: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '50%' },
  flashRight: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '50%' },
  card: { flex: 1, marginTop: Space.md, borderRadius: Radius.xl, overflow: 'hidden', backgroundColor: '#0E0E0E' },
  photos: { flex: 1, flexDirection: 'row', position: 'relative' },
  teamPhoto: { flex: 1, height: '100%' },
  teamPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    marginTop: Space.md,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  nameBar: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, padding: Space.md },
  pill: {
    flex: 1,
    borderRadius: Radius.pill,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
  },
  vs: { paddingHorizontal: 4 },
  statusRow: { alignItems: 'center', paddingBottom: Space.md, minHeight: 40, justifyContent: 'center' },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.live,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: Radius.pill,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff', marginRight: 8 },
  trophy: {
    position: 'absolute',
    bottom: -14,
    alignSelf: 'center',
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Palette.bg,
  },
  winnerPill: { marginTop: Space.xl, paddingVertical: 8, paddingHorizontal: 20, borderRadius: Radius.pill },
  ticker: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Space.md,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  tickerTag: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spectator: {
    paddingHorizontal: Space.md,
    paddingBottom: Space.md,
    paddingTop: Space.sm,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  meter: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    marginTop: 6,
    backgroundColor: Palette.surface,
  },
  voteRow: { flexDirection: 'row', gap: Space.sm, marginTop: Space.md },
  voteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: Radius.pill,
    paddingVertical: 12,
  },
});
