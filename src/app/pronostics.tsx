/**
 * Pronostics JD — prédire les champions de chaque discipline + classement des pronostiqueurs.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Card, Chip, PageHeader, Screen, Section, T, Tag } from '@/components/ui';
import { Space } from '@/constants/brand';
import { ThemeColors } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { EventRow, getNextEvent } from '@/lib/jdlive';
import { getMyPredictionStats } from '@/lib/livemedia';
import {
  castChampionPrediction,
  getFinaleWinners,
  getMyChampionPredictions,
  getMyChampionScore,
  getPronostiqueurs,
  getStartlist,
  Pronostiqueur,
  StartlistCategory,
} from '@/lib/pronostics';
import { useColors } from '@/lib/theme';

export default function Pronostics() {
  const c = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();

  const [event, setEvent] = useState<EventRow | null>(null);
  const [cats, setCats] = useState<StartlistCategory[]>([]);
  const [picks, setPicks] = useState<Map<string, string>>(new Map());
  const [winners, setWinners] = useState<Map<string, Set<string>>>(new Map());
  const [board, setBoard] = useState<Pronostiqueur[]>([]);
  const [passStats, setPassStats] = useState({ total: 0, correct: 0 });
  const [champStats, setChampStats] = useState({ total: 0, correct: 0 });
  const [loading, setLoading] = useState(true);

  const loadEventData = (eventId: string) => {
    getStartlist(eventId).then(setCats).catch(() => setCats([]));
    getMyChampionPredictions(eventId).then(setPicks).catch(() => setPicks(new Map()));
    getFinaleWinners(eventId).then(setWinners).catch(() => setWinners(new Map()));
  };

  useFocusEffect(
    useCallback(() => {
      getNextEvent()
        .then((e) => {
          setEvent(e);
          if (e?.id) loadEventData(e.id);
        })
        .catch(() => setEvent(null))
        .finally(() => setLoading(false));
      getPronostiqueurs().then(setBoard).catch(() => setBoard([]));
      getMyPredictionStats().then(setPassStats).catch(() => {});
      getMyChampionScore().then(setChampStats).catch(() => {});
    }, []),
  );

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    cats.forEach((cat) => cat.dancers.forEach((d) => m.set(d.id, d.alias || d.full_name || t('profile.dancer'))));
    return m;
  }, [cats]);

  const totalCorrect = passStats.correct + champStats.correct;
  const totalResolved = passStats.total + champStats.total;
  const accuracy = totalResolved ? Math.round((totalCorrect / totalResolved) * 100) : 0;

  const pick = async (categoryId: string, dancerId: string) => {
    if (!event?.id) return;
    const prev = picks;
    setPicks((cur) => new Map(cur).set(categoryId, dancerId));
    try {
      await castChampionPrediction(event.id, categoryId, dancerId);
    } catch {
      /* RLS refuse si la finale est déjà révélée → rollback de la mise à jour optimiste */
      setPicks(prev);
    }
  };

  if (loading) {
    return (
      <Screen scroll={false}>
        <PageHeader title={t('pronostics.title')} subtitle="JD Live+" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={c.accent} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader title={t('pronostics.title')} subtitle={event?.title ?? 'JD Live+'} />

      {/* Mes stats */}
      <Card>
        <View style={styles.statsRow}>
          <Stat value={`${totalCorrect}`} label={t('pronostics.correct')} color={c.success} />
          <View style={styles.vline} />
          <Stat value={`${totalResolved}`} label={t('pronostics.resolved')} color={c.text} />
          <View style={styles.vline} />
          <Stat value={`${accuracy}%`} label={t('pronostics.accuracy')} color={c.accent} />
        </View>
        <Pressable onPress={() => router.push('/direct')} style={{ marginTop: Space.md, alignItems: 'center' }}>
          <T variant="caption" color={c.accent}>
            {t('pronostics.byPassage')}
          </T>
        </Pressable>
      </Card>

      {/* Pronostics champions */}
      <Section title={t('pronostics.champions')}>
        {cats.length === 0 ? (
          <Card>
            <T variant="small" color={c.textDim}>
              {t('pronostics.noStartlist')}
            </T>
          </Card>
        ) : (
          cats.map((cat) => {
            const resolved = winners.has(cat.categoryId);
            const myPick = picks.get(cat.categoryId);
            const won = resolved && myPick ? winners.get(cat.categoryId)!.has(myPick) : false;
            return (
              <Card key={cat.categoryId} style={{ marginBottom: Space.md }}>
                <View style={styles.rowBetween}>
                  <T variant="h3">{cat.categoryName}</T>
                  {resolved ? (
                    <Tag label={myPick ? (won ? t('pronostics.won') : t('pronostics.lost')) : t('pronostics.closed')} color={won ? c.success : c.textMute} />
                  ) : (
                    <T variant="caption" color={c.accent}>
                      {t('pronostics.open')}
                    </T>
                  )}
                </View>
                {resolved ? (
                  <>
                    <T variant="small" color={c.primary} style={{ marginTop: 6 }}>
                      {t('pronostics.championLabel')} :{' '}
                      {[...(winners.get(cat.categoryId) ?? [])].map((id) => nameById.get(id) ?? '—').join(' & ')}
                    </T>
                    <T variant="small" color={c.textDim} style={{ marginTop: 4 }}>
                      {myPick ? `${t('pronostics.yourPickLabel')} : ${nameById.get(myPick) ?? '—'}` : t('pronostics.noPick')}
                    </T>
                  </>
                ) : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: Space.sm }}>
                    {cat.dancers.map((d) => (
                      <Chip
                        key={d.id}
                        label={d.alias || d.full_name || t('profile.dancer')}
                        active={myPick === d.id}
                        onPress={() => pick(cat.categoryId, d.id)}
                        color={c.accent}
                      />
                    ))}
                  </View>
                )}
              </Card>
            );
          })
        )}
      </Section>

      {/* Classement pronostiqueurs */}
      <Section title={t('pronostics.topForecasters')}>
        {board.length === 0 ? (
          <Card>
            <T variant="small" color={c.textDim}>
              {t('pronostics.boardEmpty')}
            </T>
          </Card>
        ) : (
          board.map((p, i) => {
            const name = p.alias || p.full_name || t('pronostics.forecaster');
            const pct = p.total ? Math.round((p.correct / p.total) * 100) : 0;
            return (
              <Card key={p.profile_id} style={styles.boardRow} onPress={() => router.push(`/dancer/${p.profile_id}` as never)}>
                <T variant="h3" color={i < 3 ? c.primary : c.textMute} style={{ width: 30 }}>
                  {i + 1}
                </T>
                <Avatar name={name} uri={p.photo_url} color={c.accent} size={40} />
                <View style={{ flex: 1, marginLeft: Space.md }}>
                  <T variant="h3" numberOfLines={1}>
                    {name}
                  </T>
                  <T variant="caption" color={c.textMute}>
                    {p.correct}/{p.total} · {pct}%
                  </T>
                </View>
                <Ionicons name="ribbon" size={18} color={i < 3 ? c.primary : c.textMute} />
              </Card>
            );
          })
        )}
      </Section>
    </Screen>
  );
}

function Stat({ value, label, color }: { value: string; label: string; color: string }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <T variant="h1" color={color}>
        {value}
      </T>
      <T variant="caption" color={c.textMute} style={{ marginTop: 2 }}>
        {label}
      </T>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    statsRow: { flexDirection: 'row', alignItems: 'center' },
    vline: { width: 1, height: 34, backgroundColor: c.borderSoft },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    boardRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Space.md },
  });
