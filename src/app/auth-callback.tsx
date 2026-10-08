import { useCustomerText } from '@/lib/customerText';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const ct = useCustomerText();
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        if (params.get('error')) {
          setStatus(ct('authLinkError'));
          return;
        }
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        const code = new URLSearchParams(window.location.search).get('code');
        const { data, error } = access_token && refresh_token
          ? await supabase.auth.setSession({ access_token, refresh_token })
          : code ? await supabase.auth.exchangeCodeForSession(code)
          : await supabase.auth.getSession();
        if (cancelled) return;
        if (error || !data.session) {
          setStatus(ct('authError'));
          return;
        }
        window.history.replaceState(null, '', '/auth-callback');
        if (!cancelled) router.replace('/recover-tickets');
      } catch {
        if (!cancelled) setStatus(ct('authError'));
      }
    })();
    return () => { cancelled = true; };
  }, [router]);
  return <View style={styles.root}><ActivityIndicator /><Text style={styles.text}>{status ?? ct('connecting')}</Text><Pressable accessibilityRole="button" onPress={() => router.replace({ pathname: '/login', params: { recover: '1' } })} style={{ padding: 16, marginTop: 16 }}><Text style={{ color: '#B5FA42' }}>{ct('backLogin')}</Text></Pressable></View>;
}
const styles = StyleSheet.create({root:{flex:1,alignItems:'center',justifyContent:'center',padding:24,backgroundColor:'#0A0A0A'},text:{color:'#fff',marginTop:16,textAlign:'center'}});
