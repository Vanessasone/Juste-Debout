import { Image, ImageSourcePropType, StyleSheet, View } from 'react-native';

const ART: Record<string, {source: ImageSourcePropType; ratio: number}> = {
 day_sat: {source: require('@/assets/tickets/day-saturday.jpg'), ratio: 1536/1012},
 two_days: {source: require('@/assets/tickets/two-days.jpg'), ratio: 1536/989},
 three_days: {source: require('@/assets/tickets/three-days.jpg'), ratio: 1536/969},
 four_days: {source: require('@/assets/tickets/four-days.jpg'), ratio: 1536/969},
 vip_two_days: {source: require('@/assets/tickets/vip.jpg'), ratio: 1536/969},
};

/** All VIP offers use the undated front: the supplied reverse lists Black Card-only benefits. */
export function TicketPassArtwork({code,label}:{code:string;label:string}) {
 const vipFront=code==='vip_sat'||code==='vip_sun'||code==='vip_two_days'||code==='vip';
 const art=vipFront?ART.vip_two_days:ART[code];
 if(!art)return null;
 return <View style={styles.frame}>
  {vipFront?<View style={styles.vipFront}>
   <Image source={art.source} accessible accessibilityLabel={label} resizeMode="stretch" style={styles.vipImage}/>
  </View>:<View style={{width:'100%',aspectRatio:art.ratio}}><Image source={art.source} accessible accessibilityLabel={label} resizeMode="contain" style={[StyleSheet.absoluteFill,{width:'100%',height:'100%'}]}/></View>}
 </View>;
}
const styles=StyleSheet.create({
 frame:{width:'100%',maxWidth:440,alignSelf:'center',borderRadius:18,overflow:'hidden',marginBottom:22,backgroundColor:'#F1F0EC'},
 vipFront:{width:'100%',aspectRatio:666/400,overflow:'hidden'},
 vipImage:{position:'absolute',width:'230.63%',height:'242.25%',left:'-65.32%',top:'-22.75%'},
});
