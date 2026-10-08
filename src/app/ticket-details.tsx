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
    if(name.trim().length<2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())){setError('Renseigne ton nom et une adresse e-mail valide.');return;}
    if(email.trim().toLowerCase()!==confirmEmail.trim().toLowerCase()){setError('Les deux adresses e-mail doivent être identiques.');return;}
    setError('');setBusy(true);
    try{await startTicketCheckout({eventId:draft.eventId,items:[{productId:draft.productId,quantity:draft.quantity}],promoCode:draft.promoCode,guest:{email:email.trim(),name:name.trim(),locale}});}
    catch(e:any){const message=String(e?.message??'');setError(message.includes('sales_not_started')?'La billetterie ouvre le 8 octobre à 21 h, heure de Paris.':message.includes('invalid_or_expired_promo')?'Le code promotionnel est invalide ou n’est pas encore actif.':message.includes('sold_out')?'Ces places ne sont plus disponibles. Reviens à la billetterie.':message.includes('too_many_attempts')?'Trop de tentatives. Réessaie dans 30 minutes.':'Impossible de lancer le paiement. Réessaie.');setBusy(false);}
  };
  const input={backgroundColor:c.surface,color:c.text,borderWidth:1,borderColor:c.border,borderRadius:14,padding:16,fontSize:16};
  return <Screen><PageHeader title="Tes coordonnées" subtitle="2. Coordonnées · 3. Paiement sécurisé" />
    <T style={{marginBottom:20}}>Aucun compte à créer maintenant. Après le paiement, crée ton espace ou connecte-toi avec cette même adresse e-mail pour récupérer tes billets et QR codes.</T>
    {draft?<Card><T variant="h3">{draft.productName}</T><T style={{marginTop:8}}>{draft.quantity} pass{draft.promoCode?` · Code ${draft.promoCode}`:''}</T></Card>:<ActivityIndicator />}
    <View style={{gap:12,marginTop:20}}>
      <T>Nom et prénom</T><TextInput accessibilityLabel="Nom et prénom" value={name} onChangeText={setName} autoComplete="name" maxLength={120} style={input} />
      <T>E-mail de réception des billets</T><TextInput accessibilityLabel="E-mail de réception des billets" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" maxLength={254} style={input} />
      <T>Confirme ton e-mail</T><TextInput accessibilityLabel="Confirme ton e-mail" value={confirmEmail} onChangeText={setConfirmEmail} keyboardType="email-address" autoCapitalize="none" maxLength={254} style={input} />
      {!!error&&<T color={c.danger}>{error}</T>}
      {busy?<ActivityIndicator />:<GButton label="Continuer vers le paiement" onPress={()=>void pay()} />}
      <Pressable accessibilityRole="button" onPress={()=>router.replace('/billetterie')} style={{padding:16}}><T color={c.accent}>← Modifier mes places</T></Pressable>
    </View>
  </Screen>;
}
