import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Card, PageHeader, Screen, T } from '@/components/ui';
import { Space } from '@/constants/brand';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/lib/theme';

const EVENT='eb0025ca-b597-4708-9d47-b24ebbf507b5';
export default function EntryDashboard(){
 const c=useColors(); const [data,setData]=useState<any>(null); const [err,setErr]=useState('');
 const load=async()=>{const today=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Paris'}); const {data,error}=await supabase.rpc('entry_dashboard',{p_event:EVENT,p_date:today}); if(error||!data?.ok)setErr(error?.message||data?.error||'Erreur'); else setData(data);};
 useEffect(()=>{load();const id=setInterval(load,5000);return()=>clearInterval(id)},[]);
 return <Screen><PageHeader title="Contrôle des entrées" subtitle="Juste Debout · temps réel"/>
 {err?<T color={c.danger}>{err}</T>:!data?<ActivityIndicator/>:<>
 <View style={s.grid}><Metric n={data.entries} label="ENTRÉES" /><Metric n={data.remaining} label="RESTANTES" /><Metric n={data.capacity} label="CAPACITÉ" /></View>
 <Card><T variant="h3">État du contrôle</T><T variant="small" color={c.textDim} style={{marginTop:8}}>Synchronisation automatique toutes les 5 secondes.</T><T variant="small" color={c.textDim} style={{marginTop:4}}>Une personne déjà scannée aujourd’hui est refusée à toute nouvelle tentative.</T></Card>
 </>}</Screen>
}
function Metric({n,label}:{n:number;label:string}){return <Card style={{flex:1,alignItems:'center'}}><T variant="title">{n}</T><T variant="caption">{label}</T></Card>}
const s=StyleSheet.create({grid:{flexDirection:'row',gap:8,marginBottom:Space.lg}});
