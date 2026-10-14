import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, TextInput } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Card, GButton, PageHeader, Screen, T } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { useColors } from '@/lib/theme';
import { getTicketInvoices, getTicketInvoiceUrl, getMissingInvoiceDetails, completeInvoiceDetails, type TicketInvoice, type MissingInvoiceDetails } from '@/lib/ticketInvoices';
import { claimGuestTickets } from '@/lib/guestTickets';
import { supabase } from '@/lib/supabase';

export default function TicketInvoices() {
 const c=useColors(),router=useRouter(),{locale}=useI18n();
 const fr=locale==='fr';
 const [items,setItems]=useState<TicketInvoice[]>([]),[loading,setLoading]=useState(true);
 const [error,setError]=useState(false),[busy,setBusy]=useState<string|null>(null);
 const [missing,setMissing]=useState<MissingInvoiceDetails[]>([]);
 const [billing,setBilling]=useState({name:'',line1:'',line2:'',postal_code:'',city:'',state:'',country:''});
 const billingOwner=useRef<string|null>(null);
 const [saving,setSaving]=useState(false),[billingError,setBillingError]=useState(false),[billingSaved,setBillingSaved]=useState(false);
 const generation=useRef(0);
 const load=useCallback(async()=>{
  const current=++generation.current;setLoading(true);setError(false);setItems([]);setMissing([]);
  try {
   const {data:{user},error:authError}=await supabase.auth.getUser();
   if(authError)throw authError;
   if(!user){router.replace({pathname:'/login',params:{recover:'1'}});return;}
   if(billingOwner.current!==user.id){billingOwner.current=user.id;setBilling({name:'',line1:'',line2:'',postal_code:'',city:'',state:'',country:''});setBillingSaved(false);setBillingError(false);}
   await claimGuestTickets();const [result,incomplete]=await Promise.all([getTicketInvoices(),getMissingInvoiceDetails(user.id)]);
   const {data:{user:latest}}=await supabase.auth.getUser();
   if(current===generation.current&&latest?.id===user.id){setItems(result);setMissing(incomplete);setBilling(previous=>({...previous,name:previous.name||incomplete[0]?.customer_name||''}));}
  } catch {if(current===generation.current)setError(true);}
  finally {if(current===generation.current)setLoading(false);}
 },[router]);
 useFocusEffect(useCallback(()=>{void load();return()=>{generation.current++;};},[load]));
 const download=async(id:string)=>{
  if(busy)return;setBusy(id);setError(false);
  try{await Linking.openURL(await getTicketInvoiceUrl(id));}catch{setError(true);}finally{setBusy(null);}
 };
 const saveBilling=async()=>{
  if(saving)return;
  if(billing.name.trim().length<2||billing.line1.trim().length<2||!billing.city.trim()||!/^[a-z]{2}$/i.test(billing.country.trim())||(billing.country.toUpperCase()==='FR'&&!/^\d{5}$/.test(billing.postal_code.trim()))){setBillingError(true);return;}
  setSaving(true);setBillingError(false);
  try{const {name,...address}=billing;await completeInvoiceDetails(name,{...address,country:address.country.trim().toUpperCase()});setBillingSaved(true);await load();}
  catch{setBillingError(true);}finally{setSaving(false);}
 };
 return <Screen>
  <PageHeader title={fr?'Mes factures':'My invoices'} subtitle={fr?'Vos achats de billets Juste Debout':'Your Juste Debout ticket purchases'}/>
  <T variant="small" color={c.textDim} style={{marginBottom:20}}>{fr?'Chaque facture est envoyée à l’adresse email utilisée lors de l’achat. Les achats sans compte sont retrouvés en vous connectant avec cette même adresse.':'Each invoice is emailed to the address used for purchase. Sign in with that same address to retrieve guest purchases.'}</T>
  {billingSaved?<Card style={{marginBottom:16}}><T>{fr?'Vos coordonnées ont été enregistrées. Vos factures seront générées et envoyées automatiquement par email.':'Your billing details have been saved. Your invoices will be generated and emailed automatically.'}</T></Card>:null}
  {!loading&&missing.length>0?<Card style={{marginBottom:16}}>
   <T variant="h3">{fr?'Compléter mes coordonnées de facturation':'Complete my billing details'}</T>
   <T variant="small" color={c.textDim} style={{marginVertical:12}}>{fr?`Pour établir les factures de vos ${missing.length} achat(s), renseignez votre nom et votre adresse. Un seul formulaire suffit.`:`To issue invoices for your ${missing.length} purchase(s), please enter your name and address. One form covers these purchases.`}</T>
   {([
    ['name',fr?'Nom complet ou raison sociale':'Full name or company name'],
    ['line1',fr?'Adresse':'Address'],['line2',fr?'Complément (facultatif)':'Address line 2 (optional)'],
    ['postal_code',fr?'Code postal':'Postal code'],['city',fr?'Ville':'City'],
    ['state',fr?'Région / État (facultatif)':'Region / State (optional)'],
    ['country',fr?'Pays : code à 2 lettres (FR, US, JP…)':'Country: 2-letter code (FR, US, JP…)']
   ] as [keyof typeof billing,string][]).map(([key,label])=><TextInput key={key} accessibilityLabel={label} placeholder={label} placeholderTextColor={c.textDim}
    value={billing[key]} onChangeText={value=>setBilling(previous=>({...previous,[key]:value}))} editable={!saving}
    autoCapitalize={key==='country'?'characters':'words'} maxLength={key==='country'?2:key==='name'?160:240}
    style={{borderColor:c.border,borderWidth:1,borderRadius:10,padding:12,marginBottom:10,color:c.text}}/>)}
   {billingError?<T variant="small" color={c.danger}>{fr?'Vérifiez votre nom, adresse, ville et code pays, puis réessayez.':'Check your name, address, city and country code, then try again.'}</T>:null}
   <GButton label={saving?(fr?'Enregistrement…':'Saving…'):(fr?'Enregistrer et recevoir mes factures':'Save and receive my invoices')} onPress={()=>void saveBilling()}/>
  </Card>:null}
  {loading?<ActivityIndicator color={c.primary}/>:error?<Card><T>{fr?'Impossible de charger ou télécharger votre facture. Veuillez réessayer.':'Unable to load or download your invoice. Please try again.'}</T><GButton label={fr?'Réessayer':'Try again'} onPress={()=>void load()}/></Card>:items.length===0?<Card><T>{fr?'Aucune facture disponible pour le moment. Après un achat, la génération peut prendre quelques minutes.':'No invoices available yet. After a purchase, generation may take a few minutes.'}</T><GButton label={fr?'Actualiser':'Refresh'} onPress={()=>void load()}/></Card>:items.map(invoice=><Card key={invoice.id} style={{marginBottom:16}}>
   <T variant="h3">{invoice.snapshot.event.title}</T><T variant="small">{invoice.number}</T>
   <T variant="small" color={c.textDim}>{new Date(invoice.issued_at).toLocaleDateString(locale)} · {new Intl.NumberFormat(locale,{style:'currency',currency:invoice.snapshot.currency}).format(invoice.snapshot.total_cents/100)}</T>
   {invoice.ready_at?<GButton label={busy===invoice.id?(fr?'Ouverture…':'Opening…'):(fr?'Télécharger la facture PDF':'Download PDF invoice')} onPress={()=>void download(invoice.id)}/>:<T variant="small">{fr?'Votre PDF est en cours de préparation.':'Your PDF is being prepared.'}</T>}
  </Card>)}
  <Pressable accessibilityRole="button" onPress={()=>router.push('/wallet')} style={{paddingVertical:20}}><T color={c.primary}>{fr?'Retour à mes billets':'Back to my tickets'}</T></Pressable>
 </Screen>;
}
