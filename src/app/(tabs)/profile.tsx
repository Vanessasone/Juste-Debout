import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CertChips } from '@/components/certs';
import { Avatar, Card, GhostButton, Progress, Section, T, Tag } from '@/components/ui';
import { Gradients, Palette, Radius, Space } from '@/constants/brand';
import { ThemeColors } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { Certification, getMyCertifications } from '@/lib/certifications';
import { useCountUp } from '@/components/motion';
import { CoinsByApp, getCoinsBalance, getCoinsByApp } from '@/lib/coins';
import { badges as computeBadges, countsFrom, quests as computeQuests, rankFor } from '@/lib/gamification';
import { useT } from '@/lib/i18n';
import { getUnreadTotal } from '@/lib/messaging';
import { getMyRegistrationsFull, MyRegistration } from '@/lib/jdlive';
import { getMyPredictionStats } from '@/lib/livemedia';
import { EMPTY_PALMARES, getPalmares, Palmares } from '@/lib/palmares';
import { getMyChampionScore } from '@/lib/pronostics';
import { getMyProfile, Profile as ProfileRow } from '@/lib/profile';
import { getMyTickets, Ticket } from '@/lib/tickets';
import { useColors } from '@/lib/theme';
import { getMyPublicVoteCount } from '@/lib/vote';

