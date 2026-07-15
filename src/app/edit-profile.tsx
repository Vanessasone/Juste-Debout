/**
 * Éditer mon profil — écrit dans la table `profiles` (Supabase).
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Avatar, Chip, PageHeader, Screen, Section, T } from '@/components/ui';
import { Radius, Space } from '@/constants/brand';
import { ThemeColors } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { useColors } from '@/lib/theme';
import { STYLES } from '@/data/mock';
import { pickAndUpload } from '@/lib/photos';
import { getMyProfile, updateMyProfile } from '@/lib/profile';

const LEVELS = [
  { key: 'Amateur', tk: 'ep.lvlAmateur' },
  { key: 'Confirmé', tk: 'ep.lvlConfirmed' },
  { key: 'Pro', tk: '' },
];

export default function EditProfile() {
  const c = useColors();
  const t = useT();
  const styles2 = useMemo(() => makeStyles2(c), [c]);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [alias, setAlias] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [bio, setBio] = useState('');
  const [instagram, setInstagram] = useState('');
  const [level, setLevel] = useState<string | null>(null);
  const [styles, setStyles] = useState<string[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [availableSchool, setAvailableSchool] = useState(false);
  const [schoolNote, setSchoolNote] = useState('');
  const [kind, setKind] = useState<'dancer' | 'fan'>('fan');
  const [schoolEligible, setSchoolEligible] = useState(false);
  const [schoolModal, setSchoolModal] = useState(false);

  useEffect(() => {
    getMyProfile()
      .then((p) => {
        if (p) {
          setFullName(p.full_name ?? '');
          setAlias(p.alias ?? '');
          setCountry(p.country ?? '');
          setCity(p.city ?? '');
          setBio(p.bio ?? '');
          setInstagram(p.instagram ?? '');
          setLevel(p.level ?? null);
          setStyles(p.styles ?? []);
          setPhotoUrl(p.photo_url ?? null);
          setAvailableSchool(!!p.available_for_school);
          setSchoolNote(p.school_note ?? '');
          setKind(p.profile_kind === 'dancer' ? 'dancer' : 'fan');
          setSchoolEligible(!!p.jd_school_eligible);
        }
      })
      .catch((e) => setError(e?.message ?? t('reg.loadFail')))
      .finally(() => setLoading(false));
  }, []);

  const toggleStyle = (s: string) =>
    setStyles((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  const changePhoto = async (source: 'camera' | 'library') => {
    setError(null);
    setUploadingPhoto(true);
    try {
      const url = await pickAndUpload('avatar', source);
      if (url) {
        await updateMyProfile({ photo_url: url });
        setPhotoUrl(url);
      }
    } catch (e: any) {
      setError(e?.message ?? t('ep.photoFail'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateMyProfile({
        full_name: fullName.trim() || null,
        alias: alias.trim() || null,
        country: country.trim() || null,
        city: city.trim() || null,
        bio: bio.trim() || null,
        instagram: instagram.trim() || null,
        level: kind === 'dancer' ? level : null,
        styles,
        // Réservé aux finalistes/présélectionnés : on ne peut se rendre dispo que si éligible.
        available_for_school: schoolEligible ? availableSchool : false,
        school_note: schoolEligible ? schoolNote.trim() || null : null,
        profile_kind: kind,
      });
      router.back();
    } catch (e: any) {
      setError(e?.message ?? t('ep.saveFail'));
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen scroll={false}>
        <PageHeader title={t('ep.header')} subtitle={t('ep.headerSub')} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={c.accent} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader title={t('ep.header')} subtitle={t('ep.headerSub')} />

      {/* Photo perso */}
      <View style={{ alignItems: 'center', marginTop: Space.sm, marginBottom: Space.sm }}>
        <Avatar name={alias || fullName || 'JD'} uri={photoUrl} size={100} ring />
        {uploadingPhoto ? (
          <View style={styles2.photoBtn}>
            <ActivityIndicator color={c.accent} />
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: Space.sm }}>
            <Pressable onPress={() => changePhoto('camera')} style={styles2.photoBtn}>
              <Ionicons name="camera" size={16} color={c.accent} />
              <T variant="label" color={c.accent} style={{ marginLeft: 6 }}>
                {t('ep.photo')}
              </T>
            </Pressable>
            <Pressable onPress={() => changePhoto('library')} style={styles2.photoBtn}>
              <Ionicons name="images" size={16} color={c.accent} />
              <T variant="label" color={c.accent} style={{ marginLeft: 6 }}>
                {t('ep.gallery')}
              </T>
            </Pressable>
          </View>
        )}
      </View>

      <Section title={t('ep.identity')}>
        <Labeled label={t('ep.fullName')}>
          <Input value={fullName} onChangeText={setFullName} placeholder={t('ep.fullNamePh')} autoCapitalize="words" />
        </Labeled>
        <Labeled label={t('ep.alias')}>
          <Input value={alias} onChangeText={setAlias} placeholder={t('ep.aliasPh')} autoCapitalize="words" />
        </Labeled>
        <View style={{ flexDirection: 'row', gap: Space.md }}>
          <Labeled label={t('ep.country')} style={{ flex: 1 }}>
            <Input value={country} onChangeText={setCountry} placeholder="France" />
          </Labeled>
          <Labeled label={t('ep.city')} style={{ flex: 1 }}>
            <Input value={city} onChangeText={setCity} placeholder="Paris" />
          </Labeled>
        </View>
      </Section>

      <Section title={t('ep.iAm')}>
        <View style={{ flexDirection: 'row' }}>
          <Chip label={t('profile.dancer')} active={kind === 'dancer'} onPress={() => setKind('dancer')} color={c.accent} />
          <Chip label={t('ep.fan')} active={kind === 'fan'} onPress={() => setKind('fan')} color={c.accent} />
        </View>
      </Section>

      {kind === 'dancer' && (
        <Section title={t('ep.level')}>
          <View style={{ flexDirection: 'row' }}>
            {LEVELS.map((l) => (
              <Chip key={l.key} label={l.tk ? t(l.tk) : l.key} active={level === l.key} onPress={() => setLevel(l.key)} color={c.accent} />
            ))}
          </View>
        </Section>
      )}

      <Section title={kind === 'dancer' ? t('ep.myDisciplines') : t('ep.myFavDisciplines')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {STYLES.map((s) => (
            <Chip key={s} label={s} active={styles.includes(s)} onPress={() => toggleStyle(s)} color={c.accent} />
          ))}
        </View>
      </Section>

      <Section title={t('ep.about')}>
        <Labeled label={t('ep.bio')}>
          <Input value={bio} onChangeText={setBio} placeholder={t('ep.bioPh')} multiline />
        </Labeled>
        <Labeled label={t('ep.instagram')}>
          <Input value={instagram} onChangeText={setInstagram} placeholder={t('ep.instagramPh')} autoCapitalize="none" />
        </Labeled>
      </Section>

      <Section title="Juste Debout School">
        {schoolEligible ? (
          <>
            <Pressable
              onPress={() => setSchoolModal(true)}
              style={[styles2.schoolRow, { alignItems: 'center', borderColor: availableSchool ? c.primary : c.border }]}>
              <Ionicons name="school" size={20} color={c.primary} />
              <T variant="small" color={c.text} style={{ flex: 1, marginLeft: 12 }}>
                {availableSchool ? t('ep.schoolOn') : t('ep.schoolOff')}
              </T>
              <Ionicons name="chevron-forward" size={18} color={c.textMute} />
            </Pressable>

            <Modal visible={schoolModal} transparent animationType="fade" onRequestClose={() => setSchoolModal(false)}>
              <View style={styles2.modalWrap}>
                <View style={styles2.modalCard}>
                  <T variant="caption" color={c.primary}>
                    {t('ep.schoolTag')}
                  </T>
                  <T variant="title" style={{ fontSize: 24, marginTop: 6 }}>
                    Hip Hop Dance Week
                  </T>
                  <T variant="small" color={c.textDim} style={{ marginTop: 10, lineHeight: 20 }}>
                    {t('ep.schoolQ')}
                  </T>

                  <Pressable
                    onPress={() => setAvailableSchool((v) => !v)}
                    style={[styles2.schoolRow, { marginTop: Space.lg, borderColor: availableSchool ? c.primary : c.border }]}>
                    <View style={[styles2.check, availableSchool && { backgroundColor: c.primary, borderColor: c.primary }]}>
                      {availableSchool && <Ionicons name="checkmark" size={15} color={c.black} />}
                    </View>
                    <T variant="small" color={c.text} style={{ flex: 1 }}>
                      {t('ep.schoolConsent')}
                    </T>
                  </Pressable>

                  {availableSchool && (
                    <View style={{ marginTop: Space.md }}>
                      <Labeled label={t('ep.schoolNoteLabel')}>
                        <Input
                          value={schoolNote}
                          onChangeText={setSchoolNote}
                          placeholder={t('ep.schoolNotePh')}
                          multiline
                        />
                      </Labeled>
                    </View>
                  )}

                  <Pressable onPress={() => setSchoolModal(false)} style={[styles2.cta, { marginTop: Space.lg }]}>
                    <T variant="label" color={c.black} style={{ fontSize: 15 }}>
                      {t('common.validate')}
                    </T>
                  </Pressable>
                  <T variant="caption" color={c.textMute} style={{ marginTop: Space.md, textAlign: 'center' }}>
                    {t('ep.saveReminder')}
                  </T>
                </View>
              </View>
            </Modal>
          </>
        ) : (
          <View style={[styles2.schoolRow, { alignItems: 'flex-start' }]}>
            <Ionicons name="lock-closed" size={18} color={c.textMute} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <T variant="small" color={c.text}>
                {t('ep.reserved')}
              </T>
              <T variant="caption" color={c.textMute} style={{ marginTop: 4 }}>
                {t('ep.reservedHint')}
              </T>
            </View>
          </View>
        )}
      </Section>

      {error && (
        <T variant="small" color={c.danger} style={{ marginTop: Space.md }}>
          {error}
        </T>
      )}

      <Pressable onPress={save} disabled={saving} style={[styles2.cta, saving && { opacity: 0.6 }]}>
        {saving ? (
          <ActivityIndicator color={c.black} />
        ) : (
          <T variant="label" color={c.black} style={{ fontSize: 15 }}>
            {t('common.save')}
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
  const styles2 = useMemo(() => makeStyles2(c), [c]);
  return (
    <TextInput
      {...props}
      placeholderTextColor={c.textMute}
      style={[styles2.input, props.multiline && { height: 90, textAlignVertical: 'top' }]}
    />
  );
}

const makeStyles2 = (c: ThemeColors) => StyleSheet.create({
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', padding: Space.lg },
  modalCard: {
    backgroundColor: c.bgElevated,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: c.border,
    padding: Space.xl,
  },
  schoolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: c.surface,
    borderWidth: 1.5,
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
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Space.md,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: c.border,
    minHeight: 40,
  },
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
