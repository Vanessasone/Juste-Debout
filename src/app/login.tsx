import { usePasswordResetText } from '@/lib/passwordResetText';
import { useCustomerText } from '@/lib/customerText';
import { LanguagePicker } from '@/components/LanguagePicker';
/**
 * Écran Connexion / Inscription — Juste Debout.
 */
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Vitruve, Wordmark } from '@/components/Logo';
import { T } from '@/components/ui';
import { JD_TAGLINE, Radius, Space } from '@/constants/brand';
import { ThemeColors } from '@/constants/theme';
import { useT, useI18n, LANGUAGES } from '@/lib/i18n';
import { useColors } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { readTicketDraft, TicketDraft } from '@/lib/ticketPurchase';

type Mode = 'signin' | 'signup';

export default function Login() {
  const { recover, lang } = useLocalSearchParams<{ recover?: string; lang?: string }>();
  const { setLocale } = useI18n();
  useEffect(() => { if (lang && LANGUAGES.some(l => l.code === lang)) void setLocale(lang); }, [lang, setLocale]);
  const purchase = recover === '1';
  const [draft, setDraft] = useState<TicketDraft | null>(null);
  useEffect(() => { if (purchase) void readTicketDraft().then(setDraft); }, [purchase]);
  const c = useColors();
  const router = useRouter();
  const t = useT();
  const ct = useCustomerText();
  const pr = usePasswordResetText();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setInfo(null);
    if (!email.trim() || !password) {
      setError(t('auth.missingCreds'));
      return;
    }
    if (mode === 'signup' && purchase && !name.trim()) { setError(ct('invalidContact')); return; }
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim() },
            ...(Platform.OS === 'web' && typeof window !== 'undefined' ? { emailRedirectTo: window.location.origin + '/auth-callback' } : {}),
          },
        });
        if (error) throw error;
        // Selon les réglages Supabase, l'email peut demander une confirmation.
        if (!data.session) {
          setInfo(ct('signupInfo'));
          setMode('signin');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
      // La redirection est gérée automatiquement par le garde d'auth (_layout).
    } catch (e: any) {
      setError(traduireErreur(e?.message ?? '', t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 30 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <LanguagePicker />
          {/* Marque */}
          <View style={{ alignItems: 'center' }}>
            <Vitruve size={72} color={c.accent} />
            <View style={{ marginTop: Space.lg }}>
              <Wordmark height={30} color={c.text} />
            </View>
            <T variant="caption" color={c.accent} style={{ marginTop: 10, textAlign: 'center' }}>
              {JD_TAGLINE}
            </T>
          </View>


          {/* Titre */}
          <T variant="title" color={c.text} style={{ marginTop: Space.xxxl, fontSize: 30 }}>
            {purchase ? ct('recover') : mode === 'signup' ? t('auth.signupTitle') : t('auth.signinTitle')}
          </T>
          <T variant="small" color={c.textDim} style={{ marginTop: 6 }}>
            {purchase ? ct('guestLogin') : mode === 'signup' ? t('auth.signupSub') : t('auth.signinSub')}
          </T>

          <Pressable accessibilityRole="button" onPress={() => router.replace('/billetterie')} style={{ marginTop: Space.md }}><T variant="small" color={c.accent}>{purchase ? ct('edit') : ct('guestBuy')}</T></Pressable>

          {/* Sélecteur */}
          <View style={styles.toggle}>
            {(['signup', 'signin'] as Mode[]).map((m) => (
              <Pressable
                key={m}
                onPress={() => {
                  setMode(m);
                  setError(null);
                  setInfo(null);
                }}
                style={[styles.toggleBtn, mode === m && styles.toggleActive]}>
                <T
                  variant="label"
                  color={mode === m ? c.black : c.textDim}>
                  {m === 'signup' ? t('auth.signup') : t('auth.signin')}
                </T>
              </Pressable>
            ))}
          </View>

          {/* Champs */}
          <View style={{ marginTop: Space.md, gap: Space.md }}>
            {mode === 'signup' && (
              <Field
                icon="person"
                placeholder={t('auth.name')}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            )}
            <Field
              icon="mail"
              placeholder={t('auth.email')}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Field
              icon="lock-closed"
              placeholder={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <Pressable accessibilityRole="button" onPress={() => router.push('/forgot-password')} style={{ paddingVertical: 16, alignItems: 'center' }}><T variant="small" color={c.accent}>{pr('forgot')}</T></Pressable>

          {error && (
            <View style={styles.alert}>
              <Ionicons name="alert-circle" size={16} color={c.danger} />
              <T variant="small" color={c.danger} style={{ flex: 1, marginLeft: 8 }}>
                {error}
              </T>
            </View>
          )}
          {info && (
            <View style={[styles.alert, { borderColor: c.primary }]}>
              <Ionicons name="checkmark-circle" size={16} color={c.accent} />
              <T variant="small" color={c.accent} style={{ flex: 1, marginLeft: 8 }}>
                {info}
              </T>
            </View>
          )}

          {/* Bouton email */}
          <Pressable
            onPress={submit}
            disabled={loading}
            style={[styles.cta, loading && { opacity: 0.7 }]}>
            {loading ? (
              <ActivityIndicator color={c.black} />
            ) : (
              <T variant="label" color={c.black} style={{ fontSize: 15 }}>
                {purchase ? mode === 'signup' ? 'CRÉER MON COMPTE ET CONTINUER' : 'ME CONNECTER ET CONTINUER' : mode === 'signup' ? t('auth.createAccount') : t('auth.doSignin')}
              </T>
            )}
          </Pressable>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4, marginTop: Space.xl }}>
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
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { icon: keyof typeof Ionicons.glyphMap }) {
  const { icon, ...rest } = props;
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.field}>
      <Ionicons name={icon} size={18} color={c.textMute} />
      <TextInput
        {...rest}
        placeholderTextColor={c.textMute}
        style={styles.input}
      />
    </View>
  );
}

function traduireErreur(msg: string, t: (k: string) => string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login')) return t('auth.errInvalid');
  if (m.includes('already registered') || m.includes('already been registered')) return t('auth.errExists');
  if (m.includes('password') && m.includes('6')) return t('auth.errPwd');
  if (m.includes('email') && m.includes('confirm')) return t('auth.errConfirm');
  return msg || t('auth.genericError');
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  scroll: { paddingHorizontal: Space.xl },
  toggle: {
    flexDirection: 'row',
    backgroundColor: c.surface,
    borderRadius: Radius.pill,
    padding: 4,
    marginTop: Space.xl,
    borderWidth: 1,
    borderColor: c.border,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    borderRadius: Radius.pill,
  },
  toggleActive: { backgroundColor: c.primary },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    color: c.text,
    fontSize: 15,
    paddingVertical: 15,
    marginLeft: 10,
  },
  alert: {
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
