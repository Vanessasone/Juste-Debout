import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, T } from '@/components/ui';
import { supabase } from '@/lib/supabase';

type PaymentState = 'checking' | 'paid' | 'pending' | 'unknown';
export default function TicketSuccess() {
  const router = useRouter();
  const { session_id } = useLocalSearchParams<{ session_id?: string }>();
  const [state, setState] = useState<PaymentState>('checking');

  useEffect(() => {
    if (!session_id) { setState('unknown'); return; }
    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = async () => {
      if (cancelled) return;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user) { setState('unknown'); return; }
        const { data, error } = await supabase.from('ticket_orders')
          .select('status').eq('stripe_checkout_session_id', session_id)
          .eq('user_id', user.id).maybeSingle();
        if (cancelled) return;
        if (error || !data) { setState('unknown'); return; }
        if (data.status === 'paid') { setState('paid'); return; }
        attempts++;
        if (attempts >= 12) { setState('pending'); return; }
        timer = setTimeout(check, 1500);
      } catch {
        if (!cancelled) setState('unknown');
      }
    };
    void check();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [session_id]);

  const paid = state === 'paid';
  return <Screen scroll={false}>
    <View style={styles.wrap}>
      {state === 'checking'
        ? <ActivityIndicator size="large" color="#B5FA42" />
        : <Ionicons name={paid ? 'checkmark-circle' : 'time-outline'} size={76} color="#B5FA42" />}
      <T variant="title" style={styles.center}>
        {paid ? 'PAIEMENT CONFIRMÉ' : state === 'checking' ? 'VÉRIFICATION DE TON PAIEMENT' : 'VÉRIFICATION EN COURS'}
      </T>
      <T variant="small" style={styles.center}>
        {paid
          ? 'Ton paiement Juste Debout est confirmé. Tes billets et QR codes sont disponibles dans ton portefeuille.'
          : 'Nous ne pouvons pas encore confirmer le statut de cette commande sur cet écran. Ne paie pas une deuxième fois : consulte ton portefeuille ou contacte la billetterie.'}
      </T>
      <Pressable accessibilityRole="button" onPress={() => router.replace('/wallet')} style={styles.button}>
        <T variant="label" color="#101010">ACCÉDER À MES BILLETS</T>
      </Pressable>
    </View>
  </Screen>;
}
const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 24 },
  center: { textAlign: 'center' },
  button: { backgroundColor: '#B5FA42', borderRadius: 100, paddingVertical: 18, paddingHorizontal: 24, alignItems: 'center', alignSelf: 'stretch' },
});