/**
 * Contexte d'authentification Juste Debout (Supabase Auth).
 * Fournit la session courante, l'utilisateur, et les actions connexion/déconnexion.
 */
import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';

/**
 * SSO : récupère une session transmise par l'app Juste Debout School via le fragment
 * d'URL (#sso=1&access_token=…&refresh_token=…). Fragment jamais envoyé au serveur ;
 * effacé aussitôt. Web uniquement (le handoff se fait dans le navigateur).
 */
async function consumeSsoFromUrl(): Promise<void> {
  if (typeof window === 'undefined' || !window.location?.hash) return;
  const hash = window.location.hash;
  if (!hash.includes('sso=1')) return;
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (access_token && refresh_token) {
    await supabase.auth.setSession({ access_token, refresh_token });
  }
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
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
