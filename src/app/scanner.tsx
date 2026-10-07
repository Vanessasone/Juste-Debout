/**
 * Scanner d'entrée (staff/admin) — scanne le QR d'un billet, valide l'entrée.
 * Caméra sur téléphone ; saisie manuelle en secours (web/test). Écran sombre.
 */
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { T } from '@/components/ui';
import { Palette, Radius, Space } from '@/constants/brand';
import { useT } from '@/lib/i18n';
import { getTicketByToken, scanTicketForToday } from '@/lib/tickets';

type Result = { status: 'ok' | 'used' | 'unknown' | 'error'; name?: string; msg?: string } | null;

export default function Scanner() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useT();
  const [permission, requestPermission] = useCameraPermissions();
  const [result, setResult] = useState<Result>(null);
  const [count, setCount] = useState(0);
  const [manual, setManual] = useState('');
  const processing = useRef(false);

  const handleToken = async (token: string) => {
    if (processing.current || !token.trim()) return;
    processing.current = true;
    try {
      const tk = await getTicketByToken(token);
      if (!tk) {
        setResult({ status: 'unknown' });
      } else {
        const name = tk.profiles?.full_name ?? tk.profiles?.alias ?? '';
        const scan = await scanTicketForToday(tk.id);
        if (scan.ok) {
          setResult({ status: 'ok', name });
          setCount((n) => n + 1);
        } else if (scan.error === 'already_scanned_today') {
          const time = scan.scanned_at
            ? new Date(scan.scanned_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
            : null;
          setResult({ status: 'used', name, msg: time ? `Déjà entré(e) à ${time} · sortie définitive` : 'Entrée déjà utilisée aujourd’hui · sortie définitive' });
        } else if (scan.error === 'wrong_day') {
          setResult({ status: 'error', name, msg: 'Billet non valable aujourd’hui' });
        } else if (scan.error === 'cancelled') {
          setResult({ status: 'error', name, msg: 'Billet annulé : accès refusé' });
        } else if (scan.error === 'scanner_forbidden') {
          setResult({ status: 'error', name, msg: 'Ce compte n’est pas autorisé à scanner les billets' });
        } else {
          setResult({ status: 'error', name, msg: 'Billet refusé : ' + (scan.error ?? 'vérification impossible') });
        }
      }
    } catch (e: any) {
      setResult({ status: 'error', msg: e?.message ?? 'Erreur' });
    } finally {
      setTimeout(() => {
        processing.current = false;
        setResult(null);
        setManual('');
      }, 2500);
    }
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  const overlayColor =
    result?.status === 'ok' ? Palette.success : result ? Palette.danger : 'transparent';

  return (
    <View style={styles.root}>
      {/* Caméra */}
      {permission?.granted ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={processing.current ? undefined : ({ data }) => handleToken(data)}
        />
      ) : (
        <View style={styles.permo}>
          <Ionicons name="camera" size={48} color={Palette.textMute} />
          <T variant="h2" color={Palette.white} style={{ marginTop: Space.md, textAlign: 'center' }}>
            {t('sc.allowCam')}
          </T>
          <Pressable onPress={requestPermission} style={styles.permBtn}>
            <T variant="label" color={Palette.black}>
              {t('sc.enableCam')}
            </T>
          </Pressable>
          <T variant="caption" color={Palette.textMute} style={{ marginTop: Space.md, textAlign: 'center' }}>
            {t('sc.computerHint')}
          </T>
        </View>
      )}

      {/* Cadre de visée */}
      {permission?.granted && !result && (
        <View style={styles.reticle} pointerEvents="none">
          <View style={styles.frame} />
          <T variant="label" color={Palette.white} style={{ marginTop: Space.lg }}>
            {t('sc.aim')}
          </T>
        </View>
      )}

      {/* Résultat */}
      {result && (
        <View style={[styles.result, { backgroundColor: overlayColor + 'F2' }]}>
          <Ionicons
            name={result.status === 'ok' ? 'checkmark-circle' : 'close-circle'}
            size={90}
            color={Palette.black}
          />
          <T variant="title" color={Palette.black} style={{ marginTop: Space.md, textAlign: 'center' }}>
            {result.status === 'ok'
              ? t('sc.ok')
              : result.status === 'used'
                ? t('sc.used')
                : result.status === 'unknown'
                  ? t('sc.unknown')
                  : t('sc.error')}
          </T>
          {!!result.name && (
            <T variant="h2" color={Palette.black} style={{ marginTop: 4 }}>
              {result.name}
            </T>
          )}
          {!!result.msg && (
            <T variant="label" color={Palette.black} style={{ marginTop: 10, textAlign: 'center' }}>
              {result.msg}
            </T>
          )}
        </View>
      )}

      {/* En-tête */}
      <View style={[styles.header, { top: insets.top + Space.sm }]}>
        <Pressable onPress={goBack} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={Palette.white} />
        </Pressable>
        <View style={styles.countPill}>
          <Ionicons name="people" size={14} color={Palette.black} />
          <T variant="label" color={Palette.black} style={{ marginLeft: 6 }}>
            {t('sc.entries', { n: count })}
          </T>
        </View>
      </View>

      {/* Saisie manuelle */}
      <View style={[styles.manual, { paddingBottom: insets.bottom + Space.md }]}>
        <TextInput
          value={manual}
          onChangeText={setManual}
          placeholder={t('sc.pastePh')}
          placeholderTextColor={Palette.textMute}
          style={styles.input}
          autoCapitalize="none"
          onSubmitEditing={() => handleToken(manual)}
        />
        <Pressable onPress={() => handleToken(manual)} style={styles.validate}>
          {processing.current ? (
            <ActivityIndicator color={Palette.black} size="small" />
          ) : (
            <Ionicons name="arrow-forward" size={20} color={Palette.black} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  permo: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Space.xl },
  permBtn: {
    backgroundColor: Palette.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: Radius.pill,
    marginTop: Space.xl,
  },
  reticle: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: 240,
    height: 240,
    borderRadius: Radius.xl,
    borderWidth: 3,
    borderColor: Palette.primary,
  },
  result: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Space.xl,
  },
  header: {
    position: 'absolute',
    left: Space.lg,
    right: Space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
  },
  manual: {
    position: 'absolute',
    left: Space.lg,
    right: Space.lg,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(20,20,20,0.9)',
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Palette.white,
    fontSize: 14,
  },
  validate: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
