/**
 * Classement mondial — palmarès agrégé des danseurs (titres, victoires).
 * Alimenté par les passages liés aux comptes (fonction Postgres jd_leaderboard).
 */
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Avatar, Card, PageHeader, Screen, T } from '@/components/ui';
import { Space } from '@/constants/brand';
import { ThemeColors } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { getLeaderboard, LeaderboardRow } from '@/lib/palmares';
import { useColors } from '@/lib/theme';

export default function Ranking() {
  const c = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLeaderboard()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`);

  return (
    <Screen>
      <PageHeader title={t('profile.worldRanking')} subtitle={t('ranking.subtitle')} />

      <Card style={{ marginBottom: Space.md, backgroundColor: c.surface }}>
        <T variant="caption" color={c.textDim}>
          {t('ranking.explain')}
        </T>
      </Card>

      {loading ? (
        <ActivityIndicator color={c.accent} style={{ marginTop: Space.xl }} />
      ) : rows.length === 0 ? (
        <Card>
          <T variant="small" color={c.textDim}>
            {t('ranking.empty')}
          </T>
        </Card>
      ) : (
        rows.map((r, i) => {
          const name = r.alias || r.full_name || 'Danseur';
          return (
            <Card
              key={r.profile_id}
              onPress={() => router.push(`/dancer/${r.profile_id}` as never)}
              style={[styles.row, i < 3 && { borderColor: c.primary }]}>
              <View style={styles.rank}>
                <T variant="h3" color={i < 3 ? c.primary : c.textMute}>
                  {medal(i)}
                </T>
              </View>
              <Avatar name={name} uri={r.photo_url} color={c.accent} size={44} />
              <View style={{ flex: 1, marginLeft: Space.md }}>
                <T variant="h3" numberOfLines={1}>
                  {name}
                </T>
                <T variant="caption" color={c.textMute} style={{ marginTop: 2 }}>
                  {r.wins} {t('ranking.winShort')} · {r.losses} {t('ranking.lossShort')}
                  {r.titles > 0 ? ` · ${r.titles} 🏆` : ''}
                </T>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <T variant="h3" color={i < 3 ? c.primary : c.text}>
                  {Math.round(r.score)}
                </T>
                <T variant="caption" color={c.textMute}>
                  {t('ranking.pts')}
                </T>
              </View>
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', marginBottom: Space.md },
    rank: { width: 34, alignItems: 'center', marginRight: 6 },
  });
