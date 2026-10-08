import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, PageHeader, T } from '@/components/ui';
import { LanguagePicker } from '@/components/LanguagePicker';
import { useColors } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { usePasswordResetText } from '@/lib/passwordResetText';

export function PasswordResetScreen({ update = false }: { update?: boolean }) {
  const c = useColors();
  const t = usePasswordResetText();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(!update);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [lastSent, setLastSent] = useState(0);
  useEffect(() => {
    if (!update) return;
    let active = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      setReady(!error && Boolean(data.user));
      if (error || !data.user) setError(t('expired'));
    }).catch(() => { if (active) setError(t('expired')); });
    return () => { active = false; };
  }, [update]);
  const submit = async () => {
    if (busy || done || !ready) return;
    setError('');
    if (update && (password.length < 6 || password !== confirm)) { setError(t('mismatch')); return; }
    if (!update && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError(t('invalidEmail')); return; }
    if (!update && Date.now() - lastSent < 60000) { setError(t('cooldown')); return; }
    setBusy(true);
    try {
      const { error } = update
        ? await supabase.auth.updateUser({ password })
        : await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: 'https://justedeboutapp.com/auth-callback' });
      if (error) throw error;
      if (!update) setLastSent(Date.now());
      setPassword(''); setConfirm(''); setDone(true);
    } catch { setError(t('error')); }
    finally { setBusy(false); }
  };
  const field = { color: c.text, backgroundColor: c.surface, borderColor: c.border, borderWidth: 1, borderRadius: 14, padding: 16, fontSize: 16 };
  return <Screen>
    <LanguagePicker />
    <PageHeader title={t(update ? 'newTitle' : 'requestTitle')} />
    {!update && <T variant="small" color={c.textDim}>{t('requestSub')}</T>}
    {!done && <View style={{ gap: 16, marginTop: 24 }}>
      {update ? <>
        <TextInput accessibilityLabel={t('password')} placeholder={t('password')} placeholderTextColor={c.textMute} secureTextEntry autoCapitalize="none" autoComplete="new-password" value={password} onChangeText={setPassword} style={field} />
        <TextInput accessibilityLabel={t('confirm')} placeholder={t('confirm')} placeholderTextColor={c.textMute} secureTextEntry autoCapitalize="none" autoComplete="new-password" value={confirm} onChangeText={setConfirm} style={field} />
      </> : <TextInput accessibilityLabel={t('email')} placeholder={t('email')} placeholderTextColor={c.textMute} keyboardType="email-address" autoCapitalize="none" autoComplete="email" value={email} onChangeText={setEmail} style={field} />}
      <Pressable accessibilityRole="button" disabled={busy || !ready} onPress={submit} style={{ backgroundColor: c.primary, borderRadius: 30, padding: 18, alignItems: 'center', opacity: busy || !ready ? 0.5 : 1 }}>
        {busy ? <ActivityIndicator color={c.black} /> : <T variant="label" color={c.black}>{t(update ? 'save' : 'send')}</T>}
      </Pressable>
    </View>}
    {!!error && <T variant="small" color={c.danger} style={{ marginTop: 16 }}>{error}</T>}
    {done && <T variant="small" style={{ marginTop: 24 }}>{t(update ? 'saved' : 'sent')}</T>}
    {done && update && <Pressable accessibilityRole="button" onPress={() => router.replace('/recover-tickets')} style={{ padding: 18, marginTop: 16, backgroundColor: c.primary, borderRadius: 30 }}><T color={c.black}>{t('tickets')}</T></Pressable>}
    {update && !ready && !!error && <Pressable accessibilityRole="button" onPress={() => router.replace('/forgot-password')} style={{ padding: 16 }}><T color={c.accent}>{t('send')}</T></Pressable>}
    <Pressable accessibilityRole="button" onPress={() => router.replace('/login')} style={{ paddingVertical: 20 }}><T variant="small" color={c.accent}>{t('back')}</T></Pressable>
  </Screen>;
}
