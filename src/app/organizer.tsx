/**
 * Espace organisateur / staff — voir et exporter les inscrits d'un événement.
 * Accès contrôlé par RLS (organisateur de l'événement ou admin).
 */
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar, Card, PageHeader, Screen, Section, T, Tag } from '@/components/ui';
import { Palette, Radius, Space } from '@/constants/brand';
import { useI18n } from '@/lib/i18n';
import {
  EventRow,
  getEventRegistrations,
  getEvents,
  RegistrationFull,
  setOfficialPhoto,
} from '@/lib/jdlive';
import { pickAndUpload } from '@/lib/photos';

export default function Organizer() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventId, setEventId] = useState<string | null>(null);
  const [regs, setRegs] = useState<RegistrationFull[]>([]);
  const [loadingRegs, setLoadingRegs] = useState(false);
  const [copied, setCopied] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOfficial = async (dancerId: string, source: 'camera' | 'library') => {
    setError(null);
    setUploadingId(dancerId);
    try {
      const url = await pickAndUpload('official', source, dancerId);
      if (url) {
        await setOfficialPhoto(dancerId, url);
        setRegs((cur) =>
          cur.map((r) =>
            r.profiles?.id === dancerId
              ? { ...r, profiles: { ...r.profiles, official_photo_url: url } }
              : r,
          ),
        );
      }
    } catch (e: any) {
      setError(e?.message ?? t('or.photoFail'));
    } finally {
      setUploadingId(null);
    }
  };

  // Recharge la liste à chaque retour sur l'écran (ex. après création d'un événement).
  useFocusEffect(
    useCallback(() => {
      getEvents()
        .then((ev) => {
          setEvents(ev);
          setEventId((cur) => cur ?? (ev.length ? ev[0].id : null));
        })
        .catch((e) => setError(e?.message ?? t('reg.loadFail')))
        .finally(() => setLoading(false));
    }, []),
  );

  useEffect(() => {
    if (!eventId) return;
    setLoadingRegs(true);
    getEventRegistrations(eventId)
      .then(setRegs)
      .catch((e) => setError(e?.message ?? t('or.readFail')))
      .finally(() => setLoadingRegs(false));
  }, [eventId]);

  const stats = useMemo(() => {
    const dancers = regs.filter((r) => r.type === 'dancer');
    const spectators = regs.filter((r) => r.type === 'spectator');
    const byDiscipline = new Map<string, number>();
    dancers.forEach((r) => {
      const n = r.categories?.name ?? '—';
      byDiscipline.set(n, (byDiscipline.get(n) ?? 0) + 1);
    });
    return {
      total: regs.length,
      dancers: dancers.length,
      spectators: spectators.length,
      byDiscipline: [...byDiscipline.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [regs]);

  const copyCsv = async () => {
    await Clipboard.setStringAsync(toCSV(regs, t, locale));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <Screen scroll={false}>
        <PageHeader title={t('profile.organizer')} subtitle="Juste Debout" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={Palette.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader title={t('profile.organizer')} subtitle={t('or.subMain')} />

      <Pressable onPress={() => router.push('/create-event')} style={styles.createBtn}>
        <Ionicons name="add-circle" size={20} color={Palette.primary} />
        <T variant="label" color={Palette.primary} style={{ marginLeft: 8 }}>
          {t('or.createEvent')}
        </T>
      </Pressable>

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

      {/* Synthèse */}
      <View style={{ flexDirection: 'row', gap: Space.md }}>
        <StatCard value={stats.total} label={t('or.registered')} />
        <StatCard value={stats.dancers} label={t('or.dancers')} />
        <StatCard value={stats.spectators} label={t('or.spectators')} />
      </View>

      {/* Export */}
      <Pressable onPress={copyCsv} style={styles.exportBtn}>
        <Ionicons name={copied ? 'checkmark' : 'download'} size={18} color={Palette.black} />
        <T variant="label" color={Palette.black} style={{ marginLeft: 8 }}>
          {copied ? t('or.copied') : t('or.exportCsv')}
        </T>
      </Pressable>

      {error && (
        <T variant="small" color={Palette.danger} style={{ marginTop: Space.md }}>
          {error}
        </T>
      )}

      {/* Par discipline */}
      {stats.byDiscipline.length > 0 && (
        <Section title={t('or.byDiscipline')}>
          <Card>
            {stats.byDiscipline.map(([name, n], i) => (
              <View key={name} style={[styles.discRow, i > 0 && styles.divider]}>
                <T variant="h3">{name}</T>
                <T variant="data" color={Palette.primary}>
                  {n}
                </T>
              </View>
            ))}
          </Card>
        </Section>
      )}

      {/* Liste */}
      <Section title={`${t('or.listTitle')} (${regs.length})`}>
        {loadingRegs ? (
          <ActivityIndicator color={Palette.primary} style={{ marginTop: Space.lg }} />
        ) : regs.length === 0 ? (
          <Card>
            <T variant="small" color={Palette.textDim}>
              {t('or.empty')}
            </T>
          </Card>
        ) : (
          regs.map((r) => {
            const name = r.profiles?.full_name || r.profiles?.alias || '—';
            const dancerId = r.profiles?.id;
            return (
              <Card key={r.id} style={styles.regRow}>
                {r.type === 'dancer' && dancerId ? (
                  <View style={{ alignItems: 'center', marginRight: Space.md }}>
                    {uploadingId === dancerId ? (
                      <View style={styles.offSlot}>
                        <ActivityIndicator color={Palette.primary} size="small" />
                      </View>
                    ) : (
                      <Avatar name={name} uri={r.profiles?.official_photo_url} size={46} />
                    )}
                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
                      <Pressable onPress={() => handleOfficial(dancerId, 'camera')} hitSlop={8}>
                        <Ionicons name="camera" size={17} color={Palette.primary} />
                      </Pressable>
                      <Pressable onPress={() => handleOfficial(dancerId, 'library')} hitSlop={8}>
                        <Ionicons name="images" size={17} color={Palette.primary} />
                      </Pressable>
                    </View>
                  </View>
                ) : null}
                <View style={{ flex: 1 }}>
                  <T variant="h3">{name}</T>
                  <T variant="small" color={Palette.textDim} style={{ marginTop: 2 }}>
                    {[r.profiles?.city, r.profiles?.country].filter(Boolean).join(', ') || '—'}
                  </T>
                  {!!r.partner && (
                    <T variant="caption" color={Palette.primary} style={{ marginTop: 4 }}>
                      {t('reg.partnerLabel')} : {r.partner.full_name || r.partner.alias || '—'}
                    </T>
                  )}
                  {r.type === 'dancer' && (
                    <T variant="caption" color={Palette.textMute} style={{ marginTop: 4 }}>
                      {t('or.officialPhoto')} {r.profiles?.official_photo_url ? t('or.posee') : t('or.aPoser')}
                    </T>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Tag
                    label={r.type === 'dancer' ? r.categories?.name ?? t('profile.dancer') : t('profile.spectator')}
                    color={Palette.primary}
                  />
                  <T variant="caption" color={Palette.textMute}>
                    {statusLabel(r.status, t)}
                  </T>
                </View>
              </Card>
            );
          })
        )}
      </Section>
    </Screen>
  );
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.statCard}>
      <T variant="title" color={Palette.primary} style={{ fontSize: 30 }}>
        {value}
      </T>
      <T variant="caption" color={Palette.textMute}>
        {label}
      </T>
    </View>
  );
}

function statusLabel(s: string, t: (k: string) => string): string {
  return (
    { registered: t('profile.stRegistered'), confirmed: t('profile.stConfirmed'), paid: t('profile.stPaid'), cancelled: t('profile.stCancelled') }[s] ?? s
  );
}

function toCSV(rows: RegistrationFull[], t: (k: string) => string, locale: string): string {
  const head = [t('or.csvName'), t('or.csvAlias'), t('or.csvType'), t('or.csvDiscipline'), t('or.csvFormat'), t('reg.partnerLabel'), t('or.csvCountry'), t('or.csvCity'), t('or.csvStatus'), t('or.csvDate')];
  const esc = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [
      r.profiles?.full_name ?? '',
      r.profiles?.alias ?? '',
      r.type === 'dancer' ? t('profile.dancer') : t('profile.spectator'),
      r.categories?.name ?? '',
      r.categories?.format ?? '',
      r.partner?.full_name || r.partner?.alias || '',
      r.profiles?.country ?? '',
      r.profiles?.city ?? '',
      statusLabel(r.status, t),
      new Date(r.created_at).toLocaleDateString(locale),
    ]
      .map(esc)
      .join(','),
  );
  return [head.map(esc).join(','), ...lines].join('\n');
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
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Palette.primary,
    borderRadius: Radius.pill,
    paddingVertical: 13,
    marginBottom: Space.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.lg,
    padding: Space.lg,
    alignItems: 'center',
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.primary,
    borderRadius: Radius.pill,
    paddingVertical: 14,
    marginTop: Space.lg,
  },
  discRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Space.md,
  },
  divider: { borderTopWidth: 1, borderTopColor: Palette.borderSoft },
  regRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Space.md },
  offSlot: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Palette.surface2,
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
