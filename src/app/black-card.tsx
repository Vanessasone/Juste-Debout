import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Card, PageHeader, Screen, T } from '@/components/ui';
import { Radius, Space } from '@/constants/brand';
import { ThemeColors } from '@/constants/theme';
import { BlackCardMembership, getMyBlackCard } from '@/lib/blackCard';
import { useColors } from '@/lib/theme';

export default function BlackCardScreen(){
 const c=useColors(); const styles=useMemo(()=>makeStyles(c),[c]); const [card,setCard]=useState<BlackCardMembership|null|undefined>(undefined);
 useEffect(()=>{getMyBlackCard().then(setCard).catch(()=>setCard(null));},[]);
 if(card===undefined)return <Screen><PageHeader title="Black Card"/><ActivityIndicator/></Screen>;
 return <Screen><PageHeader title="Black Card" subtitle="Juste Debout · Membership"/>
 {!card?<Card><T variant="h3">Aucune Black Card active</T><T variant="small" color={c.textDim} style={{marginTop:6}}>La Black Card est limitée à 70 exemplaires et valable un an à compter de son activation.</T></Card>:<>
 <View style={styles.blackCard}>
   <View style={styles.glow}/>
   <T variant="caption" color="#D9C27A">JUSTE DEBOUT · BLACK CARD</T>
   <T variant="title" color="#FFFFFF" style={{fontSize:34,marginTop:18}}>BLACK</T>
   <T variant="title" color="#D9C27A" style={{fontSize:34,marginTop:-6}}>CARD</T>
   <View style={{flex:1}}/>
   <T variant="h2" color="#FFFFFF">{card.card_number}</T>
   <T variant="caption" color="#A9A9A9" style={{marginTop:6}}>VALABLE JUSQU’AU {new Date(card.valid_until).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'})}</T>
 </View>
 <Card style={{marginTop:Space.lg}}>
   <T variant="h3">Tes avantages actifs</T>
   <View style={styles.benefit}><Ionicons name="bag-handle-outline" size={20} color={c.primary}/><T variant="small">-{card.merchandise_discount_percent}% sur le merchandising éligible dans l’app</T></View>
   <View style={styles.benefit}><Ionicons name="ticket-outline" size={20} color={c.primary}/><T variant="small">Accès et avantages Black Card reconnus automatiquement par ton numéro</T></View>
   <View style={styles.benefit}><Ionicons name="calendar-outline" size={20} color={c.primary}/><T variant="small">Membership valable 1 an à compter de l’activation</T></View>
 </Card>
 </>}
 </Screen>
}
const makeStyles=(c:ThemeColors)=>StyleSheet.create({
 blackCard:{height:230,borderRadius:Radius.xl,padding:24,backgroundColor:'#050505',borderWidth:1,borderColor:'#3A3421',overflow:'hidden'},
 glow:{position:'absolute',width:220,height:220,borderRadius:110,backgroundColor:'#19160D',right:-60,top:-80},
 benefit:{flexDirection:'row',gap:10,alignItems:'center',marginTop:14}
});
