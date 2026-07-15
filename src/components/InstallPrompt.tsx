/**
 * Bannière « Ajouter à l'écran d'accueil » (PWA) — WEB uniquement.
 * - Android / Chrome desktop : bouton d'installation natif (événement beforeinstallprompt).
 * - iOS Safari : instructions (Partager → Sur l'écran d'accueil), car iOS n'expose pas d'install auto.
 * Masquable et mémorisé (localStorage) pour ne pas insister.
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { T } from '@/components/ui';
import { Palette, Radius, Space } from '@/constants/brand';
import { useT } from '@/lib/i18n';

const DISMISS_KEY = 'jd_install_dismissed';

export function InstallPrompt() {
  const t = useT();
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferred, setDeferred] = useState<any>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const w = window as any;
    const standalone =
      w.matchMedia?.('(display-mode: standalone)').matches || w.navigator?.standalone === true;
    if (standalone) return; // déjà installée
    try {
      if (w.localStorage?.getItem(DISMISS_KEY) === '1') return;
    } catch {
      /* localStorage indisponible */
    }

    const ua = w.navigator?.userAgent || '';
    if (/iphone|ipad|ipod/i.test(ua)) {
      setIsIOS(true);
      setVisible(true);
      return;
    }
    const onBip = (e: any) => {
      e.preventDefault();
      setDeferred(e);
      setVisible(true);
    };
    w.addEventListener('beforeinstallprompt', onBip);
    return () => w.removeEventListener('beforeinstallprompt', onBip);
  }, []);

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice?.catch(() => {});
    setDeferred(null);
    dismiss();
  };
  const dismiss = () => {
    setVisible(false);
    try {
      (window as any).localStorage?.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.wrap}>
      <Ionicons name="phone-portrait-outline" size={22} color={Palette.primary} />
      <View style={{ flex: 1 }}>
        <T variant="label" color={Palette.white}>
          {t('install.title')}
        </T>
        <T variant="caption" color={Palette.textDim} style={{ marginTop: 2 }}>
          {isIOS ? t('install.ios') : t('install.android')}
        </T>
      </View>
      {!isIOS && deferred ? (
        <Pressable onPress={install} style={styles.cta}>
          <T variant="label" color={Palette.black}>
            {t('install.cta')}
          </T>
        </Pressable>
      ) : null}
      <Pressable onPress={dismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close" size={18} color={Palette.textMute} />
      </Pressable>
    </View>
  );
}

const styles = {
  wrap: {
    backgroundColor: Palette.black,
    borderColor: Palette.primary,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: 14,
    marginBottom: Space.md,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  cta: {
    backgroundColor: Palette.primary,
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
};
