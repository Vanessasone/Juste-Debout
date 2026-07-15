import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CertChips } from '@/components/certs';
import { Avatar, Card, Section, T, Tag } from '@/components/ui';
import { Radius, Space } from '@/constants/brand';
import { ThemeColors } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { Certification, getCertifications } from '@/lib/certifications';
import { useT } from '@/lib/i18n';
import { startDM } from '@/lib/messaging';
import { getProfileById, Profile } from '@/lib/profile';
import { useColors } from '@/lib/theme';

export default function DancerProfile() {
  const c = useColors();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const myId = session?.user?.id;

  const [d, setD] = useState<Profile | null>(null);
  const [certs, setCerts] = useState<Certification[]>([]);
  const [loading, setLoading] = useState(true);
  const [dmBusy, setDmBusy] = useState(false);

  async function openConversation() {
    if (!id || dmBusy) return;
    setDmBusy(true);
    try {
      const convId = await startDM(id);
      const label = d?.alias || d?.full_name || t('profile.dancer');
      router.push({ pathname: '/chat/[id]', params: { id: convId, name: label } } as never);
    } catch {
      // silencieux : bouton reste disponible
    } finally {
      setDmBusy(false);
    }
  }
  useEffect(() => {
    if (!id) return;
    getProfileById(id)
      .then(setD)
      .catch(() => setD(null))
      .finally(() => setLoading(false));
    getCertifications(id).then(setCerts).catch(() => setCerts([]));
  }, [id]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  if (!d) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: Space.xl }}>
        <T variant="small" color={c.textDim}>
          {t('dancer.notFound')}
        </T>
        <Pressable onPress={() => router.back()} style={{ marginTop: Space.md }}>
          <T variant="label" color={c.accent}>
            {t('dancer.back')}
          </T>
        </Pressable>
      </View>
    );
  }

  const name = d.alias || d.full_name || t('profile.dancer');
  const loc = [d.city, d.country].filter(Boolean).join(', ');
  const insta = d.instagram?.replace('@', '').trim();

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <LinearGradient colors={['#181818', c.bg]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[styles.cover, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
          <View style={{ alignItems: 'center', marginTop: Space.md }}>
            <Avatar name={name} uri={d.photo_url} color={c.accent} size={96} ring />
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: Space.md }}>
              <T variant="title">{name}</T>
            </View>
            <T variant="small" color={c.textDim} style={{ marginTop: 2 }}>
              {[d.full_name && d.full_name !== name ? d.full_name : null, loc].filter(Boolean).join(' · ') || t('dancer.subtitleFallback')}
            </T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: Space.md }}>
              {(d.styles ?? []).map((s) => (
                <Tag key={s} label={s} color={c.accent} />
              ))}
              {d.level ? <Tag label={d.level} color={c.gold} /> : null}
            </View>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: Space.lg }}>
          {myId && myId !== id ? (
            <Pressable onPress={openConversation} disabled={dmBusy} style={[styles.msgBtn, { opacity: dmBusy ? 0.6 : 1 }]}>
              {dmBusy ? (
                <ActivityIndicator color={c.black} />
              ) : (
                <>
                  <Ionicons name="chatbubble-ellipses" size={18} color={c.black} />
                  <T variant="label" color={c.black} style={{ marginLeft: 8 }}>
                    {t('dancer.message')}
                  </T>
                </>
              )}
            </Pressable>
          ) : null}

          {certs.length ? (
            <Section title={t('home.pCerts')}>
              <CertChips certs={certs} />
            </Section>
          ) : null}

          {d.bio ? (
            <Section title={t('dancer.bio')}>
              <Card>
                <T variant="body" color={c.textDim}>
                  {d.bio}
                </T>
              </Card>
            </Section>
          ) : null}

          {d.available_for_school ? (
            <Section title="Juste Debout School">
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="school" size={20} color={c.accent} />
                  <T variant="h3" style={{ marginLeft: Space.md, flex: 1 }}>
                    {t('dancer.availStages')}
                  </T>
                </View>
                {d.school_note ? (
                  <T variant="small" color={c.textDim} style={{ marginTop: Space.md }}>
                    {d.school_note}
                  </T>
                ) : null}
              </Card>
            </Section>
          ) : null}

          {insta ? (
            <Section title={t('dancer.socials')}>
              <Card onPress={() => Linking.openURL(`https://instagram.com/${insta}`)}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="logo-instagram" size={20} color={c.accent} />
                  <T variant="h3" style={{ marginLeft: Space.md, flex: 1 }}>
                    @{insta}
                  </T>
                  <Ionicons name="open-outline" size={18} color={c.textMute} />
                </View>
              </Card>
            </Section>
          ) : null}

          {!d.bio && !d.available_for_school && !insta && !certs.length ? (
            <Card style={{ marginTop: Space.lg }}>
              <T variant="small" color={c.textDim}>
                {t('dancer.empty')}
              </T>
            </Card>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  cover: { paddingHorizontal: Space.lg, paddingBottom: Space.xl },
  msgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.primary,
    borderRadius: Radius.pill,
    paddingVertical: 13,
    marginTop: Space.lg,
  },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
