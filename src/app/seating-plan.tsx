import { useCustomerText } from '@/lib/customerText';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { Card, PageHeader, Screen, T } from '@/components/ui';
import { Space } from '@/constants/brand';
import { useColors } from '@/lib/theme';

type Zone = 'bc' | 'vip' | 'normal';
const zones = {
  bc: { title: 'BLACK CARD', color: '#D7B66D', detail: 'Tribune diagonale côté gauche de la scène · zone réservée aux Black Cards.' },
  vip: { title: 'VIP', color: '#A5FA39', detail: 'Trois zones VIP : tribune latérale gauche, tribune diagonale droite et tribune latérale droite.' },
  normal: { title: 'STANDARD', color: '#C7CDD2', detail: 'Tribunes face à la scène et autres emplacements standard du plan.' },
};
function SeatBlock({x,y,angle=0,color,rows=6,cols=8}:{x:number;y:number;angle?:number;color:string;rows?:number;cols?:number}){
 return <G transform={`translate(${x} ${y}) rotate(${angle})`}>
  <Rect x={0} y={0} width={cols*9+8} height={rows*11+8} rx={3} fill="#14171C" stroke={color} strokeWidth={1.6}/>
  {Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,i)=><Rect key={`${r}-${i}`} x={5+i*9} y={5+r*11} width={7} height={8} rx={1} fill={color} opacity={0.35+(r%2)*0.1}/>))}
 </G>;
}
export default function SeatingPlan(){
 const c=useColors();const router=useRouter();const ct=useCustomerText();const [selected,setSelected]=useState<Zone>('bc');
 const label=(txt:string,x:number,y:number,size=12,color='#F5F5F5')=><SvgText x={x} y={y} fill={color} fontSize={size} fontWeight="bold" textAnchor="middle">{txt}</SvgText>;
 return <Screen>
  <PageHeader title={ct('seatingTitle')} subtitle={ct('finals')}/>
  <T variant="small" color={c.textDim} style={{marginBottom:Space.md}}>{ct('seatingIntro')}</T>
  <View style={{backgroundColor:'#0A0C0F',borderRadius:18,overflow:'hidden',borderWidth:1,borderColor:'#343A42'}}>
   <Svg viewBox="0 0 380 435" width="100%" accessibilityLabel={ct('seatingTitle')}>
    <Rect width="380" height="435" fill="#0D0F12"/>
    <Path d="M90 70 L190 28 L290 70 L335 185 L330 335 L50 335 L45 185 Z" fill="#171A1F" stroke="#33373C" strokeWidth="2"/>
    <Rect x={132} y={36} width={116} height={35} rx={4} fill="#292D33" stroke="#565D66"/>
    {label(ct('stage'),190,58,13)}
    <Path d="M190 74 L190 146" stroke="#444" strokeWidth="2" strokeDasharray="5,6"/>
    <SeatBlock x={82} y={95} angle={-35} color="#D7B66D" rows={5} cols={7}/>
    <SeatBlock x={248} y={92} angle={35} color="#A5FA39" rows={5} cols={7}/>
    <SeatBlock x={50} y={182} color="#A5FA39" rows={7} cols={6}/>
    <SeatBlock x={275} y={182} color="#A5FA39" rows={7} cols={6}/>
    <SeatBlock x={88} y={318} color="#C7CDD2" rows={7} cols={22}/>
    <Circle cx={190} cy={214} r={58} fill="#262A2E" stroke="#4B545B" strokeWidth="3"/>
    <Circle cx={190} cy={214} r={44} fill="#111418" stroke="#8F989F" strokeWidth="1"/>
    {label("DANCE",190,210,16)}
    {label("FLOOR",190,228,16)}
    <Rect x={82} y={129} width={91} height={26} rx={5} fill="#15120A" stroke="#D7B66D" strokeWidth="1.5"/>
    {label("BLACK CARD",127,147,11,'#EBD7A6')}
    <Rect x={251} y={126} width={59} height={26} rx={5} fill="#11190B" stroke="#A5FA39"/>
    {label("VIP",280,144,14,'#B8FF6B')}
    <Rect x={53} y={235} width={55} height={26} rx={5} fill="#11190B" stroke="#A5FA39"/>
    {label("VIP",80,253,14,'#B8FF6B')}
    <Rect x={271} y={235} width={55} height={26} rx={5} fill="#11190B" stroke="#A5FA39"/>
    {label("VIP",298,253,14,'#B8FF6B')}
    <Rect x={142} y={356} width={96} height={26} rx={5} fill="#20252A" stroke="#C7CDD2"/>
    {label("STANDARD",190,374,12)}
    <Line x1={24} x2={356} y1={407} y2={407} stroke="#343A42"/>
    {label(ct('planNote'),190,424,10,'#8C929A')}
   </Svg>
  </View>
  <View style={{flexDirection:'row',gap:8,marginTop:Space.md}}>
   {(['bc','vip','normal'] as Zone[]).map(z=><Pressable key={z} onPress={()=>setSelected(z)} style={{flex:1,borderWidth:selected===z?2:1,borderColor:zones[z].color,backgroundColor:selected===z?'#23272A':'#111315',paddingVertical:12,borderRadius:12,alignItems:'center'}}>
    <T variant="small" color={zones[z].color}>{zones[z].title}</T>
   </Pressable>)}
  </View>
  <Card style={{marginTop:Space.md}}>
   <T variant="h3" color={zones[selected].color}>{zones[selected].title}</T>
   <T variant="small" color={c.textDim} style={{marginTop:8}}>{ct(selected === 'bc' ? 'zoneBc' : selected === 'vip' ? 'zoneVip' : 'zoneStandard')}</T>
  </Card>
  <T variant="caption" color={c.textMute} style={{marginTop:Space.md}}>{ct('planDisclaimer')}</T>
  <Pressable onPress={()=>router.push('/billetterie')} style={{marginTop:Space.lg,backgroundColor:c.primary,borderRadius:99,padding:16,alignItems:'center'}}>
   <T variant="label" color={c.black}>{ct('choose')}</T>
  </Pressable>
 </Screen>;
}
