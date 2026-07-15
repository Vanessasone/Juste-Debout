/**
 * Ouvre l'app Juste Debout School (web) avec transfert de session (SSO).
 *
 * La session Supabase courante (mêmes projet/compte que l'app événement) est passée
 * dans le FRAGMENT `#` de l'URL — qui n'est JAMAIS envoyé au serveur (reste côté client).
 * L'app School lit ce fragment, appelle `supabase.auth.setSession(...)`, puis efface l'URL.
 * S'il n'y a pas de session, on ouvre simplement l'app (login côté School).
 */
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@/lib/supabase';

export const SCHOOL_APP_URL = 'https://justedeboutschoolapp.netlify.app';

export async function openSchoolApp(): Promise<void> {
  let url = SCHOOL_APP_URL;
  try {
    const { data } = await supabase.auth.getSession();
    const s = data.session;
    if (s?.access_token && s?.refresh_token) {
      const frag =
        `sso=1` +
        `&access_token=${encodeURIComponent(s.access_token)}` +
        `&refresh_token=${encodeURIComponent(s.refresh_token)}`;
      url = `${SCHOOL_APP_URL}/#${frag}`;
    }
  } catch {
    // Pas de session récupérable → ouverture simple.
  }
  await WebBrowser.openBrowserAsync(url);
}
