import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState('Finalisation de la connexion Google…');

  useEffect(() => {
    (async () => {
      try {
        if (typeof window === 'undefined') return;
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const access_token = hash.get('access_token');
        const refresh_token = hash.get('refresh_token');

        if (!access_token || !refresh_token) {
          setStatus('Connexion Google reçue, mais aucun jeton de session n’a été retourné.');
          return;
        }

        const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) {
          setStatus('Session Supabase refusée : ' + error.message);
          return;
        }
        if (!data.session) {
          setStatus('Google a répondu, mais aucune session Supabase n’a été créée.');
          return;
        }

        window.history.replaceState(null, '', '/auth-callback');
        router.replace('/(tabs)');
      } catch (e: any) {
        setStatus('Erreur OAuth : ' + (e?.message ?? String(e)));
      }
    })();
  }, [router]);

  return <View style={styles.root}><ActivityIndicator /><Text style={styles.text}>{status}</Text></View>;
}
const styles = StyleSheet.create({root:{flex:1,alignItems:'center',justifyContent:'center',padding:24,backgroundColor:'#0A0A0A'},text:{color:'#fff',marginTop:16,textAlign:'center'}});
