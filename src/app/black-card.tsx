import { useCustomerText } from '@/lib/customerText';
import { useI18n } from '@/lib/i18n';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Card, PageHeader, Screen, T } from '@/components/ui';
import { BlackCardVisual, BLACK_CARD_GOLD as GOLD } from '@/components/BlackCardVisual';
import { Space } from '@/constants/brand';
import { BLACK_CARD_BENEFITS } from '@/constants/blackCardBenefits';
import { BlackCardMembership, BlackCardEvent, getMyBlackCard, getMyBlackCardEvents } from '@/lib/blackCard';

export default function BlackCardScreen() {
 const ct=useCustomerText(),{locale}=useI18n(),router=useRouter();
 const [card,setCard]=useState<BlackCardMembership|null>();
 const [events,setEvents]=useState<BlackCardEvent[]>([]);
 const [calendarError,setCalendarError]=useState(false),[error,setError]=useState(false),[qrOpen,setQrOpen]=useState(false);
 const load=()=>{setError(false);setCard(undefined);getMyBlackCard().then(setCard).catch(()=>{setError(true);setCard(null);});};
 const loadEvents=()=>{setCalendarError(false);getMyBlackCardEvents().then(setEvents).catch(()=>setCalendarError(true));};
 useEffect(()=>{
  let active=true;
  getMyBlackCard().then(value=>{if(active)setCard(value);}).catch(()=>{if(active){setError(true);setCard(null);}});
  return ()=>{active=false;};
 },[]);
 const cardId=card?.id;
 useEffect(()=>{
  if(!cardId)return;
  let active=true;
  getMyBlackCardEvents().then(value=>{if(active)setEvents(value);}).catch(()=>{if(active)setCalendarError(true);});
  return ()=>{active=false;};
 },[cardId]);
 return <Screen>
  <PageHeader title="Black Card" subtitle="Juste Debout · Paris 2027"/>
  <View style={styles.hero}>
   <T variant="caption" color={GOLD} style={{letterSpacing:3}}>{ct('blackPrivilege')}</T>
   <T variant="title" color="#F9ECD6" style={{fontSize:48,lineHeight:54,marginTop:12}}>{ct('blackHeadline')}</T>
   <T color="#D8D1C4" style={{lineHeight:26,marginTop:14,fontSize:17,maxWidth:580}}>{ct('blackIntro')}</T>
  </View>
  {card===undefined?<ActivityIndicator color={GOLD}/>:error?<Card><T>{ct('cardLoad')}</T><Pressable onPress={load} accessibilityRole="button" style={{padding:16}}><T>{ct('retry')}</T></Pressable></Card>:<>
   <BlackCardVisual qrToken={card?.qr_token} holderName={card?.holder_name} number={card?.card_number}
    validity={card?ct('validUntil',{date:new Date(card.valid_until).toLocaleDateString(locale)}):ct('inactivePreview')} onQrPress={()=>setQrOpen(true)}/>
   <T variant="small" style={{textAlign:'center',marginTop:12}}>{card?.qr_token?ct('qrZoom'):ct('blackPersonalQr')}</T>
   <View style={styles.benefits}>
    {BLACK_CARD_BENEFITS.map(({key,icon},index)=><View key={key} style={styles.benefit}>
     <View style={styles.icon}><Ionicons name={icon} size={24} color={GOLD}/></View>
     <View style={{flex:1,minWidth:0}}><T variant="caption" color={GOLD}>0{index+1}</T><T color="#F3EDDF" style={{lineHeight:25,marginTop:6,fontSize:16}}>{ct(key)}</T></View>
    </View>)}
   </View>
   <View style={styles.invitation}>
    <T variant="h2" color={GOLD} style={{fontSize:30,lineHeight:36}}>{ct('blackClosing')}</T>
    <T variant="small" color="#CCC1AD" style={{marginTop:12,lineHeight:23}}>{ct('blackLimit')}</T>
    {!card?<Pressable accessibilityRole="button" onPress={()=>router.push({pathname:'/billetterie',params:{offer:'black'}})} style={styles.cta}>
     <T variant="label" color="#15110B" style={{flexShrink:1}}>{ct('blackCta')}</T><Ionicons name="arrow-forward" size={20} color="#15110B"/>
    </Pressable>:null}
   </View>
   {card?<Card style={{marginTop:Space.lg}}>
    <T variant="h3">{ct('blackProgram')}</T>
    {calendarError?<Pressable accessibilityRole="button" onPress={loadEvents} style={{paddingVertical:16}}><T>{ct('retry')}</T></Pressable>:events.map(event=>{
     const canonical=event.event_id==='eb0025ca-b597-4708-9d47-b24ebbf507b5';
     const date=(v:string)=>new Date(v+'T12:00:00Z').toLocaleDateString(locale,{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Paris'});
     return <View key={event.event_id} style={{marginTop:18}}>
      <T variant="small">{canonical?ct('presels')+' · '+date('2027-03-11')+' – '+date('2027-03-12'):event.events?.title}</T>
      <T variant="caption" style={{marginTop:5}}>{canonical?ct('preselVenue'):date(event.access_start_date)+' – '+date(event.access_end_date)+' · '+(event.events?.venue||ct('unknownVenue'))}</T>
      {canonical?<><T variant="small" style={{marginTop:14}}>{ct('finalDays')+' · '+date('2027-03-13')+' – '+date('2027-03-14')}</T><T variant="caption">{event.events?.venue||'Stade Pierre-de-Coubertin'}</T></>:null}
     </View>;
    })}
    <T variant="small" style={{marginTop:18,lineHeight:23}}>{ct('blackCalendar')}</T>
   </Card>:null}
  </>}
  <Modal visible={qrOpen&&!!card?.qr_token} transparent animationType="fade" onRequestClose={()=>setQrOpen(false)}>
   <Pressable style={styles.modal} onPress={()=>setQrOpen(false)} accessibilityRole="button" accessibilityLabel={ct('closeQr')}>
    <View style={styles.largeQr}>{card?.qr_token?<QRCode value={card.qr_token} size={240} quietZone={20} color="#080808" backgroundColor="#FFFFFF" ecl="M"/>:null}</View>
    <T color="#FFFFFF" style={{marginTop:18}}>{ct('close')}</T>
   </Pressable>
  </Modal>
 </Screen>;
}
const styles=StyleSheet.create({
 hero:{backgroundColor:'#0B0B0B',borderRadius:24,padding:26,marginBottom:24,borderWidth:1,borderColor:'#443725'},
 benefits:{flexDirection:'row',flexWrap:'wrap',gap:12,marginTop:24},
 benefit:{flexDirection:'row',gap:16,flexGrow:1,flexBasis:270,backgroundColor:'#12110F',borderWidth:1,borderColor:'#3A3021',borderRadius:20,padding:22},
 icon:{width:44,height:44,alignItems:'center',justifyContent:'center',backgroundColor:'#242015',borderRadius:14},
 invitation:{backgroundColor:'#14120E',padding:26,borderRadius:24,marginTop:24,borderWidth:1,borderColor:'#685336'},
 cta:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:12,backgroundColor:GOLD,borderRadius:30,padding:18,marginTop:22},
 modal:{flex:1,backgroundColor:'rgba(0,0,0,0.95)',alignItems:'center',justifyContent:'center'},
 largeQr:{backgroundColor:'#FFFFFF',padding:8,borderRadius:16},
});
