import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppSwitcher } from '@/components/AppSwitcher';
import { InstallPrompt } from '@/components/InstallPrompt';
import { Vitruve, Wordmark } from '@/components/Logo';
import {
  Card,
  LiveBadge,
  Progress,
  Screen,
  Section,
  T,
  Tag,
} from '@/components/ui';
import { JD_COORDS, JD_TAGLINE, Palette, Radius, Space } from '@/constants/brand';
import { ThemeColors } from '@/constants/theme';
import { countryFlag } from '@/lib/countries';
import { EventRow, getEvents, getMyRegistrationsFull, getNextEvent } from '@/lib/jdlive';
import { useT } from '@/lib/i18n';
import { getMyProfile, Profile as ProfileRow } from '@/lib/profile';
import { getActiveLive, LiveStream, subscribeLive } from '@/lib/streaming';
import { useColors } from '@/lib/theme';
import { getMyTickets } from '@/lib/tickets';
import { flagEmoji, getEventPassageCards, PassageCard } from '@/lib/vote';

// Événement affiché tant que la base n'en renvoie aucun (premier lancement).
const FALLBACK_EVENT = {
  title: 'Juste Debout World Final',
  city: 'Paris',
  country: 'France',
  venue: 'Bientôt annoncé',
  starts_on: null,
  ends_on: null,
  status: 'upcoming',
} as const;

