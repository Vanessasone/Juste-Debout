import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { T } from '@/components/ui';
import { useCustomerText } from '@/lib/customerText';

export const BLACK_CARD_GOLD = '#E5C48D';

/** The supplied artwork is displayed as a cropped background, never edited.
 * Admission uses the real personal token drawn by the QR library above it. */
export function BlackCardVisual({qrToken,holderName,number,validity,onQrPress,preview=false}:{
 qrToken?:string|null;holderName?:string|null;number?:string;validity?:string;
 onQrPress?:()=>void;preview?:boolean;
}) {
 const ct=useCustomerText();
 const [width,setWidth]=useState(340);
 const qrSize=Math.max(68,Math.min(110,Math.floor(width*.23)));
 return <View style={styles.card} onLayout={e=>setWidth(e.nativeEvent.layout.width)}>
  <View style={styles.art}>
   <Image source={require('@/assets/brand/black-card-2027.jpg')} accessible={false} resizeMode="stretch" style={styles.image}/>
   <View style={styles.qrPosition}>
    {qrToken?<Pressable accessibilityRole="button" accessibilityLabel={ct('qrZoom')} onPress={onQrPress} style={styles.qr}>
     <QRCode value={qrToken} size={qrSize} quietZone={16} color="#080808" backgroundColor="#FFFFFF" ecl="M"/>
    </Pressable>:<View accessibilityLabel={ct('blackPersonalQr')} style={[styles.previewQr,{width:qrSize+24,height:qrSize+24}]}>
     <Ionicons name="qr-code-outline" color={BLACK_CARD_GOLD} size={qrSize*.7}/>
     <T variant="caption" color={BLACK_CARD_GOLD} style={{fontSize:8,marginTop:4}}>{ct('previewShort')}</T>
    </View>}
   </View>
  </View>
  {!preview&&<View style={styles.identity}>
   <View style={{flex:1,minWidth:0}}>
    <T color="#F8F0DE" style={{fontSize:17,fontWeight:'600'}}>{holderName||ct('blackPersonalQr')}</T>
    {number?<T variant="small" color={BLACK_CARD_GOLD} style={{marginTop:6,letterSpacing:2}}>{number}</T>:null}
    <T variant="caption" color="#C2B9A8" style={{marginTop:7}}>{validity||ct('inactivePreview')}</T>
   </View>
   {qrToken?<Ionicons name="checkmark-circle-outline" size={23} color={BLACK_CARD_GOLD}/>:null}
  </View>}
 </View>;
}
const styles=StyleSheet.create({
 card:{backgroundColor:'#090909',borderRadius:24,overflow:'hidden',borderWidth:1,borderColor:'#8C7048',width:'100%',maxWidth:650,alignSelf:'center'},
 art:{width:'100%',aspectRatio:755/450,overflow:'hidden',backgroundColor:'#090909'},
 image:{position:'absolute',width:'203.45%',height:'227.56%',left:'-22.91%',top:'-12.67%'},
 qrPosition:{position:'absolute',right:12,bottom:14},
 qr:{backgroundColor:'#FFFFFF',borderRadius:12,overflow:'hidden'},
 previewQr:{backgroundColor:'rgba(8,8,8,0.94)',borderWidth:1,borderColor:'#9B7F52',borderRadius:12,alignItems:'center',justifyContent:'center'},
 identity:{flexDirection:'row',alignItems:'center',gap:16,padding:20,borderTopWidth:1,borderTopColor:'#4E402B'},
});