export default function Profile() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const t = useT();

  // Données réelles (Supabase) — rechargées à chaque retour sur l'onglet.
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [regs, setRegs] = useState<MyRegistration[]>([]);
  const [publicVotes, setPublicVotes] = useState(0);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [palmares, setPalmares] = useState<Palmares>(EMPTY_PALMARES);
  const [predStats, setPredStats] = useState({ total: 0, correct: 0 });
  const [certs, setCerts] = useState<Certification[]>([]);
  const [unread, setUnread] = useState(0);
  const [coins, setCoins] = useState(0);
  const [coinsByApp, setCoinsByApp] = useState<CoinsByApp>({ total: 0, jd: 0, school: 0 });
  useFocusEffect(
    useCallback(() => {
      getMyCertifications().then(setCerts).catch(() => setCerts([]));
      getUnreadTotal().then(setUnread).catch(() => setUnread(0));
      getCoinsBalance().then(setCoins).catch(() => setCoins(0));
      getCoinsByApp().then(setCoinsByApp).catch(() => setCoinsByApp({ total: 0, jd: 0, school: 0 }));
      getMyProfile()
        .then((p) => {
          setProfile(p);
          if (p?.id) getPalmares(p.id).then(setPalmares).catch(() => setPalmares(EMPTY_PALMARES));
        })
        .catch(() => {});
      getMyRegistrationsFull().then(setRegs).catch(() => setRegs([]));
      getMyPublicVoteCount().then(setPublicVotes).catch(() => setPublicVotes(0));
      getMyTickets().then(setTickets).catch(() => setTickets([]));
      Promise.all([getMyPredictionStats(), getMyChampionScore()])
        .then(([pass, champ]) =>
          setPredStats({ total: pass.total + champ.total, correct: pass.correct + champ.correct }),
        )
        .catch(() => setPredStats({ total: 0, correct: 0 }));
    }, []),
  );

  const displayName = profile?.alias || profile?.full_name || t('profile.yourProfile');
  const displayLoc = [profile?.city, profile?.country].filter(Boolean).join(', ');
  const displayStyles = profile?.styles?.length ? profile.styles : [];
  const displayBio = profile?.bio || t('profile.bioPlaceholder');
  const isStaff = !!profile?.roles?.some((r) => ['admin', 'organizer', 'staff'].includes(r));
  const isJudge = !!profile?.roles?.includes('judge');
  // Rôle « scanner » dédié (contrôle d'entrée) : accès au scanner sans les autres pouvoirs staff.
  const isScanner = isStaff || !!profile?.roles?.includes('scanner');

  // Gamification « JD Points » — dérivée d'actions réelles.
  const counts = useMemo(
    () => countsFrom({ profile, regs, publicVotes, tickets, predStats }),
    [profile, regs, publicVotes, tickets, predStats],
  );
  const coinRank = useMemo(() => rankFor(coins), [coins]); // palier dérivé du solde RÉEL
  const coinsUp = useCountUp(Math.max(0, coins)); // compteur animé (monte de 0 au solde)
  const quests = useMemo(() => computeQuests(counts), [counts]);
  const badges = useMemo(() => computeBadges(counts), [counts]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}>
        {/* Cover + avatar */}
        <LinearGradient colors={Gradients.duo} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.cover, { paddingTop: insets.top + 12 }]}>
          <View style={styles.coverTop}>
            <Pressable style={styles.iconBtn} onPress={() => router.push('/edit-profile')}>
              <Ionicons name="create" size={18} color="#fff" />
            </Pressable>
            <Pressable style={styles.iconBtn} onPress={() => router.push('/settings')}>
              <Ionicons name="settings-sharp" size={18} color="#fff" />
            </Pressable>
          </View>
        </LinearGradient>

        <View style={styles.avatarWrap}>
          <Avatar name={displayName} uri={profile?.photo_url} color={c.accent} size={92} ring />
        </View>

        <View style={{ alignItems: 'center', marginTop: 8, paddingHorizontal: Space.lg }}>
          <T variant="title">{displayName}</T>
          <T variant="small" color={c.textDim} style={{ marginTop: 2 }}>
            {[displayLoc, profile?.level].filter(Boolean).join(' · ') || t('profile.toComplete')}
          </T>
          {displayStyles.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 10 }}>
              {displayStyles.map((s) => (
                <Tag key={s} label={s} color={c.accent} />
              ))}
            </View>
          )}
          <T variant="small" color={c.textDim} style={{ textAlign: 'center', marginTop: Space.md }}>
            {displayBio}
          </T>
        </View>

        <View style={{ paddingHorizontal: Space.lg }}>
          {/* JD Coins — solde RÉEL cumulé (Juste Debout + JD School) */}
          <LinearGradient
            colors={Gradients.duo}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ marginTop: Space.lg, borderRadius: Radius.xl, padding: 18 }}>
            <View style={styles.rowBetween}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name={coinRank.icon as keyof typeof Ionicons.glyphMap} size={24} color={Palette.black} />
                <T variant="label" color={Palette.black} style={{ letterSpacing: 0.5 }}>
                  {coinRank.name}
                </T>
              </View>
              <T variant="label" color={Palette.black} style={{ opacity: 0.75 }}>
                ×{String(coinRank.mult).replace('.', ',')}
              </T>
            </View>
            <T variant="title" color={Palette.black} style={{ fontSize: 40, marginTop: 8 }}>
              {coinsUp.toLocaleString('fr-FR')}
              <T variant="h3" color={Palette.black}>
                {' '}
                {t('profile.coins')}
              </T>
            </T>
            {coinRank.next != null && (
              <>
                <View style={{ height: 8, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.18)', marginTop: 12, overflow: 'hidden' }}>
                  <View style={{ height: 8, borderRadius: 999, backgroundColor: Palette.black, width: `${Math.round(coinRank.progress * 100)}%` }} />
                </View>
                <T variant="caption" color={Palette.black} style={{ opacity: 0.85, marginTop: 6 }}>
                  {t('profile.coinsToNext', { n: coinRank.next - coins, next: coinRank.nextName })}
                </T>
              </>
            )}
            {coinsByApp.school > 0 && coinsByApp.jd > 0 ? (
              <T variant="caption" color={Palette.black} style={{ opacity: 0.85, marginTop: 8 }}>
                {t('profile.coinsSplit', { jd: coinsByApp.jd, school: coinsByApp.school })}
              </T>
            ) : null}
          </LinearGradient>

          {/* Objectifs de progression (réels) — les JD Coins, eux, sont crédités automatiquement */}
          <Section title={t('profile.objectives')}>
            <Card>
              {quests.map((q, i) => (
                <Pressable
                  key={q.id}
                  onPress={() => router.push(q.route as never)}
                  style={[styles.questRow, i > 0 && styles.divider]}>
                  <View style={[styles.questDot, q.done && styles.questDotOn]}>
                    {q.done && <Ionicons name="checkmark" size={13} color={c.black} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.rowBetween}>
                      <T variant="small" color={q.done ? c.textDim : c.text} style={{ flex: 1 }}>
                        {t(q.label)}
                      </T>
                      {q.done ? (
                        <T variant="caption" color={c.accent}>
                          {t('profile.done')}
                        </T>
                      ) : (
                        <Ionicons name="chevron-forward" size={15} color={c.textMute} />
                      )}
                    </View>
                    {!q.done && (
                      <View style={{ marginTop: 6 }}>
                        <Progress value={q.progress} color={c.accent} />
                      </View>
                    )}
                  </View>
                </Pressable>
              ))}
            </Card>
          </Section>

          {/* Mon activité (réel) */}
          <Section title={t('profile.myActivity')}>
            <Card>
              <View style={styles.statsRow}>
                <StatCol value={`${counts.events}`} label={t('profile.events')} color={c.accent} />
                <View style={styles.vline} />
                <StatCol value={`${counts.dancerRegs}`} label={t('profile.asDancer')} color={c.text} />
                <View style={styles.vline} />
                <StatCol value={`${counts.attended}`} label={t('profile.attendance')} color={c.text} />
                <View style={styles.vline} />
                <StatCol value={`${counts.publicVotes}`} label={t('profile.votes')} color={c.text} />
              </View>
            </Card>
          </Section>

          {/* Palmarès réel (via passages liés au compte) */}
          <Section title={t('profile.palmares')} action={palmares.matches > 0 ? t('profile.ranking') : undefined} onAction={() => router.push('/ranking')}>
            {palmares.matches === 0 ? (
              <Card>
                <T variant="small" color={c.textDim}>
                  {t('profile.palmaresEmpty')}
                </T>
                <Pressable onPress={() => router.push('/ranking')} style={{ marginTop: 8 }}>
                  <T variant="caption" color={c.accent}>
                    {t('profile.seeWorldRanking')}
                  </T>
                </Pressable>
              </Card>
            ) : (
              <>
                <Card>
                  <View style={styles.statsRow}>
                    <StatCol value={`${palmares.wins}`} label={t('profile.wins')} color={c.success} />
                    <View style={styles.vline} />
                    <StatCol value={`${palmares.losses}`} label={t('profile.losses')} color={c.danger} />
                    <View style={styles.vline} />
                    <StatCol value={`${palmares.winRate}%`} label={t('profile.winRate')} color={c.accent} />
                    <View style={styles.vline} />
                    <StatCol value={`${palmares.titles}`} label={t('profile.titles')} color={c.gold} />
                  </View>
                </Card>
                {palmares.recent.map((m) => {
                  const color = m.result === 'win' ? c.success : m.result === 'loss' ? c.danger : c.textMute;
                  const label = m.result === 'win' ? 'V' : m.result === 'loss' ? 'D' : '—';
                  return (
                    <Card key={m.passageId} style={{ marginTop: Space.md, flexDirection: 'row', alignItems: 'center' }}>
                      <View style={[styles.resultBadge, { borderColor: color }]}>
                        <T variant="h3" color={color}>
                          {label}
                        </T>
                      </View>
                      <View style={{ flex: 1, marginLeft: Space.md }}>
                        <T variant="h3" numberOfLines={1}>
                          vs {m.opponentName}
                        </T>
                        <T variant="caption" color={c.textMute} style={{ marginTop: 2 }}>
                          {m.round ?? t('profile.passage')}
                        </T>
                      </View>
                    </Card>
                  );
                })}
              </>
            )}
          </Section>

          {/* Certifications officielles (badges vérifiés, attribués par JD) */}
          {certs.length ? (
            <Section title={t('home.pCerts')}>
              <CertChips certs={certs} />
            </Section>
          ) : null}

          {/* Badges (dérivés du vrai état) */}
          <Section title={t('profile.badges')}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {badges.map((b) => (
                <View key={b.id} style={[styles.badge, { opacity: b.earned ? 1 : 0.32 }]}>
                  <View style={[styles.badgeCircle, { backgroundColor: c.primary + '22', borderColor: c.primary }]}>
                    <Ionicons name={b.icon as keyof typeof Ionicons.glyphMap} size={26} color={c.accent} />
                  </View>
                  <T variant="caption" color={c.textDim} style={{ textAlign: 'center', marginTop: 6, width: 78 }}>
                    {t(b.label)}
                  </T>
                </View>
              ))}
            </ScrollView>
          </Section>

          {/* Mes événements (réel) */}
          <Section title={t('profile.myEvents')} action={t('profile.register')} onAction={() => router.push('/register')}>
            {regs.length === 0 ? (
              <Card onPress={() => router.push('/register')}>
                <T variant="small" color={c.textDim}>
                  {t('profile.noEvents')}
                </T>
                <T variant="caption" color={c.accent} style={{ marginTop: 6 }}>
                  {t('profile.registerCta')}
                </T>
              </Card>
            ) : (
              regs.map((r) => (
                <Card key={r.id} style={{ marginBottom: Space.md }}>
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1, paddingRight: Space.md }}>
                      <T variant="h3" numberOfLines={1}>
                        {r.events?.title ?? t('profile.event')}
                      </T>
                      <T variant="small" color={c.textDim} style={{ marginTop: 2 }}>
                        {[r.events?.venue, r.events?.city].filter(Boolean).join(' · ') || '—'}
                      </T>
                      <T variant="caption" color={c.textMute} style={{ marginTop: 4 }}>
                        {eventDate(r.events?.starts_on ?? null, r.events?.ends_on ?? null, t)}
                      </T>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <Tag
                        label={r.type === 'dancer' ? r.categories?.name ?? t('profile.dancer') : t('profile.spectator')}
                        color={c.accent}
                      />
                      <T variant="caption" color={c.textMute}>
                        {statusLabel(r.status, t)}
                      </T>
                    </View>
                  </View>
                </Card>
              ))
            )}
          </Section>

          <View style={{ marginTop: Space.lg, gap: Space.md }}>
            <GhostButton
              label={unread > 0 ? `${t('profile.messaging')} (${unread})` : t('profile.messaging')}
              icon="chatbubbles"
              onPress={() => router.push('/messages')}
            />
            <GhostButton label={t('profile.nearby')} icon="location" onPress={() => router.push('/nearby')} />
            <GhostButton
              label={t('profile.proposeEvent')}
              icon="add-circle"
              onPress={() => router.push('/create-event?partner=1')}
            />
            <GhostButton label={t('profile.liveCommented')} icon="radio" onPress={() => router.push('/direct')} />
            <GhostButton label={t('profile.predictions')} icon="analytics" onPress={() => router.push('/pronostics')} />
            {isStaff && (
              <GhostButton label={t('profile.commentatorConsole')} icon="mic" onPress={() => router.push('/commentator')} />
            )}
            <GhostButton label={t('profile.worldRanking')} icon="podium" onPress={() => router.push('/ranking')} />
            <GhostButton label="Juste Debout School" icon="library" onPress={() => router.push('/school')} />
            <GhostButton label={t('profile.wallet')} icon="wallet" onPress={() => router.push('/wallet')} />
            <GhostButton label={t('coins.title')} icon="server" onPress={() => router.push('/coins')} />
            <GhostButton label={t('earn.title')} icon="cash" onPress={() => router.push('/earnings')} />
            {isScanner && (
              <GhostButton label={t('profile.scanner')} icon="qr-code" onPress={() => router.push('/scanner')} />
            )}
            {isStaff && (
              <GhostButton
                label={t('profile.organizer')}
                icon="albums"
                onPress={() => router.push('/organizer')}
              />
            )}
            {isStaff && (
              <GhostButton label={t('profile.regie')} icon="options" onPress={() => router.push('/regie')} />
            )}
            {isStaff && (
              <GhostButton label={t('orders.received')} icon="cube" onPress={() => router.push('/admin-orders')} />
            )}
            {isStaff && (
              <GhostButton label={t('profile.certsAdmin')} icon="ribbon" onPress={() => router.push('/admin-certs')} />
            )}
            {isStaff && (
              <GhostButton label={t('profile.partnerMod')} icon="shield-checkmark" onPress={() => router.push('/admin-events')} />
            )}
            {isStaff && (
              <GhostButton label={t('profile.liveAdmin')} icon="videocam" onPress={() => router.push('/live-admin')} />
            )}
            {isJudge && (
              <GhostButton label={t('profile.judge')} icon="hand-left" onPress={() => router.push('/judge')} />
            )}
            <GhostButton label={t('profile.editProfile')} icon="create" onPress={() => router.push('/edit-profile')} />
            <GhostButton label={t('profile.settings')} icon="settings-sharp" onPress={() => router.push('/settings')} />
            <GhostButton label={t('profile.logout')} icon="log-out" onPress={() => signOut()} />
          </View>
        </View>
      </ScrollView>

      {/* Flow flottant */}
      <Pressable style={[styles.fab, { bottom: insets.bottom + 96 }]} onPress={() => router.push('/companion' as never)}>
        <LinearGradient colors={Gradients.cyan} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabInner}>
          <Ionicons name="sparkles" size={24} color={c.black} />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

