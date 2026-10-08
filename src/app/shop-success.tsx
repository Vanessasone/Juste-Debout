import { useCustomerText } from '@/lib/customerText';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, T } from '@/components/ui';
import { supabase } from '@/lib/supabase';

export default function ShopSuccess() {
  const router = useRouter();
  const ct=useCustomerText();
  const { session_id } = useLocalSearchParams<{ session_id?: string }>();
  const [state, setState] = useState<'checking'|'paid'|'pending'|'unknown'>('checking');

  useEffect(() => {
    if (!session_id) { setState('unknown'); return; }
    let cancelled = false;
    let attempts = 0;
    const check = async () => {
      if (cancelled) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setState('unknown'); return; }
      const { data, error } = await supabase.from('orders')
        .select('status').eq('stripe_checkout_session_id', session_id)
        .eq('profile_id', user.id).maybeSingle();
      if (cancelled) return;
      if (error || !data) { setState('unknown'); return; }
      if (data.status === 'paid') { setState('paid'); return; }
      attempts += 1;
      if (attempts >= 8) { setState('pending'); return; }
      setTimeout(check, 1500);
    };
    check();
    return () => { cancelled = true; };
  }, [session_id]);

  return <Screen scroll={false}>
    <View style={styles.wrap}>
      {state === 'checking' ? <ActivityIndicator color="#B7FF00" size="large"/> :
        <Ionicons name={state === 'paid' ? 'checkmark-circle' : 'time-outline'} size={72} color="#B7FF00" />}
      <T variant="title" style={styles.center}>
        {state === 'paid' ? ct('paid') : state === 'checking' ? ct('checking') : ct('checkPayment')}
      </T>
      <T variant="small" style={styles.center}>
        {state === 'paid'
          ? ct('shopPaidBody')
          : ct('shopPendingBody')}
      </T>
      <Pressable onPress={() => router.replace('/my-orders')} style={styles.button}>
        <T variant="label" color="#000000">{ct('myOrders')}</T>
      </Pressable>
    </View>
  </Screen>;
}
const styles = StyleSheet.create({
  wrap:{flex:1,alignItems:'center',justifyContent:'center',padding:24,gap:24},
  center:{textAlign:'center'},
  button:{backgroundColor:'#B7FF00',borderRadius:100,paddingVertical:18,paddingHorizontal:24,alignItems:'center',alignSelf:'stretch'}
});
