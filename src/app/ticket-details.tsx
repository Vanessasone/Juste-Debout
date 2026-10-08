import { ticketProductText } from '@/lib/ticketProductText';
import { useCustomerText } from '@/lib/customerText';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { Screen, PageHeader, Card, T, GButton } from '@/components/ui';
import { readTicketDraft, TicketDraft } from '@/lib/ticketPurchase';
import { startTicketCheckout } from '@/lib/ticketing';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';

export default function TicketDetails() {
  const router=useRouter(), c=useColors();
  const {locale}=useI18n();
  const ct = useCustomerText();
  const [draft,setDraft]=useState<TicketDraft|null>(null);
  const [name,setName]=useState(''),[email,setEmail]=useState(''),[confirmEmail,setConfirmEmail]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{void (async()=>{
    const saved=await readTicketDraft();
    if(!saved){router.replace('/billetterie');return;}
    setDraft(saved);
    const {data:{user}}=await supabase.auth.getUser();
    if(user){setEmail(user.email??'');setConfirmEmail(user.email??'');setName(user.user_metadata?.full_name??'');}
  })();},[]);
  const pay=async()=>{
    if(!draft) return;
    if(name.trim().length<2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())){setError(ct('invalidContact'));return;}
    if(email.trim().toLowerCase()!==confirmEmail.trim().toLowerCase()){setError(ct('mismatch'));return;}
    setError('');setBusy(true);
    try{await startTicketCheckout({eventId:draft.eventId,items:[{productId:draft.productId,quantity:draft.quantity}],promoCode:draft.promoCode,guest:{email:email.trim(),name:name.trim(),locale}});}
    catch(e:any){const message=String(e?.message??'');setError(message.includes('sales_not_started')?ct('notOpen'):message.includes('invalid_or_expired_promo')?ct('invalidPromo'):message.includes('sold_out')?ct('soldOutError'):message.includes('too_many_attempts')?ct('rateLimit'):ct('payError'));setBusy(false);}
  };
  const input={backgroundColor:c.surface,color:c.text,borderWidth:1,borderColor:c.border,borderRadius:14,padding:16,fontSize:16};
  return <Screen><PageHeader title={ct('details')} subtitle={ct('detailSteps')} />
    <T style={{marginBottom:20}}>{ct('noAccount')}</T>
    {draft?<Card><T variant="h3">{ticketProductText(draft.productCode ?? '', locale, {name:draft.productName}).name}</T><T style={{marginTop:8}}>{draft.quantity} pass{draft.promoCode?` · Code ${draft.promoCode}`:''}</T></Card>:<ActivityIndicator />}
    <View style={{gap:12,marginTop:20}}>
      <T>{ct('name')}</T><TextInput accessibilityLabel={ct('name')} value={name} onChangeText={setName} autoComplete="name" maxLength={120} style={input} />
      <T>{ct('email')}</T><TextInput accessibilityLabel={ct('email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" maxLength={254} style={input} />
      <T>{ct('confirmEmail')}</T><TextInput accessibilityLabel={ct('confirmEmail')} value={confirmEmail} onChangeText={setConfirmEmail} keyboardType="email-address" autoCapitalize="none" maxLength={254} style={input} />
      {!!error&&<T color={c.danger}>{error}</T>}
      {busy?<ActivityIndicator />:<GButton label={ct('pay')} onPress={()=>void pay()} />}
      <Pressable accessibilityRole="button" onPress={()=>router.replace('/billetterie')} style={{padding:16}}><T color={c.accent}>{ct('edit')}</T></Pressable>
    </View>
  </Screen>;
}
