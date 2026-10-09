import { useI18n, LANGUAGES } from '@/lib/i18n';
import { useCustomerText } from '@/lib/customerText';
import { LanguagePicker } from '@/components/LanguagePicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GButton, Screen, T } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { acceptTicketTransfer } from '@/lib/tickets';
import { Space } from '@/constants/brand';

export default function ClaimTicket() {
  const { token, lang } = useLocalSearchParams<{ token?: string; lang?: string }>();
  const { setLocale } = useI18n();
  useEffect(()=>{if(lang && LANGUAGES.some(l=>l.code===lang)) void setLocale(lang);},[lang,setLocale]);
  const router = useRouter();
  const ct=useCustomerText();
  const [message, setMessage] = useState<Parameters<typeof ct>[0]>('claimCheck');
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    (async () => {
      if (!token) { setMessage('claimInvalid'); return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (token) await AsyncStorage.setItem('jd_pending_claim_token', token);
        setNeedsLogin(true);
        setMessage('claimLogin');
        return;
      }
      
      try {
        await acceptTicketTransfer(token);
        await AsyncStorage.removeItem('jd_pending_claim_token');
        setMessage('claimDone');
        setTimeout(() => router.replace('/(tabs)/tickets'), 900);
      } catch (e: any) {
        const m=String(e?.message??'');
        if(m.includes('wrong_recipient')) setMessage('claimWrong');
        else if(m.includes('holder_name_required')) setMessage('recipientNameRequired');
        else if(m.includes('transfer_unavailable')) setMessage('claimUnavailable');
        else setMessage('claimError');
      }
    })();
  }, [token]);

  return <Screen scroll={false}><View style={styles.center}>
    <LanguagePicker /><T variant="title" style={{textAlign:'center'}}>{ct('claimTitle')}</T>
    <T variant="small" style={{textAlign:'center',marginTop:Space.md}}>{ct(message)}</T>
    {needsLogin ? <GButton label={ct('claimAccount')} icon="person-add" onPress={()=>router.push('/login')} /> : message === 'claimCheck' || message === 'claimDone' ? <ActivityIndicator style={{marginTop:Space.xl}} /> : <GButton label={ct('wallet')} onPress={()=>router.replace('/wallet')} />}
  </View></Screen>;
}
const styles=StyleSheet.create({center:{flex:1,justifyContent:'center',padding:28,gap:16}});
