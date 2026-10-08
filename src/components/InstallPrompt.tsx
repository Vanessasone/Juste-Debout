import { useCustomerText } from '@/lib/customerText';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Palette, Space } from '@/constants/brand';

const DISMISS_KEY = 'jd_install_dismissed_v3';

export function InstallPrompt() {
  const ct = useCustomerText();
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [guide, setGuide] = useState(false);
  const [deferred, setDeferred] = useState<any>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const w = window as any;
    if (w.matchMedia?.('(display-mode: standalone)').matches || w.navigator?.standalone === true) return;
    try {
      const dismissed = Number(w.localStorage?.getItem(DISMISS_KEY) || 0);
      if (dismissed && Date.now() - dismissed < 7 * 86400000) return;
    } catch {}
    const ua = w.navigator?.userAgent || '';
    const ios = /iphone|ipad|ipod/i.test(ua) || (w.navigator?.platform === 'MacIntel' && w.navigator?.maxTouchPoints > 1);
    setIsIOS(ios);
    if (ios || /android/i.test(ua)) setVisible(true);
    const onInstalled = () => { setVisible(false); setGuide(false); setDeferred(null); };
    const onPrompt = (event: any) => { event.preventDefault(); setDeferred(event); setVisible(true); };
    w.addEventListener('appinstalled', onInstalled);
    w.addEventListener('beforeinstallprompt', onPrompt);
    return () => {
      w.removeEventListener('appinstalled', onInstalled);
      w.removeEventListener('beforeinstallprompt', onPrompt);
    };
  }, []);

  const install = async () => {
    if (!deferred) { setGuide(true); return; }
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      setDeferred(null);
      if (choice?.outcome === 'accepted') setVisible(false);
      else setGuide(true);
    } catch { setDeferred(null); setGuide(true); }
  };
  const dismiss = () => {
    setVisible(false);
    setGuide(false);
    try { window.localStorage?.setItem(DISMISS_KEY, String(Date.now())); } catch {}
  };
  if (!visible) return null;
  const steps: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; detail: string }[] = isIOS ? [
    { icon: 'compass-outline', title: ct('safari'), detail: ct('safariHelp') },
    { icon: 'share-outline', title: ct('share'), detail: ct('shareHelp') },
    { icon: 'add-circle-outline', title: ct('addHome'), detail: ct('addHomeHelp') },
  ] : [
    { icon: 'logo-chrome', title: ct('chrome'), detail: ct('chromeHelp') },
    { icon: 'ellipsis-vertical', title: ct('menu'), detail: ct('menuHelp') },
    { icon: 'add-circle-outline', title: ct('install'), detail: ct('androidHelp') },
  ];
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Ionicons name="phone-portrait-outline" size={28} color={Palette.primary} />
        <Text style={styles.title}>{ct('installTitle')}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={ct('hideInstall')} onPress={dismiss} style={styles.close}>
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </Pressable>
      </View>
      <Text style={styles.description}>{ct('installBody')}</Text>
      <Pressable accessibilityRole="button" onPress={deferred && !isIOS ? install : () => setGuide(true)} style={styles.button}>
        <Ionicons name={deferred && !isIOS ? 'download-outline' : 'add-circle-outline'} size={22} color="#000000" />
        <Text style={styles.buttonText}>{deferred && !isIOS ? ct('install') : ct('howInstall')}</Text>
      </Pressable>
      <Modal visible={guide} transparent animationType="fade" onRequestClose={() => setGuide(false)}>
        <View style={styles.overlay}>
          <ScrollView style={styles.modal} contentContainerStyle={styles.modalContent}>
            <Text accessibilityRole="header" style={styles.guideTitle}>{ct('installOn', { device: isIOS ? 'iPhone / iPad' : 'Android' })}</Text>
            <Text style={styles.description}>{ct('installSteps')}</Text>
            {steps.map((step, index) => (
              <View key={step.title} style={styles.step}>
                <View style={styles.stepIcon}><Ionicons name={step.icon} size={28} color={Palette.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepTitle}>{index + 1}. {step.title}</Text>
                  <Text style={styles.description}>{step.detail}</Text>
                </View>
              </View>
            ))}
            <Text style={styles.description}>{ct('installedIcon')}</Text>
            <Pressable accessibilityRole="button" onPress={() => setGuide(false)} style={styles.button}>
              <Text style={styles.buttonText}>{ct('understood')}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { backgroundColor: '#080808', borderColor: Palette.primary, borderWidth: 1, borderRadius: 20, padding: 18, marginBottom: Space.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, color: '#FFFFFF', fontSize: 18, fontWeight: '700', lineHeight: 25 },
  close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  description: { color: '#E5E5E5', fontSize: 16, lineHeight: 24, marginTop: 8 },
  button: { backgroundColor: Palette.primary, minHeight: 48, borderRadius: 24, paddingVertical: 12, paddingHorizontal: 16, marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buttonText: { color: '#000000', fontSize: 16, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modal: { flexGrow: 0, maxHeight: '90%', width: '100%', maxWidth: 480, backgroundColor: '#080808', borderColor: Palette.primary, borderWidth: 1, borderRadius: 24 },
  modalContent: { padding: 24 },
  guideTitle: { color: '#FFFFFF', fontSize: 24, lineHeight: 30, fontWeight: '700' },
  step: { flexDirection: 'row', gap: 14, marginVertical: 14 },
  stepIcon: { width: 40, alignItems: 'center', paddingTop: 4 },
  stepTitle: { color: '#FFFFFF', fontSize: 18, lineHeight: 25, fontWeight: '700' },
});
