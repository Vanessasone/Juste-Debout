/**
 * Créer un événement Juste Debout (présélection ou finale).
 * Écrit dans `events` + `event_categories` (Supabase). Réservé admin / organisateur (RLS).
 */
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Card, Chip, PageHeader, Screen, Section, T } from '@/components/ui';
import { Radius, Space } from '@/constants/brand';
import { ThemeColors } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';
import { Category, createEvent, getSeasonCategories } from '@/lib/jdlive';
import { useColors } from '@/lib/theme';

const STATUSES: { key: string; lk: string }[] = [
  { key: 'upcoming', lk: 'ce.stUpcoming' },
  { key: 'preselection', lk: 'ce.stPresel' },
  { key: 'live', lk: 'ce.stLive' },
  { key: 'done', lk: 'ce.stDone' },
];

const FAMILIES = [
  { key: 'classic', label: 'CLASSIC' },
  { key: 'afro', label: 'AFRO-DESCENDANTES' },
  { key: 'junior', label: 'JUNIOR DANCE TOUR' },
];

export default function CreateEvent() {
  const c = useColors();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const { partner } = useLocalSearchParams<{ partner?: string }>();
  const isPartner = partner === '1';
  const [submitted, setSubmitted] = useState(false);

  const [title, setTitle] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('France');
  const [venue, setVenue] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [status, setStatus] = useState('upcoming');

  const [cats, setCats] = useState<Category[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSeasonCategories()
      .then((list) => {
        setCats(list);
        setPicked(list.map((x) => x.id)); // toutes cochées par défaut
      })
      .catch(() => setCats([]));
  }, []);

  const toggleCat = (id: string) =>
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const groups = useMemo(() => {
    const known = new Set(FAMILIES.map((f) => f.key));
    const gs = FAMILIES.map((f) => ({
      key: f.key,
      label: f.label,
      items: cats.filter((x) => x.family === f.key),
    }));
    const others = cats.filter((x) => !x.family || !known.has(x.family));
    if (others.length) gs.push({ key: 'autres', label: t('ce.other'), items: others });
    return gs.filter((g) => g.items.length > 0);
  }, [cats, t]);

  const dateOk = (v: string) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v);
  const canSave =
    title.trim().length > 1 && dateOk(startsOn) && dateOk(endsOn) && !saving;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await createEvent({
        title: title.trim(),
        city: city.trim() || null,
        country: country.trim() || null,
        venue: venue.trim() || null,
        starts_on: startsOn.trim() || null,
        ends_on: endsOn.trim() || null,
        status,
        categoryIds: picked,
      });
      if (isPartner) setSubmitted(true);
      else router.back();
    } catch (e: any) {
      const m = (e?.message ?? '').toLowerCase();
      if (m.includes('duplicate') || m.includes('unique'))
        setError(t('ce.errDup'));
      else if (m.includes('row-level') || m.includes('policy'))
        setError(t('ce.errRights'));
      else setError(e?.message ?? t('ce.errFail'));
      setSaving(false);
    }
  };

  if (submitted) {
    return (
      <Screen>
        <PageHeader title={t('ce.submittedTitle')} subtitle={t('ce.submittedSub')} />
        <Card style={{ alignItems: 'center', paddingVertical: Space.xl }}>
          <Ionicons name="checkmark-circle" size={54} color={c.primary} />
          <T variant="h3" style={{ marginTop: Space.md, textAlign: 'center' }}>
            {t('ce.submittedH')}
          </T>
          <T variant="small" color={c.textDim} style={{ textAlign: 'center', marginTop: Space.sm }}>
            {t('ce.submittedBody')}
          </T>
          <Pressable onPress={() => router.back()} style={[styles.cta, { marginTop: Space.xl, alignSelf: 'stretch' }]}>
            <T variant="label" color={c.black} style={{ fontSize: 15 }}>
              {t('common.done')}
            </T>
          </Pressable>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader
        title={isPartner ? t('ce.headerProposeTitle') : t('ce.headerCreateTitle')}
        subtitle={isPartner ? t('ce.headerProposeSub') : t('ce.headerCreateSub')}
      />

      {isPartner ? (
        <Card style={{ marginBottom: Space.md, backgroundColor: c.surface }}>
          <T variant="caption" color={c.textDim}>
            {t('ce.partnerInfo')}
          </T>
        </Card>
      ) : null}

      <Section title={t('ce.identity')}>
        <Labeled label={t('ce.eventName')}>
          <Input
            value={title}
            onChangeText={setTitle}
            placeholder={t('ce.eventNamePh')}
            autoCapitalize="words"
          />
        </Labeled>
        <View style={{ flexDirection: 'row', gap: Space.md }}>
          <Labeled label={t('ce.city')} style={{ flex: 1 }}>
            <Input value={city} onChangeText={setCity} placeholder="Paris" />
          </Labeled>
          <Labeled label={t('ce.country')} style={{ flex: 1 }}>
            <Input value={country} onChangeText={setCountry} placeholder="France" />
          </Labeled>
        </View>
        <Labeled label={t('ce.venue')}>
          <Input value={venue} onChangeText={setVenue} placeholder={t('ce.venuePh')} />
        </Labeled>
      </Section>

      <Section title={t('ce.dates')}>
        <View style={{ flexDirection: 'row', gap: Space.md }}>
          <Labeled label={t('ce.startLabel')} style={{ flex: 1 }}>
            <Input
              value={startsOn}
              onChangeText={setStartsOn}
              placeholder="2026-03-07"
              autoCapitalize="none"
              keyboardType="numbers-and-punctuation"
            />
          </Labeled>
          <Labeled label={t('ce.endLabel')} style={{ flex: 1 }}>
            <Input
              value={endsOn}
              onChangeText={setEndsOn}
              placeholder="2026-03-08"
              autoCapitalize="none"
              keyboardType="numbers-and-punctuation"
            />
          </Labeled>
        </View>
      </Section>

      {!isPartner && (
        <Section title={t('ce.status')}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {STATUSES.map((s) => (
              <Chip
                key={s.key}
                label={t(s.lk)}
                active={status === s.key}
                onPress={() => setStatus(s.key)}
                color={c.accent}
              />
            ))}
          </View>
        </Section>
      )}

      <Section title={t('ce.disciplines')}>
        {groups.length === 0 ? (
          <T variant="small" color={c.textMute}>
            {t('ce.noDiscipline')}
          </T>
        ) : (
          groups.map((g) => (
            <View key={g.key} style={{ marginBottom: Space.lg }}>
              <T variant="caption" color={c.accent} style={{ marginBottom: Space.sm }}>
                {g.label}
              </T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {g.items.map((x) => (
                  <Chip
                    key={x.id}
                    label={x.name}
                    active={picked.includes(x.id)}
                    onPress={() => toggleCat(x.id)}
                    color={c.accent}
                  />
                ))}
              </View>
            </View>
          ))
        )}
      </Section>

      {error && (
        <View style={styles.err}>
          <Ionicons name="alert-circle" size={16} color={c.danger} />
          <T variant="small" color={c.danger} style={{ flex: 1, marginLeft: 8 }}>
            {error}
          </T>
        </View>
      )}

      <Pressable onPress={save} disabled={!canSave} style={[styles.cta, !canSave && { opacity: 0.4 }]}>
        {saving ? (
          <ActivityIndicator color={c.black} />
        ) : (
          <T variant="label" color={c.black} style={{ fontSize: 15 }}>
            {isPartner ? t('ce.ctaPropose') : t('ce.ctaCreate')}
          </T>
        )}
      </Pressable>
    </Screen>
  );
}

function Labeled({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: any;
}) {
  const c = useColors();
  return (
    <View style={[{ marginBottom: Space.md }, style]}>
      <T variant="caption" color={c.textMute} style={{ marginBottom: 6 }}>
        {label}
      </T>
      {children}
    </View>
  );
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return <TextInput {...props} placeholderTextColor={c.textMute} style={styles.input} />;
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    input: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: Radius.md,
      paddingHorizontal: 14,
      paddingVertical: 13,
      color: c.text,
      fontSize: 15,
    },
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
  });
