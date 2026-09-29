/**
 * Inscription à un événement Juste Debout — danseur ou spectateur.
 * Lit les événements + disciplines depuis Supabase, écrit dans `registrations`.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Card, PageHeader, Screen, Section, T, Tag } from '@/components/ui';
import { JD_COORDS, Palette, Radius, Space } from '@/constants/brand';
import { ThemeColors } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';
import { useColors } from '@/lib/theme';
import {
  Category,
  EventRow,
  getEventCategories,
  getEvents,
  getMyRegistrations,
  PartnerLite,
  register,
  RegType,
  Registration,
  searchPartners,
} from '@/lib/jdlive';

export default function Register() {
  const c = useColors();
  const router = useRouter();
  const { t, locale } = useI18n();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventId, setEventId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [myRegs, setMyRegs] = useState<Registration[]>([]);

  const [type, setType] = useState<RegType | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Binôme (disciplines 2v2)
  const [partner, setPartner] = useState<PartnerLite | null>(null);
  const [partnerQuery, setPartnerQuery] = useState('');
  const [partnerResults, setPartnerResults] = useState<PartnerLite[]>([]);
  const [searchingPartner, setSearchingPartner] = useState(false);

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === eventId) ?? null,
    [events, eventId],
  );
  const selectedCategory = useMemo(
    () => categories.find((cat) => cat.id === categoryId) ?? null,
    [categories, categoryId],
  );
  /** Cette discipline se danse à deux → il faut un binôme. */
  const needsPartner = type === 'dancer' && selectedCategory?.format === '2v2';
  const existing = useMemo(
    () => myRegs.find((r) => r.event_id === eventId),
    [myRegs, eventId],
  );

  // Chargement initial
  useEffect(() => {
    (async () => {
      try {
        const [ev, regs] = await Promise.all([getEvents(), getMyRegistrations()]);
        setEvents(ev);
        setMyRegs(regs);
        if (ev.length) setEventId(ev[0].id);
      } catch (e: any) {
        setError(e?.message ?? t('reg.loadFail'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Catégories de l'événement sélectionné
  useEffect(() => {
    if (!eventId) return;
    setType(null);
    setCategoryId(null);
    getEventCategories(eventId).then(setCategories).catch(() => setCategories([]));
  }, [eventId]);

  // Changer de type ou de discipline annule le binôme choisi.
  const clearPartner = useCallback(() => {
    setPartner(null);
    setPartnerQuery('');
    setPartnerResults([]);
  }, []);

  // Recherche de binôme, temporisée pour ne pas interroger la base à chaque frappe.
  useEffect(() => {
    if (!needsPartner || partner) return;
    const q = partnerQuery.trim();
    if (q.length < 2) {
      setPartnerResults([]);
      setSearchingPartner(false);
      return;
    }
    setSearchingPartner(true);
    let cancelled = false;
    const timer = setTimeout(() => {
      searchPartners(q)
        .then((res) => {
          if (!cancelled) setPartnerResults(res);
        })
        .catch(() => {
          if (!cancelled) setPartnerResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearchingPartner(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [partnerQuery, needsPartner, partner]);

  const canSubmit =
    !!eventId &&
    !!type &&
    (type === 'spectator' || !!categoryId) &&
    (!needsPartner || !!partner) &&
    consent &&
    !submitting;

  const submit = async () => {
    if (!eventId || !type) return;
    setSubmitting(true);
    setError(null);
    try {
      await register({
        eventId,
        type,
        categoryId: type === 'dancer' ? categoryId : null,
        partnerId: needsPartner ? partner?.id ?? null : null,
        consent,
      });
      const regs = await getMyRegistrations();
      setMyRegs(regs);
    } catch (e: any) {
      const m = (e?.message ?? '').toLowerCase();
      if (m.includes('duplicate') || m.includes('unique')) setError(t('reg.already'));
      else setError(e?.message ?? t('reg.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Screen scroll={false}>
        <PageHeader title={t('reg.title')} subtitle="Juste Debout" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={c.accent} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader title={t('reg.title')} subtitle={t('reg.subtitle')} />

      {/* Sélecteur d'événement (si plusieurs) */}
      {events.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Space.sm }}>
          {events.map((e) => (
            <Pressable
              key={e.id}
              onPress={() => setEventId(e.id)}
              style={[styles.evChip, eventId === e.id && styles.evChipActive]}>
              <T variant="label" color={eventId === e.id ? c.black : c.textDim}>
                {e.city ?? e.title}
              </T>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Carte événement */}
      {selectedEvent && (
        <View style={styles.eventCard}>
          <T variant="caption" color={Palette.primary}>
            {JD_COORDS}
          </T>
          <T variant="h1" color={c.white} style={{ marginTop: 8 }}>
            {selectedEvent.title}
          </T>
          <T variant="small" color={c.textDim} style={{ marginTop: 4 }}>
            {[selectedEvent.venue, selectedEvent.city, selectedEvent.country]
              .filter(Boolean)
              .join(' · ')}
          </T>
          {selectedEvent.tier === 'partner' && (
            <View style={{ flexDirection: 'row', marginTop: 8 }}>
              <Tag label={t('reg.partnerEvent')} color={Palette.sideFuchsia} />
            </View>
          )}
          {selectedEvent.starts_on && (
            <T variant="data" color={Palette.primary} style={{ marginTop: 8 }}>
              {formatDate(selectedEvent.starts_on, selectedEvent.ends_on, locale)}
            </T>
          )}
        </View>
      )}

      {/* Déjà inscrit → statut */}
      {existing ? (
        <Card style={styles.done}>
          <View style={styles.doneIcon}>
            <Ionicons name="checkmark" size={26} color={c.black} />
          </View>
          <T variant="h2" color={c.text} style={{ marginTop: Space.md }}>
            {t('reg.youAreIn')}
          </T>
          <T variant="small" color={c.textDim} style={{ textAlign: 'center', marginTop: 4 }}>
            {existing.type === 'dancer' ? t('profile.dancer') : t('profile.spectator')}
            {existing.category_id
              ? ` · ${categories.find((c) => c.id === existing.category_id)?.name ?? ''}`
              : ''}{' '}
            · {t('reg.status')} : {statusLabel(existing.status, t)}
          </T>
          <T variant="caption" color={c.textMute} style={{ marginTop: Space.md, textAlign: 'center' }}>
            {t('reg.paymentNote')}
          </T>
        </Card>
      ) : (
        <>
          {/* Type d'inscription */}
          <Section title={t('reg.asWhat')}>
            <View style={{ flexDirection: 'row', gap: Space.md }}>
              <TypeCard
                active={type === 'dancer'}
                icon="body"
                title={t('profile.dancer')}
                sub={t('reg.dancerSub')}
                onPress={() => {
                  setType('dancer');
                  setCategoryId(null);
                  clearPartner();
                }}
              />
              <TypeCard
                active={type === 'spectator'}
                icon="people"
                title={t('profile.spectator')}
                sub={t('reg.spectatorSub')}
                onPress={() => {
                  setType('spectator');
                  setCategoryId(null);
                  clearPartner();
                }}
              />
            </View>
          </Section>

          {/* Discipline (danseur), groupée par famille */}
          {type === 'dancer' && (
            <Section title={t('reg.myDiscipline')}>
              {categories.length === 0 ? (
                <T variant="small" color={c.textMute}>
                  {t('reg.noDiscipline')}
                </T>
              ) : (
                groupByFamily(categories).map((grp) => (
                  <View key={grp.key} style={{ marginBottom: Space.lg }}>
                    <T variant="caption" color={c.accent} style={{ marginBottom: Space.sm }}>
                      {t(grp.label)}
                    </T>
                    <View style={styles.catWrap}>
                      {grp.items.map((disc) => (
                        <Pressable
                          key={disc.id}
                          onPress={() => {
                            setCategoryId(disc.id);
                            clearPartner();
                          }}
                          style={[styles.cat, categoryId === disc.id && styles.catActive]}>
                          <T variant="h3" color={categoryId === disc.id ? c.black : c.text}>
                            {disc.name}
                          </T>
                          <T
                            variant="caption"
                            color={categoryId === disc.id ? 'rgba(0,0,0,0.6)' : c.textMute}>
                            {disc.format === '2v2' ? t('reg.duo') : t('reg.solo')}
                          </T>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ))
              )}
            </Section>
          )}

          {/* Binôme — uniquement pour les disciplines 2 vs 2 */}
          {needsPartner && (
            <Section title={t('reg.partnerTitle')}>
              <T variant="small" color={c.textMute} style={{ marginBottom: Space.md }}>
                {t('reg.partnerHint')}
              </T>

              {partner ? (
                <View style={styles.partnerPicked}>
                  <Ionicons name="person-circle" size={30} color={c.primary} />
                  <View style={{ flex: 1 }}>
                    <T variant="h3" color={c.text}>
                      {partner.full_name || partner.alias || '—'}
                    </T>
                    {!!partner.alias && !!partner.full_name && (
                      <T variant="caption" color={c.textMute}>
                        {partner.alias}
                      </T>
                    )}
                  </View>
                  <Pressable onPress={() => setPartner(null)} hitSlop={10}>
                    <T variant="label" color={c.accent}>
                      {t('reg.partnerClear')}
                    </T>
                  </Pressable>
                </View>
              ) : (
                <>
                  <View style={styles.searchBox}>
                    <Ionicons name="search" size={17} color={c.textMute} />
                    <TextInput
                      value={partnerQuery}
                      onChangeText={setPartnerQuery}
                      placeholder={t('reg.partnerSearch')}
                      placeholderTextColor={c.textMute}
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={styles.searchInput}
                    />
                    {searchingPartner && <ActivityIndicator size="small" color={c.accent} />}
                  </View>

                  {partnerResults.map((p) => (
                    <Pressable
                      key={p.id}
                      onPress={() => {
                        setPartner(p);
                        setPartnerResults([]);
                      }}
                      style={styles.partnerRow}>
                      <Ionicons name="person-circle-outline" size={26} color={c.textDim} />
                      <View style={{ flex: 1 }}>
                        <T variant="h3" color={c.text}>
                          {p.full_name || p.alias || '—'}
                        </T>
                        {!!p.alias && !!p.full_name && (
                          <T variant="caption" color={c.textMute}>
                            {p.alias}
                          </T>
                        )}
                      </View>
                    </Pressable>
                  ))}

                  {!searchingPartner &&
                    partnerQuery.trim().length >= 2 &&
                    partnerResults.length === 0 && (
                      <T variant="small" color={c.textMute} style={{ marginTop: Space.sm }}>
                        {t('reg.partnerNone')}
                      </T>
                    )}
                </>
              )}
            </Section>
          )}

          {/* Consentement RGPD */}
          {type && (
            <Pressable style={styles.consent} onPress={() => setConsent((v) => !v)}>
              <View style={[styles.check, consent && styles.checkOn]}>
                {consent && <Ionicons name="checkmark" size={15} color={c.black} />}
              </View>
              <T variant="small" color={c.textDim} style={{ flex: 1 }}>
                {t('reg.consent')}
              </T>
            </Pressable>
          )}

          {type && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: Space.sm }}>
              <T variant="caption" color={c.textMute}>
                {t('auth.terms1')}
              </T>
              <Pressable onPress={() => router.push('/legal/terms')}>
                <T variant="caption" color={c.accent}>
                  {t('auth.termsCGU')}
                </T>
              </Pressable>
              <T variant="caption" color={c.textMute}>
                {t('auth.and')}
              </T>
              <Pressable onPress={() => router.push('/legal/privacy')}>
                <T variant="caption" color={c.accent}>
                  {t('auth.privacy')}
                </T>
              </Pressable>
            </View>
          )}

          {error && (
            <View style={styles.err}>
              <Ionicons name="alert-circle" size={16} color={c.danger} />
              <T variant="small" color={c.danger} style={{ flex: 1, marginLeft: 8 }}>
                {error}
              </T>
            </View>
          )}

          {/* Valider */}
          <Pressable
            onPress={submit}
            disabled={!canSubmit}
            style={[styles.cta, !canSubmit && { opacity: 0.4 }]}>
            {submitting ? (
              <ActivityIndicator color={c.black} />
            ) : (
              <T variant="label" color={c.black} style={{ fontSize: 15 }}>
                {t('reg.confirm')}
              </T>
            )}
          </Pressable>
        </>
      )}
    </Screen>
  );
}

function TypeCard({
  active,
  icon,
  title,
  sub,
  onPress,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
  onPress: () => void;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Pressable onPress={onPress} style={[styles.typeCard, active && styles.typeActive]}>
      <Ionicons name={icon} size={26} color={active ? c.primary : c.textDim} />
      <T variant="h3" color={c.text} style={{ marginTop: 10 }}>
        {title}
      </T>
      <T variant="caption" color={c.textMute} style={{ marginTop: 4 }}>
        {sub}
      </T>
    </Pressable>
  );
}

function formatDate(start: string, end: string | null, locale: string): string {
  const s = new Date(start);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
  if (end && end !== start) {
    const e = new Date(end);
    return `${s.getDate()}–${e.getDate()} ${e.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}`;
  }
  return s.toLocaleDateString(locale, opts);
}

function statusLabel(s: string, t: (k: string) => string): string {
  return (
    { registered: t('profile.stRegistered'), confirmed: t('profile.stConfirmed'), paid: t('profile.stPaid'), cancelled: t('profile.stCancelled') }[s] ?? s
  );
}

// `label` = clé i18n (traduite à l'affichage).
const FAMILIES = [
  { key: 'classic', label: 'reg.famClassic' },
  { key: 'afro', label: 'reg.famAfro' },
  { key: 'junior', label: 'reg.famJunior' },
];

function groupByFamily(cats: Category[]) {
  const known = new Set(FAMILIES.map((f) => f.key));
  const groups = FAMILIES.map((f) => ({
    key: f.key,
    label: f.label,
    items: cats.filter((c) => c.family === f.key),
  }));
  const others = cats.filter((c) => !c.family || !known.has(c.family));
  if (others.length) groups.push({ key: 'autres', label: 'reg.famOther', items: others });
  return groups.filter((g) => g.items.length > 0);
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  evChip: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: c.border,
    marginRight: 8,
  },
  evChipActive: { backgroundColor: c.primary, borderColor: c.primary },
  eventCard: {
    backgroundColor: '#0E0E0E',
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: Radius.xl,
    padding: Space.xl,
  },
  typeCard: {
    flex: 1,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: Radius.lg,
    padding: Space.lg,
  },
  typeActive: { borderColor: c.primary, backgroundColor: '#12160A' },
  catWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
  cat: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: Radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: '47%',
    backgroundColor: c.surface,
  },
  catActive: { backgroundColor: c.primary, borderColor: c.primary },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  searchInput: { flex: 1, color: c.text, fontSize: 15, paddingVertical: 12 },
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: Space.sm,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: Radius.md,
  },
  partnerPicked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: '#12160A',
    borderWidth: 1,
    borderColor: c.primary,
    borderRadius: Radius.md,
  },
  consent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: Space.xl,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: Radius.md,
    padding: Space.lg,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: c.textMute,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: c.primary, borderColor: c.primary },
  err: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.danger,
    borderRadius: Radius.md,
    padding: 12,
    marginTop: Space.lg,
  },
  cta: {
    backgroundColor: c.primary,
    borderRadius: Radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Space.xl,
    minHeight: 52,
  },
  done: { alignItems: 'center', marginTop: Space.lg, borderColor: c.primary },
  doneIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
