import { useCustomerText } from '@/lib/customerText';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { Screen, T, GButton } from '@/components/ui';
import { claimGuestTickets } from '@/lib/guestTickets';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WELCOME_FLAG } from '@/app/welcome';

export default function RecoverTickets() {
  const router=useRouter();
  const ct = useCustomerText();
  const [error,setError]=useState(false);
  const recover=async()=>{
    setError(false);
    try { await claimGuestTickets(); await AsyncStorage.setItem(WELCOME_FLAG,'1'); router.replace('/wallet'); }
    catch {setError(true);}
  };
  useEffect(()=>{void recover();},[]);
  return <Screen scroll={false}><View style={{flex:1,justifyContent:'center',alignItems:'center',gap:20,padding:24}}>
    <T variant="title" style={{textAlign:'center'}}>{ct('recover')}</T>
    {error ? <><T style={{textAlign:'center'}}>{ct('verifyEmail')}</T><GButton label={ct('retry')} onPress={()=>void recover()} /><GButton label={ct('wallet')} onPress={()=>router.replace('/wallet')} /></> : <ActivityIndicator />}
  </View></Screen>;
}
