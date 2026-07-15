/**
 * JD Live+ — « Direct », le second écran spectateur.
 * Avant-match : pronostic. Pendant : fil commenté en temps réel. Après : note + débrief.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Card, PageHeader, Screen, Section, T } from '@/components/ui';
import { Radius, Space } from '@/constants/brand';
import { ThemeColors } from '@/constants/theme';
import { EventRow, getNextEvent } from '@/lib/jdlive';
import {
  castPrediction,
  Commentary,
  getCommentaries,
  getMyPrediction,
  getMyRating,
  getPredictionTally,
  getRatingSummary,
  MyRating,
  ratePassage,
  RatingSummary,
  Side,
  subscribeCommentaries,
} from '@/lib/livemedia';
import { useT } from '@/lib/i18n';
import { useColors } from '@/lib/theme';
import { flagEmoji, getCurrentPassage, getPublicTally, Passage } from '@/lib/vote';

export default function Direct() {
  const c = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();

  const [event, setEvent] = useState<EventRow | null>(null);
  const [passage, setPassage] = useState<Passage | null>(null);
  const [feed, setFeed] = useState<Commentary[]>([]);
  const [myPred, setMyPred] = useState<Side | null>(null);
  const [predTally, setPredTally] = useState({ a: 0, b: 0, total: 0 });
  const [myRating, setMyRating] = useState<MyRating | null>(null);
  const [ratingSum, setRatingSum] = useState<RatingSummary>({ avg: 0, count: 0, mvpA: 0, mvpB: 0 });
  const [adhesion, setAdhesion] = useState({ a: 0, b: 0, total: 0 });
  const feedRef = useRef<ScrollView>(null);

  useFocusEffect(
    useCallback(() => {
      getNextEvent().then(setEvent).catch(() => setEvent(null));
    }, []),
  );

  // Fil temps réel + rafraîchissement du passage courant.
  useEffect(() => {
    if (!event?.id) return;
    const evId = event.id;
    getCommentaries(evId).then(setFeed).catch(() => setFeed([]));
    const unsub = subscribeCommentaries(evId, (nc) => {
      setFeed((cur) => [...cur, nc]);
      setTimeout(() => feedRef.current?.scrollToEnd({ animated: true }), 60);
    });
    const load = () => getCurrentPassage(evId).then(setPassage).catch(() => setPassage(null));
    load();
    const t = setInterval(load, 4000);
    return () => {
      unsub();
      clearInterval(t);
    };
  }, [event?.id]);

  // Données liées au passage courant (pronostic, notes, adhésion).
  useEffect(() => {
    if (!passage?.id) return;
    const id = passage.id;
    getMyPrediction(id).then(setMyPred).catch(() => {});
    getPredictionTally(id).then(setPredTally).catch(() => {});
    getPublicTally(id).then(setAdhesion).catch(() => {});
    if (passage.status === 'revealed') {
      getMyRating(id).then(setMyRating).catch(() => {});
      getRatingSummary(id).then(setRatingSum).catch(() => {});
    }
  }, [passage?.id, passage?.status]);

  const predict = async (side: Side) => {
    if (!passage) return;
    setMyPred(side);
    try {
      await castPrediction(passage.id, side);
      setPredTally(await getPredictionTally(passage.id));
    } catch {
      /* ignore */
    }
  };

  const rate = async (stars: number) => {
    if (!passage) return;
    setMyRating({ stars, mvp_side: myRating?.mvp_side ?? null });
    try {
      await ratePassage(passage.id, stars, myRating?.mvp_side ?? null);
      setRatingSum(await getRatingSummary(passage.id));
    } catch {
      /* ignore */
    }
  };

  const revealed = passage?.status === 'revealed';
  const decided = revealed && (passage?.winner === 'a' || passage?.winner === 'b');
  const canPredict = passage && (passage.status === 'draft' || passage.status === 'open');
  const predPct = predTally.total ? predTally.a / predTally.total : 0.5;
  const winnerName = passage
    ? passage.winner === 'a'
      ? passage.side_a_name
      : passage.winner === 'b'
        ? passage.side_b_name
        : null
    : null;

  return (
    <Screen>
      <PageHeader title={t('home.pLive')} subtitle={event?.title ?? 'JD Live+'} />

      <Pressable onPress={() => router.push('/live')} style={styles.liveLink}>
        <Ionicons name="tv" size={16} color={c.black} />
        <T variant="label" color={c.black} style={{ marginLeft: 6 }}>
          {t('direct.seeLiveVote')}
        </T>
      </Pressable>

      {!passage ? (
        <Card style={{ marginTop: Space.md }}>
          <T variant="small" color={c.textDim}>
            {t('direct.waiting')}
          </T>
        </Card>
      ) : (
        <>
          {/* En-tête du passage */}
          <Card style={{ marginTop: Space.md }}>
            <T variant="caption" color={c.accent}>
              {passage.round ?? t('home.passage')}
            </T>
            <View style={styles.vsRow}>
              <T variant="h3" style={{ flex: 1 }} numberOfLines={2}>
                {flagEmoji(passage.side_a_country)} {passage.side_a_name}
              </T>
              <T variant="data" color={c.textMute}>
                VS
              </T>
              <T variant="h3" style={{ flex: 1, textAlign: 'right' }} numberOfLines={2}>
                {passage.side_b_name} {flagEmoji(passage.side_b_country)}
              </T>
            </View>
          </Card>

          {/* AVANT-MATCH — pronostic */}
          {!revealed && (
            <Section title={t('pronostics.yourPickLabel')}>
              <Card>
                <View style={{ flexDirection: 'row', gap: Space.sm }}>
                  {(['a', 'b'] as Side[]).map((side) => {
                    const name = side === 'a' ? passage.side_a_name : passage.side_b_name;
                    const color = side === 'a' ? passage.side_a_color : passage.side_b_color;
                    const mine = myPred === side;
                    return (
                      <Pressable
                        key={side}
                        onPress={() => canPredict && predict(side)}
                        disabled={!canPredict}
                        style={[styles.predBtn, { borderColor: color, backgroundColor: mine ? color : 'transparent' }]}>
                        {mine && <Ionicons name="checkmark-circle" size={16} color={c.black} style={{ marginRight: 6 }} />}
                        <T variant="label" color={mine ? c.black : c.text} numberOfLines={1}>
                          {name}
                        </T>
                      </Pressable>
                    );
                  })}
                </View>
                {predTally.total > 0 && (
                  <>
                    <View style={styles.meter}>
                      <View style={{ flex: Math.max(predPct, 0.001), backgroundColor: passage.side_a_color }} />
                      <View style={{ flex: Math.max(1 - predPct, 0.001), backgroundColor: passage.side_b_color }} />
                    </View>
                    <T variant="caption" color={c.textMute} style={{ marginTop: 6, textAlign: 'center' }}>
                      {t('direct.preds', { n: predTally.total })} · {Math.round(predPct * 100)}% / {Math.round((1 - predPct) * 100)}%
                    </T>
                  </>
                )}
              </Card>
            </Section>
          )}

          {/* APRÈS-MATCH — débrief + note */}
          {decided && (
            <Section title={t('direct.debrief')}>
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="trophy" size={20} color={c.accent} />
                  <T variant="h3" style={{ marginLeft: Space.md, flex: 1 }}>
                    {winnerName}
                  </T>
                </View>
                <T variant="small" color={c.textDim} style={{ marginTop: Space.sm }}>
                  {t('direct.publicSupport')} :{' '}
                  {adhesion.total
                    ? `${Math.round(((passage.winner === 'a' ? adhesion.a : adhesion.b) / adhesion.total) * 100)}% ${t('direct.forWinner')}`
                    : t('direct.noPublicVote')}
                  {myPred ? ` · ${t('direct.yourPredLabel')} : ${myPred === passage.winner ? t('direct.predWon') : t('direct.predLost')}` : ''}
                </T>

                {/* Note du public */}
                <T variant="caption" color={c.textMute} style={{ marginTop: Space.lg }}>
                  {t('direct.ratePassage')}
                </T>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable key={n} onPress={() => rate(n)} hitSlop={6}>
                      <Ionicons
                        name={(myRating?.stars ?? 0) >= n ? 'star' : 'star-outline'}
                        size={30}
                        color={c.accent}
                      />
                    </Pressable>
                  ))}
                </View>
                {ratingSum.count > 0 && (
                  <T variant="caption" color={c.textMute} style={{ marginTop: 8 }}>
                    {t('direct.average')} {ratingSum.avg.toFixed(1)}/5 · {t('direct.ratings', { n: ratingSum.count })}
                  </T>
                )}
              </Card>
            </Section>
          )}

          {/* LE FIL COMMENTÉ (temps réel) */}
          <Section title={t('direct.liveFeed')}>
            <Card>
              <ScrollView ref={feedRef} style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
                {feed.length === 0 ? (
                  <T variant="small" color={c.textMute}>
                    {t('direct.notStarted')}
                  </T>
                ) : (
                  feed.map((cm) => (
                    <View key={cm.id} style={styles.feedLine}>
                      <View style={[styles.feedDot, { backgroundColor: cm.kind === 'ai' ? c.cyan : c.primary }]} />
                      <View style={{ flex: 1 }}>
                        <T variant="small" color={c.text}>
                          {cm.text}
                        </T>
                        <T variant="caption" color={c.textMute} style={{ marginTop: 2 }}>
                          {cm.kind === 'ai' ? 'Flow' : t('direct.commentator')}
                        </T>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            </Card>
          </Section>
        </>
      )}
    </Screen>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    liveLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primary,
      borderRadius: Radius.pill,
      paddingVertical: 12,
      marginTop: Space.sm,
    },
    vsRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, marginTop: Space.sm },
    predBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderRadius: Radius.pill,
      paddingVertical: 12,
    },
    meter: {
      flexDirection: 'row',
      height: 12,
      borderRadius: 6,
      overflow: 'hidden',
      marginTop: Space.md,
      backgroundColor: c.surface,
    },
    feedLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 },
    feedDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  });
