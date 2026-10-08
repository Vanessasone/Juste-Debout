import { useCustomerText } from '@/lib/customerText';
import { validateFamilyRecipients } from '@/lib/familyRecipients';
import { useEffect, useState } from 'react';
import { Alert, Pressable, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Card, PageHeader, Screen, T } from '@/components/ui';
import { Space } from '@/constants/brand';
import { useColors } from '@/lib/theme';
import { getMyTickets, Ticket } from '@/lib/tickets';
import { supabase } from '@/lib/supabase';

export default function FamilyTickets() {
 const { item } = useLocalSearchParams<{item?:string}>();
 const router=useRouter(); const c=useColors();const ct=useCustomerText();
 const [tickets,setTickets]=useState<Ticket[]>([]);
 const [names,setNames]=useState<Record<string,string>>({});
 const [births,setBirths]=useState<Record<string,string>>({});
 const [busy,setBusy]=useState(false);
 const load=async()=>{
  const all=await getMyTickets();
  const family=all.filter(t=>t.order_item_id===item && t.ticket_products?.code?.startsWith('family_')).sort((a,b)=>(a.unit_index??0)-(b.unit_index??0));
  setTickets(family);
  setNames(Object.fromEntries(family.map(t=>[t.id,t.holder_name||''])));
  setBirths(Object.fromEntries(family.map(t=>[t.id,t.holder_birth_date||''])));
 };
 useEffect(()=>{load().catch(()=>Alert.alert(ct('error'),ct('familyLoad')));},[item]);
 const save=async()=>{
  const validation=validateFamilyRecipients(tickets,names,births);
  if(validation){Alert.alert(ct('error'),ct(validation));return;}
  setBusy(true);
  try{
   for(let i=0;i<4;i++){
    const t=tickets[i]; const role=i<2?'adult':'child';
    const date=role==='child'?births[t.id]:null;
    
    const {data,error}=await supabase.rpc('assign_family_ticket',{p_ticket:t.id,p_name:names[t.id]?.trim(),p_role:role,p_birth_date:date||null});
    if(error||!data?.ok)throw new Error(data?.error||error?.message||'Enregistrement impossible');
   }
   Alert.alert(ct('familyTitle'),ct('familySaved'));
   router.replace('/wallet');
  }catch(e:any){Alert.alert(ct('error'),ct(String(e?.message).includes('child_must_be_under_12')?'familyUnder12':String(e?.message).includes('invalid_name')?'invalidContact':'saveError'));}
  finally{setBusy(false);}
 };
 return <Screen>
  <PageHeader title={ct('familyTitle')} subtitle={ct('family')}/>
  <Card><T variant="small" color={c.textDim}>{ct('familyAge')}</T></Card>
  {tickets.map((t,i)=><Card key={t.id} style={{marginTop:Space.md}}>
   <T variant="h3">{i<2?ct('adult'):ct('child')} {i%2+1}</T>
   <T variant="caption" color={c.textMute}>{ct('familyIndex',{n:i+1})}</T>
   <TextInput value={names[t.id]||''} onChangeText={v=>setNames(x=>({...x,[t.id]:v}))} accessibilityLabel={ct('name')} placeholder={ct('name')} placeholderTextColor={c.textMute} style={{marginTop:12,borderWidth:1,borderColor:c.border,borderRadius:10,color:c.text,padding:13}}/>
   {i>=2&&<TextInput value={births[t.id]||''} onChangeText={v=>setBirths(x=>({...x,[t.id]:v}))} accessibilityLabel={ct('birthDate')} placeholder={ct('birthDate')} placeholderTextColor={c.textMute} keyboardType="numbers-and-punctuation" style={{marginTop:10,borderWidth:1,borderColor:c.border,borderRadius:10,color:c.text,padding:13}}/>}
  </Card>)}
  <Pressable disabled={busy||tickets.length!==4} onPress={save} style={{marginTop:Space.xl,padding:18,alignItems:'center',borderRadius:30,backgroundColor:c.primary,opacity:busy?0.5:1}}>
   <T variant="label" color={c.black}>{busy?ct('saving'):ct('familySave')}</T>
  </Pressable>
 </Screen>;
}
