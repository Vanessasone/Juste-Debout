import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GButton, Screen, T } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { acceptTicketTransfer } from '@/lib/tickets';
import { Space } from '@/constants/brand';

export default function ClaimTicket() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const router = useRouter();
  const [message, setMessage] = useState('Vérification de ton invitation…');
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (token) await AsyncStorage.setItem('jd_pending_claim_token', token);
        setNeedsLogin(true);
        setMessage('Crée ton compte Juste Debout ou connecte-toi avec l’adresse email qui a reçu cette invitation.');
        return;
      }
      if (!token) { setMessage('Invitation invalide.'); return; }
      try {
        await acceptTicketTransfer(token);
        await AsyncStorage.removeItem('jd_pending_claim_token');
        setMessage('Ton billet est maintenant dans ton wallet.');
        setTimeout(() => router.replace('/(tabs)/tickets'), 900);
      } catch (e: any) {
        const m=String(e?.message??'');
        if(m.includes('wrong_recipient')) setMessage('Ce billet a été envoyé à une autre adresse email. Connecte-toi avec l’adresse qui a reçu l’invitation.');
        else if(m.includes('transfer_unavailable')) setMessage('Cette invitation a déjà été utilisée ou annulée.');
        else setMessage('Impossible de récupérer ce billet pour le moment.');
      }
    })();
  }, [token]);

  return <Screen scroll={false}><View style={styles.center}>
    <T variant="title" style={{textAlign:'center'}}>TON BILLET T’ATTEND 🎟️</T>
    <T variant="small" style={{textAlign:'center',marginTop:Space.md}}>{message}</T>
    {needsLogin ? <GButton label="Créer mon compte / me connecter" icon="person-add" onPress={()=>router.push('/login')} /> : <ActivityIndicator style={{marginTop:Space.xl}} />}
  </View></Screen>;
}
const styles=StyleSheet.create({center:{flex:1,justifyContent:'center',padding:28,gap:16}});
