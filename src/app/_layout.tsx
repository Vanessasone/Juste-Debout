import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { WELCOME_FLAG } from '@/app/welcome';
import { AuthProvider, useAuth } from '@/lib/auth';
import { I18nProvider } from '@/lib/i18n';
import { configureNotifications, registerPushToken } from '@/lib/push';
import { ThemeProvider, useThemeMode } from '@/lib/theme';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, initializing } = useAuth();
  const { scheme, colors } = useThemeMode();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (initializing) return;
    let cancelled = false;
    (async () => {
      // auth-callback doit rester accessible sans session : c'est précisément
      // cette route qui crée la session après le retour Google.
      const publicRoutes = ['login', 'legal', 'auth-callback', 'claim-ticket'];
      const inPublic = publicRoutes.includes(segments[0]);
      if (!session && !inPublic) {
        router.replace('/login');
        return;
      }
      if (session) {
        // Cérémonie d'accueil une seule fois (première connexion sur l'appareil).
        const welcomed = await AsyncStorage.getItem(WELCOME_FLAG).catch(() => '1');
        if (cancelled) return;
        if (welcomed !== '1' && segments[0] !== 'welcome') {
          router.replace('/welcome');
        } else if (welcomed === '1' && (segments[0] === 'login' || segments[0] === 'welcome')) {
          router.replace('/(tabs)');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, initializing, segments, router]);

  // Notifications : configuration + enregistrement du token à la connexion.
  useEffect(() => {
    configureNotifications();
    if (session) registerPushToken().catch(() => {});
  }, [session]);

  // Tap sur une notification de message → ouvre la conversation.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const data = resp.notification.request.content.data as { conversationId?: string };
      if (data?.conversationId) {
        router.push({ pathname: '/chat/[id]', params: { id: data.conversationId } } as never);
      }
    });
    return () => sub.remove();
  }, [router]);

  return (
    <>
      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="register" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="wallet" />
        <Stack.Screen name="scanner" />
        <Stack.Screen name="school" />
        <Stack.Screen name="organizer" />
        <Stack.Screen name="create-event" />
        <Stack.Screen name="legal/privacy" />
        <Stack.Screen name="legal/terms" />
        <Stack.Screen name="legal/notice" />
        <Stack.Screen name="ranking" />
        <Stack.Screen name="tour" />
        <Stack.Screen name="video" />
        <Stack.Screen name="direct" />
        <Stack.Screen name="commentator" />
        <Stack.Screen name="pronostics" />
        <Stack.Screen name="regie" />
        <Stack.Screen name="judge" />
        <Stack.Screen name="live" />
        <Stack.Screen name="bracket" />
        <Stack.Screen name="bracket-live" />
        <Stack.Screen name="companion" options={{ presentation: 'modal' }} />
        <Stack.Screen name="learning" />
        <Stack.Screen name="jobs" />
        <Stack.Screen name="hall-of-fame" />
        <Stack.Screen name="fantasy" />
        <Stack.Screen name="checkout" />
        <Stack.Screen name="admin-orders" />
        <Stack.Screen name="passport" />
        <Stack.Screen name="dancer/[id]" />
        <Stack.Screen name="admin-certs" />
        <Stack.Screen name="admin-events" />
        <Stack.Screen name="messages" />
        <Stack.Screen name="chat/[id]" />
        <Stack.Screen name="nearby" />
        <Stack.Screen name="watch" />
        <Stack.Screen name="coins" />
        <Stack.Screen name="earnings" />
        <Stack.Screen name="live-admin" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    // Police d'icônes Ionicons — indispensable sur web (sinon icônes = carrés vides).
    ...Ionicons.font,
    FKScreamer: require('@/assets/fonts/FKScreamer.ttf'),
    Ticketing: require('@/assets/fonts/Ticketing.ttf'),
    AirportDot: require('@/assets/fonts/AirportDot.ttf'),
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <I18nProvider>
        <ThemeProvider>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </ThemeProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
