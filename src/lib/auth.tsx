/**
 * Contexte d'authentification Juste Debout (Supabase Auth).
 * Fournit la session courante, l'utilisateur, et les actions connexion/déconnexion.
 */
import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@/lib/supabase';

/**
 * Consomme une session transmise dans le fragment d'URL (#…access_token…refresh_token…).
 * Couvre DEUX cas, tous deux basés sur le hash (jamais envoyé au serveur, effacé aussitôt) :
 *  - le SSO depuis l'app Juste Debout School (#sso=1&access_token=…&refresh_token=…) ;
 *  - le retour de connexion Google sur le web (#access_token=…&refresh_token=…&provider_token=…).
 * Web uniquement.
 */
async function consumeSsoFromUrl(): Promise<void> {
  if (typeof window === 'undefined' || !window.location?.hash || window.location.pathname === '/auth-callback') return;

  // Les callbacks OAuth web PKCE (?code=...) sont consommés automatiquement
  // par supabase-js (detectSessionInUrl=true). Ici on ne gère que le handoff
  // historique School / flux implicite contenant directement les tokens.
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return;

  const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
  if (!data.session) throw new Error('oauth_session_not_created');

  // Ne pas rester sur /login après un callback OAuth réussi.
  // Le replace retire aussi les tokens du hash.
  window.location.replace('/');
}

/**
 * Connexion / inscription avec Google (OAuth Supabase).
 * - Web : redirige la page vers Google puis revient (le hash est consommé au retour).
 * - Natif : ouvre la fenêtre d'auth système et récupère la session au retour.
 * Le même compte est créé automatiquement s'il n'existe pas encore.
 */
export async function signInWithGoogle(): Promise<void> {
  if (Platform.OS === 'web') {
    // Callback dédié : permet de diagnostiquer et finaliser OAuth avant de
    // revenir dans le routeur principal.
    const redirectTo = `${window.location.origin}/auth-callback`;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) throw error;
    if (!data?.url) throw new Error('google_no_url');

    // Important pour les PWA iOS : rester dans le même contexte de stockage.
    // Une navigation de la web-app conserve son localStorage, contrairement à
    // une fenêtre Safari séparée qui perd la session au retour.
    window.location.assign(data.url);
    return;
  }

  // Natif : flux via navigateur système.
  const redirectTo = Linking.createURL('auth-callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('google_no_url');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success' || !result.url) return; // annulé par l'utilisateur
  const frag = result.url.includes('#') ? result.url.split('#')[1] : result.url.split('?')[1] ?? '';
  const params = new URLSearchParams(frag);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (access_token && refresh_token) {
    const { error: sessErr } = await supabase.auth.setSession({ access_token, refresh_token });
    if (sessErr) throw sessErr;
  }
}

type AuthState = {
  session: Session | null;
  initializing: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  session: null,
  initializing: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        await consumeSsoFromUrl(); // session transmise depuis l'app School (si présente)
        const { data } = await supabase.auth.getSession();
        setSession(data.session);
      } catch {
        setSession(null);
      } finally {
        setInitializing(false);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      initializing,
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, initializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
