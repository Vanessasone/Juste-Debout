/**
 * Réglages — apparence (mode Système / Clair / Sombre), documents légaux, compte.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Card, IconBubble, PageHeader, Screen, Section, T } from '@/components/ui';
import { Radius, Space } from '@/constants/brand';
import { deleteMyAccount } from '@/lib/account';
import { LANGUAGES, useI18n } from '@/lib/i18n';
import { ThemeMode, useColors, useThemeMode } from '@/lib/theme';

const OPTIONS: { key: ThemeMode; lk: string; icon: keyof typeof Ionicons.glyphMap; sk: string }[] = [
  { key: 'system', lk: 'st.system', icon: 'phone-portrait', sk: 'st.systemSub' },
  { key: 'light', lk: 'st.light', icon: 'sunny', sk: 'st.lightSub' },
  { key: 'dark', lk: 'st.dark', icon: 'moon', sk: 'st.darkSub' },
];

const LEGAL: { lk: string; route: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { lk: 'st.terms', route: '/legal/terms', icon: 'document-text' },
  { lk: 'st.privacy', route: '/legal/privacy', icon: 'shield-checkmark' },
  { lk: 'st.notice', route: '/legal/notice', icon: 'information-circle' },
];

export default function Settings() {
  const c = useColors();
  const router = useRouter();
  const { mode, setMode } = useThemeMode();
  const { locale, setLocale, t } = useI18n();

  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteMyAccount();
      // La session est effacée → le garde d'auth redirige vers /login.
    } catch (e: any) {
      setError(e?.message ?? t('st.deleteFail'));
      setDeleting(false);
      setConfirming(false);
    }
  };

  return (
    <Screen>
      <PageHeader title={t('settings.title')} subtitle={t('st.sub')} />

      <Section title={t('settings.language')}>
        <View style={styles.langGrid}>
          {LANGUAGES.map((l) => {
            const active = locale === l.code;
            return (
              <Pressable
                key={l.code}
                onPress={() => setLocale(l.code)}
                style={[styles.langChip, { borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primary + '18' : c.surface }]}>
                <T style={{ fontSize: 18 }}>{l.flag}</T>
                <T variant="small" color={active ? c.accent : c.text} style={{ marginLeft: 8, fontWeight: active ? '700' : '400' }}>
                  {l.label}
                </T>
                {active ? <Ionicons name="checkmark" size={15} color={c.accent} style={{ marginLeft: 6 }} /> : null}
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section title={t('st.appearance')}>
        <View style={{ gap: Space.md }}>
          {OPTIONS.map((o) => {
            const active = mode === o.key;
            return (
              <Pressable
                key={o.key}
                onPress={() => setMode(o.key)}
                style={[
                  styles.row,
                  { backgroundColor: c.surface, borderColor: active ? c.primary : c.border },
                ]}>
                <IconBubble icon={o.icon} color={c.accent} size={44} />
                <View style={{ flex: 1, marginLeft: Space.md }}>
                  <T variant="h3">{t(o.lk)}</T>
                  <T variant="small" color={c.textDim} style={{ marginTop: 2 }}>
                    {t(o.sk)}
                  </T>
                </View>
                {active ? (
                  <Ionicons name="checkmark-circle" size={24} color={c.accent} />
                ) : (
                  <Ionicons name="ellipse-outline" size={24} color={c.textMute} />
                )}
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section title={t('st.legalSection')}>
        <Card style={{ padding: 0 }}>
          {LEGAL.map((l, i) => (
            <Pressable
              key={l.route}
              onPress={() => router.push(l.route as never)}
              style={[styles.legalRow, i > 0 && { borderTopWidth: 1, borderTopColor: c.borderSoft }]}>
              <Ionicons name={l.icon} size={20} color={c.accent} />
              <T variant="body" color={c.text} style={{ flex: 1, marginLeft: Space.md }}>
                {t(l.lk)}
              </T>
              <Ionicons name="chevron-forward" size={18} color={c.textMute} />
            </Pressable>
          ))}
        </Card>
      </Section>

      <Section title={t('settings.account')}>
        <Card>
          <T variant="small" color={c.textDim}>
            {t('st.deleteWarn')}
          </T>

          {error && (
            <T variant="small" color={c.danger} style={{ marginTop: Space.md }}>
              {error}
            </T>
          )}

          {!confirming ? (
            <Pressable onPress={() => setConfirming(true)} style={[styles.dangerBtn, { borderColor: c.danger }]}>
              <Ionicons name="trash" size={16} color={c.danger} />
              <T variant="label" color={c.danger} style={{ marginLeft: 8 }}>
                {t('settings.deleteAccount')}
              </T>
            </Pressable>
          ) : (
            <View style={{ marginTop: Space.md, gap: Space.sm }}>
              <T variant="small" color={c.text}>
                {t('st.deleteConfirm')}
              </T>
              <View style={{ flexDirection: 'row', gap: Space.sm }}>
                <Pressable
                  onPress={() => setConfirming(false)}
                  disabled={deleting}
                  style={[styles.ghostBtn, { borderColor: c.border }]}>
                  <T variant="label" color={c.text}>
                    {t('common.cancel')}
                  </T>
                </Pressable>
                <Pressable
                  onPress={remove}
                  disabled={deleting}
                  style={[styles.confirmBtn, { backgroundColor: c.danger }, deleting && { opacity: 0.6 }]}>
                  {deleting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <T variant="label" color="#fff">
                      {t('st.deleteYes')}
                    </T>
                  )}
                </Pressable>
              </View>
            </View>
          )}
        </Card>
      </Section>

      <T variant="caption" color={c.textMute} style={{ marginTop: Space.xl, textAlign: 'center' }}>
        {t('st.footer')}
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  langGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
  langChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: Radius.pill,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    padding: Space.lg,
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: Space.lg,
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: Radius.pill,
    paddingVertical: 13,
    marginTop: Space.md,
  },
  ghostBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingVertical: 13,
  },
  confirmBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
    paddingVertical: 13,
    minHeight: 44,
  },
});
