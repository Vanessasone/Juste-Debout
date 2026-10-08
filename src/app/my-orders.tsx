import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, PageHeader, Screen, T } from '@/components/ui';
import { Space } from '@/constants/brand';
import { getMyOrders, Order } from '@/lib/orders';
import { useColors } from '@/lib/theme';
import { useAuth } from '@/lib/auth';

const money=(n:number,cur:string)=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:cur||'EUR'}).format(n/100);
const statusText:Record<string,string>={pending:'Paiement en attente',paid:'Payée',shipped:'Expédiée',delivered:'Livrée',cancelled:'Annulée'};
export default function MyOrders(){
 const c=useColors();const router=useRouter();const {session}=useAuth();
 const [orders,setOrders]=useState<Order[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 useFocusEffect(useCallback(()=>{
  let active=true;
  setOrders([]);setError('');setLoading(true);
  getMyOrders().then(xs=>{if(active){setOrders(xs);setError('');}}).catch(e=>{if(active)setError(e?.message||'Impossible de charger tes commandes.');}).finally(()=>{if(active)setLoading(false);});
  return ()=>{active=false;};
 },[session?.user.id]));
 return <Screen>
  <PageHeader title="Mes commandes" subtitle="Boutique Juste Debout"/>
  <T variant="small" color={c.textDim} style={{marginBottom:Space.md}}>Compte connecté : {session?.user.email ?? 'Non connecté'}</T>
  {loading?<ActivityIndicator color={c.primary} style={{marginTop:Space.xl}}/>:error?<Card><T color={c.danger}>{error}</T></Card>:orders.length===0?
   <Card><T variant="h3">Aucune commande</T><T variant="small" color={c.textDim} style={{marginTop:6}}>Tes achats merchandising apparaîtront ici après ta commande.</T></Card>:
   orders.map(o=><Card key={o.id} style={{marginBottom:Space.md}}>
    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:10}}>
      <T variant="h3" style={{flex:1}}>Commande #{o.id.slice(0,8).toUpperCase()}</T>
      <T variant="small" color={o.status==='paid'||o.status==='shipped'||o.status==='delivered'?c.primary:c.textDim}>{statusText[o.status]||o.status}</T>
    </View>
    <T variant="caption" color={c.textMute} style={{marginTop:5}}>{new Date(o.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})}</T>
    {(o.items||[]).map((it,i)=><View key={i} style={{marginTop:12,flexDirection:'row',justifyContent:'space-between',gap:8}}>
      <T variant="small" style={{flex:1}}>{it.quantity} × {it.name}</T>
      <T variant="small">{money(it.unit_price*it.quantity,o.currency)}</T>
    </View>)}
    <View style={{borderTopWidth:1,borderTopColor:c.border,marginTop:14,paddingTop:12,flexDirection:'row',justifyContent:'space-between'}}>
      <T variant="h3">Total</T><T variant="h3" color={c.primary}>{money(o.total,o.currency)}</T>
    </View>
    <View style={{marginTop:12,flexDirection:'row',alignItems:'flex-start',gap:8}}>
      <Ionicons name="location-outline" color={c.textMute} size={17}/>
      <T variant="small" color={c.textDim} style={{flex:1}}>{[o.full_name,o.address_line1,o.address_line2,[o.postal_code,o.city].filter(Boolean).join(' '),o.country].filter(Boolean).join(' · ')}</T>
    </View>
   </Card>)}
  <Pressable onPress={()=>router.push('/(tabs)/marketplace')} style={{backgroundColor:c.primary,borderRadius:100,padding:16,alignItems:'center',marginTop:Space.md}}>
    <T variant="label" color={c.black}>RETOURNER À LA BOUTIQUE</T>
  </Pressable>
 </Screen>;
}
