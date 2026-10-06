/**
 * Client Supabase — backend de Juste Debout (comptes, événements, inscriptions).
 *
 * Les identifiants sont lus depuis les variables d'environnement Expo (fichier .env) :
 *   EXPO_PUBLIC_SUPABASE_URL
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY
 * La clé « anon » est une clé PUBLIQUE, conçue pour être embarquée dans l'app.
 * (Ne jamais mettre la clé « service_role » ici.)
 */
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Vrai quand le fichier .env est correctement renseigné. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-anon-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // Cette app web/PWA s'ouvre depuis l'écran d'accueil iOS puis passe par
      // une fenêtre Safari pour OAuth. Le flux implicite évite de dépendre du
      // code_verifier PKCE stocké dans un contexte navigateur différent.
      detectSessionInUrl: false,
      flowType: 'implicit',
    },
  },
);
