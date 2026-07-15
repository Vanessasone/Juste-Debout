/**
 * Notifications push (Expo) — enregistrement du token + envoi via Edge Function.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Localization from 'expo-localization';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

let handlerSet = false;

/** Affiche les notifications même app au premier plan (à appeler une fois au démarrage). */
export function configureNotifications() {
  if (handlerSet || Platform.OS === 'web') return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'Général',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#A4FA00',
    }).catch(() => {});
  }
}

/** Demande la permission (si besoin) et enregistre le token push du membre connecté. */
export async function registerPushToken(): Promise<void> {
  if (Platform.OS === 'web' || !Device.isDevice) return;
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? (Constants as any)?.easConfig?.projectId;
  const tokenResp = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  const token = tokenResp.data;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !token) return;
  // Langue du membre → notifs « autour de toi » dans la bonne langue.
  const savedLang = await AsyncStorage.getItem('jd_lang').catch(() => null);
  const lang = savedLang || Localization.getLocales?.()?.[0]?.languageCode || 'en';
  await supabase.from('profile_location').upsert({ profile_id: user.id, push_token: token, lang });
}

/** Déclenche une notification push aux autres membres d'une conversation (via Edge Function). */
export async function notifyConversation(conversationId: string, body: string): Promise<void> {
  try {
    await supabase.functions.invoke('send-push', { body: { conversationId, body } });
  } catch {
    // silencieux : l'échec d'une notif ne doit jamais bloquer l'envoi du message
  }
}