function eventDateLabel(start: string | null, end: string | null): string {
  if (!start) return 'Date à venir';
  const s = new Date(start);
  if (end && end !== start) {
    const e = new Date(end);
    return `${s.getDate()}–${e.getDate()} ${e.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;
  }
  return s.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function passageStatusLabel(s: string, t: (k: string) => string): string {
  return { draft: t('home.psDraft'), open: t('home.psOpen'), locked: t('home.psLocked'), revealed: t('home.psRevealed') }[s] ?? s;
}

function profileCompleteness(p: ProfileRow | null): number {
  const fields = [p?.full_name, p?.alias, p?.country, p?.city, p?.bio, p?.styles?.length ? 'x' : '', p?.photo_url];
  return fields.filter(Boolean).length / fields.length;
}

const isFinale = (title?: string | null) => /finale/i.test(title ?? '');

const pillars: {
  tkey?: string;
  label?: string; // noms propres / marque (identiques dans toutes les langues)
  icon: keyof typeof Ionicons.glyphMap;
  emoji: string; // repère coloré (plus vivant que l'icône mono) — voulu par l'utilisateur
  route?: string;
}[] = [
  { tkey: 'home.pTour', icon: 'earth', emoji: '🌍', route: '/tour' },
  { tkey: 'home.pLive', icon: 'radio', emoji: '🎙️', route: '/direct' },
  { tkey: 'home.pPredictions', icon: 'analytics', emoji: '🔮', route: '/pronostics' },
  { label: 'JD School', icon: 'library', emoji: '🎓', route: '/school' },
  { tkey: 'home.pTickets', icon: 'ticket', emoji: '🎟️', route: '/wallet' },
  // Formations & Masterclass retirées de l'app JD (destinées à l'app JD School / futur JD+).
  { label: 'Job Board', icon: 'briefcase', emoji: '💼', route: '/jobs' },
  { tkey: 'home.pPassport', icon: 'ribbon', emoji: '🛂', route: '/passport' },
  { label: 'Hall of Fame', icon: 'trophy', emoji: '🏆', route: '/hall-of-fame' },
  { label: 'Fantasy JD', icon: 'game-controller', emoji: '🎮', route: '/fantasy' },
];

export default function Home() {
  const router = useRouter();
  const c = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);

  // Prochain événement réel (Supabase), avec repli tant que la base est vide.
  const [event, setEvent] = useState<EventRow | typeof FALLBACK_EVENT>(FALLBACK_EVENT);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [passages, setPassages] = useState<PassageCard[]>([]);
  // État réel de l'utilisateur pour la checklist « Bien démarrer ».
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [regCount, setRegCount] = useState(0);
  const [ticketCount, setTicketCount] = useState(0);
  const [live, setLive] = useState<LiveStream | null>(null);

  // Direct en cours (temps réel).
  useEffect(() => {
    getActiveLive().then(setLive).catch(() => setLive(null));
    const unsub = subscribeLive(() => getActiveLive().then(setLive).catch(() => setLive(null)));
    return unsub;
  }, []);

  useFocusEffect(
    useCallback(() => {
      getNextEvent()
        .then((e) => {
          setEvent(e ?? FALLBACK_EVENT);
          if (e?.id) {
            getEventPassageCards(e.id)
              // On n'affiche que les rencontres actives (ouvertes, verrouillées, révélées).
              .then((ps) => setPassages(ps.filter((p) => p.status !== 'draft')))
              .catch(() => setPassages([]));
          } else {
            setPassages([]);
          }
        })
        .catch(() => setEvent(FALLBACK_EVENT));
      getEvents().then(setEvents).catch(() => setEvents([]));
      getMyProfile().then(setProfile).catch(() => {});
      getMyRegistrationsFull().then((r) => setRegCount(r.length)).catch(() => setRegCount(0));
      getMyTickets().then((t) => setTicketCount(t.length)).catch(() => setTicketCount(0));
    }, []),
  );
  const heroId = 'id' in event ? event.id : null;
  const railEvents = events.filter((e) => e.status !== 'done' && e.id !== heroId);

  // Checklist d'onboarding — dérivée du vrai état.
  const checklist: { label: string; done: boolean; route: string }[] = [
    { label: t('home.ckProfile'), done: profileCompleteness(profile) >= 0.85, route: '/edit-profile' },
    { label: t('home.ckRegister'), done: regCount > 0, route: '/register' },
    { label: t('home.ckTicket'), done: ticketCount > 0, route: '/wallet' },
    { label: t('home.ckSchool'), done: !!profile?.available_for_school, route: '/school' },
  ];
  const checklistDone = checklist.filter((i) => i.done).length;

  return (
    <Screen>
      {/* HEADER — wordmark officiel */}
      <View style={styles.header}>
        <View>
          <Wordmark height={30} color={c.text} />
          <T variant="caption" color={c.accent} style={{ marginTop: 6 }}>
            {JD_TAGLINE}
          </T>
        </View>
        <Pressable style={styles.avatarBtn} onPress={() => router.push('/profile')}>
          <Vitruve size={26} color={c.accent} />
        </Pressable>
      </View>

      {/* Bascule JD ↔ JD School */}
      <AppSwitcher current="jd" />

      <InstallPrompt />

      {/* Bannière DIRECT — visible seulement pendant une diffusion */}
      {live ? (
        <Pressable onPress={() => router.push('/watch')} style={styles.liveBanner}>
          <View style={styles.liveDot} />
          <View style={{ flex: 1 }}>
            <T variant="label" color={c.white} style={{ fontSize: 13, letterSpacing: 1 }}>
              {t('home.liveNow')}
            </T>
            <T variant="small" color={c.white} numberOfLines={1} style={{ opacity: 0.9 }}>
              {live.title}
            </T>
          </View>
          <Ionicons name="play-circle" size={26} color={c.white} />
        </Pressable>
      ) : null}

      {/* HERO — prochain événement, orienté « ville » */}
      <View style={styles.hero}>
        <View style={styles.accentBar}>
          <View style={styles.accentFuchsia} />
        </View>
        <View style={styles.vitruveWatermark} pointerEvents="none">
          <Vitruve size={220} color={Palette.primary} opacity={0.05} />
        </View>

        <View style={styles.heroTop}>
          <T variant="caption" color={Palette.primary}>
            {event.status === 'live' ? t('home.liveNow') : t('home.nextDate')}
          </T>
          <T style={{ fontSize: 30, lineHeight: 34 }}>{countryFlag(event.country)}</T>
        </View>

        <T variant="title" color={c.white} style={styles.heroCity} numberOfLines={1}>
          {event.city ?? event.title ?? 'Juste Debout'}
        </T>
        <T variant="small" color={c.textDim} style={{ marginTop: 6 }}>
          {[isFinale(event.title) ? t('home.worldFinals') : t('home.worldPresel'), event.country]
            .filter(Boolean)
            .join(' · ')}
        </T>

        <View style={styles.heroDate}>
          <Ionicons name="calendar-outline" size={15} color={Palette.primary} />
          <T variant="small" color={c.textDim} style={{ marginLeft: 8, fontWeight: '700' }}>
            {eventDateLabel(event.starts_on, event.ends_on)}
          </T>
        </View>

        <Pressable style={styles.jsuis} onPress={() => router.push('/register')}>
          <T variant="label" color={c.black} style={{ fontSize: 14 }}>
            {t('home.imIn')}
          </T>
          <Ionicons name="arrow-forward" size={16} color={c.black} style={{ marginLeft: 6 }} />
        </Pressable>
      </View>

      {/* SAISON — carrousel des villes */}
      {railEvents.length > 0 && (
        <Section title={t('home.season')} action={t('home.worldMap')} onAction={() => router.push('/tour')}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {railEvents.map((e) => {
              const fin = isFinale(e.title);
              return (
                <Pressable
                  key={e.id}
                  onPress={() => router.push('/register')}
                  style={[styles.cityCard, fin && styles.cityCardFinal]}>
                  <T style={{ fontSize: 26, lineHeight: 30 }}>{countryFlag(e.country)}</T>
                  <T variant="h3" style={{ marginTop: 10, textTransform: 'uppercase' }} numberOfLines={1}>
                    {e.city ?? e.title}
                  </T>
                  <T variant="caption" color={c.textMute} style={{ marginTop: 3 }}>
                    {eventDateLabel(e.starts_on, e.ends_on)}
                  </T>
                  <View style={[styles.cityTag, fin ? styles.cityTagFin : styles.cityTagPre]}>
                    <T variant="caption" color={fin ? c.black : c.textMute} style={{ fontSize: 9, letterSpacing: 1 }}>
                      {fin ? t('home.finalsUpper') : t('home.preselUpper')}
                    </T>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </Section>
      )}

      {/* RENCONTRES EN DIRECT — uniquement pendant un JD en cours (événement live) */}
      {event.status === 'live' && passages.length > 0 && (
        <Section title={t('home.liveMatches')} action={t('home.seeLive')} onAction={() => router.push('/live')}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {passages.map((p) => {
              const live = p.status === 'open' || p.status === 'locked';
              const aWon = p.winner === 'a';
              const bWon = p.winner === 'b';
              return (
                <View key={p.id} style={styles.passageCard}>
                  <View style={styles.rowBetween}>
                    <Tag label={p.category_name ?? t('home.passage')} color={c.accent} />
                    {live ? (
                      <LiveBadge />
                    ) : (
                      <T variant="caption" color={c.textMute}>
                        {p.round ?? passageStatusLabel(p.status, t)}
                      </T>
                    )}
                  </View>
                  <View style={styles.passageVs}>
                    <View style={{ alignItems: 'center', flex: 1, opacity: bWon ? 0.45 : 1 }}>
                      <T variant="h1" style={{ fontSize: 26 }}>
                        {flagEmoji(p.side_a_country)}
                      </T>
                      <T variant="h3" numberOfLines={1}>
                        {p.side_a_name}
                      </T>
                      {aWon && <Ionicons name="trophy" size={16} color={c.accent} style={{ marginTop: 4 }} />}
                    </View>
                    <T variant="data" color={c.textMute}>
                      VS
                    </T>
                    <View style={{ alignItems: 'center', flex: 1, opacity: aWon ? 0.45 : 1 }}>
                      <T variant="h1" style={{ fontSize: 26 }}>
                        {flagEmoji(p.side_b_country)}
                      </T>
                      <T variant="h3" numberOfLines={1}>
                        {p.side_b_name}
                      </T>
                      {bWon && <Ionicons name="trophy" size={16} color={c.accent} style={{ marginTop: 4 }} />}
                    </View>
                  </View>
                  <T variant="caption" color={c.textMute} style={{ textAlign: 'center' }}>
                    {p.round ?? passageStatusLabel(p.status, t)}
                  </T>
                </View>
              );
            })}
          </ScrollView>
        </Section>
      )}

      {/* BIEN DÉMARRER (réel — dérivé de l'état de l'utilisateur) — masqué une fois tout complété */}
      {checklistDone < checklist.length && (
        <Section title={t('home.getStarted')}>
          <Card>
            <View style={styles.rowBetween}>
              <T variant="small" color={c.textDim}>
                {t('home.yourProgress')}
              </T>
              <T variant="small" color={c.accent}>
                {checklistDone}/{checklist.length}
              </T>
            </View>
            <View style={{ marginTop: Space.sm, marginBottom: Space.md }}>
              <Progress value={checklistDone / checklist.length} color={c.accent} />
            </View>
            {checklist.map((it, i) => (
              <Pressable
                key={it.label}
                onPress={() => router.push(it.route as never)}
                style={[styles.checkRow, i > 0 && styles.divider]}>
                <View style={[styles.checkDot, it.done && styles.checkDotOn]}>
                  {it.done && <Ionicons name="checkmark" size={14} color={c.black} />}
                </View>
                <T variant="h3" color={it.done ? c.textDim : c.text} style={{ flex: 1 }}>
                  {it.label}
                </T>
                {!it.done && <Ionicons name="chevron-forward" size={18} color={c.textMute} />}
              </Pressable>
            ))}
          </Card>
        </Section>
      )}

      {/* EXPLORER */}
      <Section title={t('home.explore')}>
        <View style={styles.grid}>
          {pillars.map((p) => (
            <Pressable
              key={p.tkey ?? p.label}
              style={styles.gridItem}
              onPress={() => p.route && router.push(p.route as never)}>
              <View style={styles.emojiTile}>
                <T style={styles.emojiGlyph}>{p.emoji}</T>
              </View>
              <T variant="label" color={c.textDim} style={{ marginTop: 8, textAlign: 'center' }} numberOfLines={2}>
                {p.tkey ? t(p.tkey) : p.label}
              </T>
            </Pressable>
          ))}
        </View>
      </Section>

      {/* JD+ */}
      <Section title={t('home.levelUp')}>
        <View style={styles.jdplus}>
          <View style={styles.vitruveWatermark} pointerEvents="none">
            <Vitruve size={150} color={Palette.primary} opacity={0.05} />
          </View>
          <T variant="title" color={Palette.primary} style={{ fontSize: 40 }}>
            JD+
          </T>
          <T variant="small" color={c.textDim} style={{ marginTop: 4, marginRight: 40 }}>
            {t('home.jdplusDesc')}
          </T>
          <View style={styles.jdplusBtn}>
            <T variant="label" color={c.black}>
              {t('common.soon')}
            </T>
          </View>
        </View>
      </Section>

      <View style={{ height: Space.md }} />
      <T variant="caption" color={c.textMute} style={{ textAlign: 'center' }}>
        JUSTE DEBOUT · APP V1.0 · {JD_COORDS}
      </T>
    </Screen>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  liveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    backgroundColor: Palette.sideFuchsia,
    borderRadius: Radius.lg,
    paddingVertical: 12,
    paddingHorizontal: Space.lg,
    marginBottom: Space.md,
  },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Space.sm,
    marginBottom: Space.md,
  },
  avatarBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    backgroundColor: '#0E0E0E',
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: Radius.xl,
    padding: Space.xl,
    overflow: 'hidden',
  },
  vitruveWatermark: { position: 'absolute', right: -30, top: -20 },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    backgroundColor: Palette.primary,
    borderTopLeftRadius: Radius.xl,
    borderBottomLeftRadius: Radius.xl,
    overflow: 'hidden',
  },
  accentFuchsia: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%', backgroundColor: Palette.sideFuchsia },
  heroCity: { marginTop: Space.lg, fontSize: 46, letterSpacing: -1, textTransform: 'uppercase' },
  heroDate: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Space.lg,
    paddingTop: Space.md,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  jsuis: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: Palette.primary,
    paddingVertical: 13,
    paddingHorizontal: 22,
    borderRadius: Radius.pill,
    marginTop: Space.lg,
  },
  cityCard: {
    width: 158,
    marginRight: Space.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: Radius.lg,
    padding: Space.lg,
  },
  cityCardFinal: { borderColor: c.primary },
  cityTag: { alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, marginTop: Space.md },
  cityTagPre: { backgroundColor: c.surface2 },
  cityTagFin: { backgroundColor: c.primary },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.primary,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.black, marginRight: 6 },
  ticket: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.primary,
    borderRadius: Radius.md,
    padding: Space.md,
    marginTop: Space.lg,
  },
  ticketBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.black,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
  },
  passageCard: {
    width: 240,
    marginRight: Space.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: Radius.lg,
    padding: Space.lg,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  passageVs: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: Space.md,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: { width: '25%', alignItems: 'center', marginBottom: Space.xl },
  emojiTile: {
    width: 58,
    height: 58,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiGlyph: { fontSize: 30, lineHeight: 36 },
  challengeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Space.md },
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: Space.md },
  checkDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: c.textMute,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDotOn: { backgroundColor: c.primary, borderColor: c.primary },
  divider: { borderTopWidth: 1, borderTopColor: c.borderSoft },
  jdplus: {
    backgroundColor: '#0E0E0E',
    borderWidth: 1,
    borderColor: c.primary,
    borderRadius: Radius.lg,
    padding: Space.xl,
    overflow: 'hidden',
  },
  jdplusBtn: {
    backgroundColor: c.primary,
    alignSelf: 'flex-start',
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: Radius.pill,
    marginTop: Space.lg,
  },
});
