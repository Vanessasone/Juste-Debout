/**
 * Admin — attribution des certifications officielles (badges vérifiés JD).
 * Réservé aux admins (RLS `is_admin()` côté serveur).
 */
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { CertChip } from '@/components/certs';
import { Card, Chip, GButton, Screen, Section, T } from '@/components/ui';
import { Radius, Space } from '@/constants/brand';
import { ThemeColors } from '@/constants/theme';
import {
  CERT_KINDS,
  CERT_META,
  Certification,
  CertKind,
  getCertifications,
  grantCertification,
  revokeCertification,
  searchProfilesByName,
} from '@/lib/certifications';
import { useT } from '@/lib/i18n';
import { useColors } from '@/lib/theme';

type Person = { id: string; full_name: string | null; alias: string | null; country: string | null };

export default function AdminCerts() {
  const c = useColors();
  const t = useT();
  const styles = makeStyles(c);

  const [q, setQ] = useState('');
  const [results, setResults] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);
  const [person, setPerson] = useState<Person | null>(null);
  const [certs, setCerts] = useState<Certification[]>([]);

  const [kind, setKind] = useState<CertKind>('vainqueur');
  const [label, setLabel] = useState('');
  const [year, setYear] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function runSearch() {
    setSearching(true);
    setMsg(null);
    try {
      setResults(await searchProfilesByName(q));
    } catch (e: any) {
      setMsg(e.message ?? t('ac.searchErr'));
    } finally {
      setSearching(false);
    }
  }

  async function pick(p: Person) {
    setPerson(p);
    setResults([]);
    setQ('');
    try {
      setCerts(await getCertifications(p.id));
    } catch {
      setCerts([]);
    }
  }

  async function grant() {
    if (!person) return;
    setBusy(true);
    setMsg(null);
    try {
      const y = year.trim() ? parseInt(year.trim(), 10) : null;
      await grantCertification({ profileId: person.id, kind, label, year: Number.isNaN(y) ? null : y });
      setCerts(await getCertifications(person.id));
      setLabel('');
      setYear('');
      setMsg(t('ac.granted'));
    } catch (e: any) {
      setMsg(e.message?.includes('duplicate') ? t('ac.dup') : e.message ?? t('ac.grantFail'));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    if (!person) return;
    setBusy(true);
    try {
      await revokeCertification(id);
      setCerts(await getCertifications(person.id));
    } catch (e: any) {
      setMsg(e.message ?? t('ac.revokeFail'));
    } finally {
      setBusy(false);
    }
  }

  const personName = person ? person.alias || person.full_name || t('profile.dancer') : '';

  return (
    <Screen>
      <Section title={t('home.pCerts')} action={person ? t('ac.change') : undefined} onAction={() => setPerson(null)}>
        <T variant="small" color={c.textDim} style={{ marginBottom: Space.md }}>
          {t('ac.intro')}
        </T>

        {!person ? (
          <>
            <View style={styles.searchRow}>
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder={t('ac.searchPh')}
                placeholderTextColor={c.textMute}
                style={[styles.input, { flex: 1 }]}
                autoCapitalize="none"
                onSubmitEditing={runSearch}
                returnKeyType="search"
              />
              <Pressable style={styles.searchBtn} onPress={runSearch}>
                {searching ? <ActivityIndicator color={c.black} /> : <Ionicons name="search" size={18} color={c.black} />}
              </Pressable>
            </View>
            {results.map((p) => (
              <Card key={p.id} onPress={() => pick(p)} style={{ marginTop: Space.sm }}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <T variant="h3">{p.alias || p.full_name || t('profile.dancer')}</T>
                    <T variant="caption" color={c.textMute}>
                      {[p.full_name && p.full_name !== p.alias ? p.full_name : null, p.country].filter(Boolean).join(' · ') || '—'}
                    </T>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={c.textMute} />
                </View>
              </Card>
            ))}
            {q.trim().length >= 2 && !searching && results.length === 0 ? (
              <T variant="caption" color={c.textMute} style={{ marginTop: Space.sm }}>
                {t('ac.noProfile')}
              </T>
            ) : null}
          </>
        ) : (
          <>
            {/* Personne sélectionnée */}
            <Card style={{ marginBottom: Space.lg }}>
              <T variant="h3">{personName}</T>
              <T variant="caption" color={c.textMute}>
                {[person.full_name && person.full_name !== personName ? person.full_name : null, person.country].filter(Boolean).join(' · ') || '—'}
              </T>
              {certs.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm, marginTop: Space.md }}>
                  {certs.map((cert) => (
                    <View key={cert.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <CertChip cert={cert} />
                      <Pressable onPress={() => revoke(cert.id)} hitSlop={8} style={{ marginLeft: 4 }}>
                        <Ionicons name="close-circle" size={20} color={c.danger} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : (
                <T variant="caption" color={c.textMute} style={{ marginTop: Space.sm }}>
                  {t('ac.noCerts')}
                </T>
              )}
            </Card>

            {/* Type de badge */}
            <T variant="label" color={c.textDim} style={{ marginBottom: Space.sm }}>
              {t('ac.certType')}
            </T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm }}>
              {CERT_KINDS.map((k) => (
                <Chip key={k} label={CERT_META[k].short} color={CERT_META[k].color} active={kind === k} onPress={() => setKind(k)} />
              ))}
            </View>

            {/* Précisions */}
            <TextInput
              value={label}
              onChangeText={setLabel}
              placeholder={t('ac.labelPh')}
              placeholderTextColor={c.textMute}
              style={[styles.input, { marginTop: Space.md }]}
            />
            <TextInput
              value={year}
              onChangeText={setYear}
              placeholder={t('ac.yearPh')}
              placeholderTextColor={c.textMute}
              keyboardType="number-pad"
              maxLength={4}
              style={[styles.input, { marginTop: Space.sm }]}
            />

            <View style={{ marginTop: Space.lg }}>
              <GButton label={busy ? t('ac.granting') : t('ac.grant')} icon="ribbon" onPress={grant} />
            </View>
          </>
        )}

        {msg ? (
          <T variant="small" color={msg.includes('✓') ? c.accent : c.danger} style={{ marginTop: Space.md, textAlign: 'center' }}>
            {msg}
          </T>
        ) : null}
      </Section>
    </Screen>
  );
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
    searchRow: { flexDirection: 'row', gap: Space.sm, alignItems: 'stretch' },
    searchBtn: {
      width: 48,
      borderRadius: Radius.md,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  });
