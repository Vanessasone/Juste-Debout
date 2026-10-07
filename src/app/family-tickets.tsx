import { useEffect, useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Card, PageHeader, Screen, T } from '@/components/ui';
import { Space } from '@/constants/brand';
import { useColors } from '@/lib/theme';
import { getMyTickets, Ticket } from '@/lib/tickets';
import { supabase } from '@/lib/supabase';

export default function FamilyTickets() {
 const { item } = useLocalSearchParams<{item?:string}>();
 const router=useRouter(); const c=useColors();
 const [tickets,setTickets]=useState<Ticket[]>([]);
 const [names,setNames]=useState<Record<string,string>>({});
 const [births,setBirths]=useState<Record<string,string>>({});
 const [busy,setBusy]=useState(false);
 const load=async()=>{
  const all=await getMyTickets();
  const family=all.filter(t=>t.order_item_id===item && t.ticket_products?.code?.startsWith('family_'));
  setTickets(family);
  setNames(Object.fromEntries(family.map(t=>[t.id,t.holder_name||''])));
 };
 useEffect(()=>{load().catch(()=>Alert.alert('Erreur','Impossible de charger les billets familiaux.'));},[item]);
 const save=async()=>{
  if(tickets.length!==4){Alert.alert('Billets incomplets','Ce pass doit comporter quatre billets.');return;}
  setBusy(true);
  try{
   for(let i=0;i<4;i++){
    const t=tickets[i]; const role=i<2?'adult':'child';
    const date=role==='child'?births[t.id]:null;
    if(role==='child' && !/^\d{4}-\d{2}-\d{2}$/.test(date||'')) throw new Error('Indique une date de naissance au format AAAA-MM-JJ pour chaque enfant.');
    const {data,error}=await supabase.rpc('assign_family_ticket',{p_ticket:t.id,p_name:names[t.id]?.trim(),p_role:role,p_birth_date:date||null});
    if(error||!data?.ok)throw new Error(data?.error||error?.message||'Enregistrement impossible');
   }
   Alert.alert('Billets attribués','Les deux adultes et les deux enfants sont enregistrés.');
   router.replace('/wallet');
  }catch(e:any){Alert.alert('À corriger',e?.message||'Réessaie plus tard.');}
  finally{setBusy(false);}
 };
 return <Screen>
  <PageHeader title="Attribuer le Pass Famille" subtitle="2 adultes et 2 enfants de moins de 12 ans"/>
  <Card><T variant="small" color={c.textDim}>Les enfants doivent avoir moins de 12 ans le 13 mars 2027. Les dates de naissance des enfants servent uniquement à vérifier leur éligibilité.</T></Card>
  {tickets.map((t,i)=><Card key={t.id} style={{marginTop:Space.md}}>
   <T variant="h3">{i<2?'Adulte':'Enfant'} {i%2+1}</T>
   <T variant="caption" color={c.textMute}>Billet {i+1} sur 4</T>
   <TextInput value={names[t.id]||''} onChangeText={v=>setNames(x=>({...x,[t.id]:v}))} placeholder="Prénom et nom" placeholderTextColor={c.textMute} style={{marginTop:12,borderWidth:1,borderColor:c.border,borderRadius:10,color:c.text,padding:13}}/>
   {i>=2&&<TextInput value={births[t.id]||''} onChangeText={v=>setBirths(x=>({...x,[t.id]:v}))} placeholder="Date de naissance : AAAA-MM-JJ" placeholderTextColor={c.textMute} keyboardType="numbers-and-punctuation" style={{marginTop:10,borderWidth:1,borderColor:c.border,borderRadius:10,color:c.text,padding:13}}/>}
  </Card>)}
  <Pressable disabled={busy||tickets.length!==4} onPress={save} style={{marginTop:Space.xl,padding:18,alignItems:'center',borderRadius:30,backgroundColor:c.primary,opacity:busy?0.5:1}}>
   <T variant="label" color={c.black}>{busy?'ENREGISTREMENT…':'VALIDER LES 4 BILLETS'}</T>
  </Pressable>
 </Screen>;
}
