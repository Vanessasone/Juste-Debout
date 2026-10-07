import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Card, PageHeader, Screen, T } from '@/components/ui';
import { Space } from '@/constants/brand';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/lib/theme';

const EVENT='eb0025ca-b597-4708-9d47-b24ebbf507b5';
export default function EntryDashboard(){
 const c=useColors(); const [data,setData]=useState<any>(null); const [details,setDetails]=useState<any>(null); const [err,setErr]=useState('');
 const load=async()=>{const today=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Paris'}); const [a,b]=await Promise.all([supabase.rpc('entry_dashboard',{p_event:EVENT,p_date:today}),supabase.rpc('entry_dashboard_details',{p_event:EVENT,p_date:today})]); if(a.error||!a.data?.ok)setErr(a.error?.message||a.data?.error||'Erreur'); else {setData(a.data); if(b.data?.ok)setDetails(b.data);}};
 useEffect(()=>{load();const id=setInterval(load,5000);return()=>clearInterval(id)},[]);
 return <Screen><PageHeader title="Contrôle des entrées" subtitle="Juste Debout · temps réel"/>
 {err?<T color={c.danger}>{err}</T>:!data?<ActivityIndicator/>:<>
 <View style={s.grid}><Metric n={data.entries} label="ENTRÉES" /><Metric n={data.remaining} label="RESTANTES" /><Metric n={data.capacity} label="CAPACITÉ" /></View>
 <Card><T variant="h3">État du contrôle</T><T variant="small" color={c.textDim} style={{marginTop:8}}>Synchronisation automatique toutes les 5 secondes.</T><T variant="small" color={c.textDim} style={{marginTop:4}}>Une personne déjà scannée aujourd’hui est refusée à toute nouvelle tentative.</T></Card>
 {details && <><Card style={{marginTop:Space.lg}}><T variant="h3">Entrées par heure</T>{details.by_hour?.length?details.by_hour.map((x:any)=><T key={x.h} variant="small" color={c.textDim} style={{marginTop:6}}>{String(x.h).padStart(2,'0')}h · {x.entries} entrée(s)</T>):<T variant="small" color={c.textMute} style={{marginTop:6}}>Aucune entrée pour le moment.</T>}</Card><Card style={{marginTop:Space.md}}><T variant="h3">Par catégorie</T>{details.by_category?.length?details.by_category.map((x:any)=><T key={x.category} variant="small" color={c.textDim} style={{marginTop:6}}>{x.category} · {x.entries}</T>):<T variant="small" color={c.textMute} style={{marginTop:6}}>Aucune entrée pour le moment.</T>}</Card></>}</>}</Screen>
}
function Metric({n,label}:{n:number;label:string}){return <Card style={{flex:1,alignItems:'center'}}><T variant="title">{n}</T><T variant="caption">{label}</T></Card>}
const s=StyleSheet.create({grid:{flexDirection:'row',gap:8,marginBottom:Space.lg}});
