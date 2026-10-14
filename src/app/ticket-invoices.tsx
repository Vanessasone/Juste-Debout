import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Card, GButton, PageHeader, Screen, T } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { useColors } from '@/lib/theme';
import { getTicketInvoices, getTicketInvoiceUrl, type TicketInvoice } from '@/lib/ticketInvoices';
import { claimGuestTickets } from '@/lib/guestTickets';
import { supabase } from '@/lib/supabase';

export default function TicketInvoices() {
 const c=useColors(),router=useRouter(),{locale}=useI18n();
 const fr=locale==='fr';
 const [items,setItems]=useState<TicketInvoice[]>([]),[loading,setLoading]=useState(true);
 const [error,setError]=useState(false),[busy,setBusy]=useState<string|null>(null);
 const generation=useRef(0);
 const load=useCallback(async()=>{
  const current=++generation.current;setLoading(true);setError(false);setItems([]);
  try {
   const {data:{user},error:authError}=await supabase.auth.getUser();
   if(authError)throw authError;
   if(!user){router.replace({pathname:'/login',params:{recover:'1'}});return;}
   await claimGuestTickets();const result=await getTicketInvoices();
   const {data:{user:latest}}=await supabase.auth.getUser();
   if(current===generation.current&&latest?.id===user.id)setItems(result);
  } catch {if(current===generation.current)setError(true);}
  finally {if(current===generation.current)setLoading(false);}
 },[router]);
 useFocusEffect(useCallback(()=>{void load();return()=>{generation.current++;};},[load]));
 const download=async(id:string)=>{
  if(busy)return;setBusy(id);setError(false);
  try{await Linking.openURL(await getTicketInvoiceUrl(id));}catch{setError(true);}finally{setBusy(null);}
 };
 return <Screen>
  <PageHeader title={fr?'Mes factures':'My invoices'} subtitle={fr?'Vos achats de billets Juste Debout':'Your Juste Debout ticket purchases'}/>
  <T variant="small" color={c.textDim} style={{marginBottom:20}}>{fr?'Chaque facture est envoyée à l’adresse email utilisée lors de l’achat. Les achats sans compte sont retrouvés en vous connectant avec cette même adresse.':'Each invoice is emailed to the address used for purchase. Sign in with that same address to retrieve guest purchases.'}</T>
  {loading?<ActivityIndicator color={c.primary}/>:error?<Card><T>{fr?'Impossible de charger ou télécharger votre facture. Veuillez réessayer.':'Unable to load or download your invoice. Please try again.'}</T><GButton label={fr?'Réessayer':'Try again'} onPress={()=>void load()}/></Card>:items.length===0?<Card><T>{fr?'Aucune facture disponible pour le moment. Après un achat, la génération peut prendre quelques minutes.':'No invoices available yet. After a purchase, generation may take a few minutes.'}</T><GButton label={fr?'Actualiser':'Refresh'} onPress={()=>void load()}/></Card>:items.map(invoice=><Card key={invoice.id} style={{marginBottom:16}}>
   <T variant="h3">{invoice.snapshot.event.title}</T><T variant="small">{invoice.number}</T>
   <T variant="small" color={c.textDim}>{new Date(invoice.issued_at).toLocaleDateString(locale)} · {new Intl.NumberFormat(locale,{style:'currency',currency:invoice.snapshot.currency}).format(invoice.snapshot.total_cents/100)}</T>
   {invoice.ready_at?<GButton label={busy===invoice.id?(fr?'Ouverture…':'Opening…'):(fr?'Télécharger la facture PDF':'Download PDF invoice')} onPress={()=>void download(invoice.id)}/>:<T variant="small">{fr?'Votre PDF est en cours de préparation.':'Your PDF is being prepared.'}</T>}
  </Card>)}
  <Pressable accessibilityRole="button" onPress={()=>router.push('/wallet')} style={{paddingVertical:20}}><T color={c.primary}>{fr?'Retour à mes billets':'Back to my tickets'}</T></Pressable>
 </Screen>;
}