function StatCol({ value, label, color }: { value: string; label: string; color: string }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <T variant="h1" color={color}>
        {value}
      </T>
      <T variant="caption" color={c.textMute} style={{ marginTop: 2, textAlign: 'center' }}>
        {label}
      </T>
    </View>
  );
}

function statusLabel(s: string, t: (k: string) => string): string {
  return (
    { registered: t('profile.stRegistered'), confirmed: t('profile.stConfirmed'), paid: t('profile.stPaid'), cancelled: t('profile.stCancelled') }[
      s
    ] ?? s
  );
}

function eventDate(start: string | null, end: string | null, t: (k: string) => string): string {
  if (!start) return t('profile.dateTba');
  const s = new Date(start);
  if (end && end !== start) {
    const e = new Date(end);
    return `${s.getDate()}–${e.getDate()} ${e.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;
  }
  return s.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  cover: { height: 140, paddingHorizontal: Space.lg },
  coverTop: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrap: { alignItems: 'center', marginTop: -46 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  levelBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  vline: { width: 1, height: 34, backgroundColor: c.borderSoft },
  questRow: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingVertical: 12 },
  divider: { borderTopWidth: 1, borderTopColor: c.borderSoft },
  questDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: c.textMute,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questDotOn: { backgroundColor: c.primary, borderColor: c.primary },
  resultBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: { alignItems: 'center', marginRight: Space.lg },
  badgeCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: { position: 'absolute', right: Space.lg },
  fabInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: c.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 14,
    elevation: 10,
  },
});
