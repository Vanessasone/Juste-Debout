import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppHeader, Avatar, Card, Chip, Screen, Section, T, Tag } from '@/components/ui';
import { Radius, Space } from '@/constants/brand';
import { ThemeColors } from '@/constants/theme';
import { CERT_META, CertKind, getTopCertByProfile } from '@/lib/certifications';
import { countryFlag } from '@/lib/countries';
import { STYLES, Style } from '@/data/mock';
import { useT } from '@/lib/i18n';
import { getLeaderboard, LeaderboardRow } from '@/lib/palmares';
import { getDancers, Profile } from '@/lib/profile';
import { useColors } from '@/lib/theme';

export default function Network() {
  const router = useRouter();
  const c = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [style, setStyle] = useState<Style | null>(null);
  const [query, setQuery] = useState('');
  const [dancers, setDancers] = useState<Profile[]>([]);
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  const [certMap, setCertMap] = useState<Map<string, CertKind>>(new Map());

  useFocusEffect(
    useCallback(() => {
      getDancers().then(setDancers).catch(() => setDancers([]));
      getLeaderboard().then(setBoard).catch(() => setBoard([]));
      getTopCertByProfile().then(setCertMap).catch(() => setCertMap(new Map()));
    }, []),
  );

  // profil → rang mondial (position, victoires, titres)
  const rankMap = useMemo(() => {
    const m = new Map<string, { rank: number; wins: number; titles: number }>();
    board.forEach((r, i) => m.set(r.profile_id, { rank: i + 1, wins: r.wins, titles: r.titles }));
    return m;
  }, [board]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dancers.filter((d) => {
      const okStyle = !style || (d.styles ?? []).includes(style);
      const hay = [d.alias, d.full_name, d.city, d.country].filter(Boolean).join(' ').toLowerCase();
      const okQuery = !q || hay.includes(q);
      return okStyle && okQuery;
    });
  }, [dancers, style, query]);

  return (
    <Screen>
      <AppHeader title={t('network.title')} subtitle={t('network.subtitle')} />

      {/* Recherche (réelle) */}
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={c.textMute} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('network.searchPh')}
          placeholderTextColor={c.textMute}
          style={styles.searchInput}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <Ionicons name="close-circle" size={18} color={c.textMute} onPress={() => setQuery('')} />
        )}
      </View>

      {/* Filtres style */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: Space.md }}
        contentContainerStyle={{ paddingRight: Space.lg }}>
        <Chip label={t('network.all')} active={style === null} onPress={() => setStyle(null)} color={c.accent} />
        {STYLES.map((s) => (
          <Chip
            key={s}
            label={s}
            active={style === s}
            onPress={() => setStyle(s === style ? null : s)}
            color={c.accent}
          />
        ))}
      </ScrollView>

      {/* Annuaire (réel) */}
      <Section title={`${t('network.dancers')} ${style ? `· ${style}` : ''}`} action={`${list.length}`}>
        {dancers.length === 0 ? (
          <Card>
            <T variant="small" color={c.textDim}>
              {t('network.dirEmpty')}
            </T>
          </Card>
        ) : list.length === 0 ? (
          <Card>
            <T variant="small" color={c.textDim}>
              {t('network.noMatch')}
            </T>
          </Card>
        ) : (
          list.map((d) => {
            const name = d.alias || d.full_name || t('profile.dancer');
            const loc = [d.city, d.country].filter(Boolean).join(', ');
            const flag = countryFlag(d.country);
            const rk = rankMap.get(d.id);
            const topCert = certMap.get(d.id);
            return (
              <Card key={d.id} style={styles.dancerCard} onPress={() => router.push(`/dancer/${d.id}` as never)}>
                <Avatar name={name} uri={d.photo_url} color={c.accent} size={52} />
                <View style={{ flex: 1, marginLeft: Space.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <T variant="h3">
                      {flag ? `${flag} ` : ''}
                      {name}
                    </T>
                    {topCert ? (
                      <Ionicons
                        name={CERT_META[topCert].icon as keyof typeof Ionicons.glyphMap}
                        size={14}
                        color={CERT_META[topCert].color}
                      />
                    ) : null}
                  </View>
                  <T variant="small" color={c.textDim} style={{ marginTop: 2 }}>
                    {[loc, d.level].filter(Boolean).join(' · ') || t('profile.dancer')}
                  </T>
                  {(d.styles?.length ?? 0) > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 6 }}>
                      {d.styles!.slice(0, 3).map((s) => (
                        <Tag key={s} label={s} color={c.accent} />
                      ))}
                    </View>
                  )}
                </View>
                {rk ? (
                  <View style={styles.rankBox}>
                    <T variant="caption" color={c.textMute}>
                      {t('network.rank')}
                    </T>
                    <T variant="h3" color={rk.rank <= 3 ? c.primary : c.text}>
                      #{rk.rank}
                    </T>
                    {rk.titles > 0 && (
                      <T variant="caption" color={c.gold}>
                        {rk.titles} 🏆
                      </T>
                    )}
                  </View>
                ) : (
                  <View style={styles.contactBtn}>
                    <Ionicons name="chevron-forward" size={18} color={c.accent} />
                  </View>
                )}
              </Card>
            );
          })
        )}
      </Section>
    </Screen>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: Radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 16,
    marginTop: Space.md,
    gap: 8,
  },
  searchInput: { flex: 1, color: c.text, fontSize: 15, paddingVertical: 9 },
  dancerCard: { flexDirection: 'row', alignItems: 'center', marginBottom: Space.md },
  rankBox: { alignItems: 'center', minWidth: 44 },
  contactBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.primary + '1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
