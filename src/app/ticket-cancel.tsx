import { useCustomerText } from '@/lib/customerText';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, T } from '@/components/ui';
export default function TicketCancel() {
  const router = useRouter();
  const ct = useCustomerText();
  return <Screen scroll={false}><View style={styles.wrap}>
    <Ionicons name="close-circle-outline" size={76} color="#FF7777"/>
    <T variant="title" style={styles.center}>{ct('cancelled')}</T>
    <T variant="small" style={styles.center}>{ct('cancelBody')}</T>
    <Pressable accessibilityRole="button" onPress={()=>router.replace('/billetterie')} style={styles.button}>
      <T variant="label" color="#101010">{ct('back')}</T>
    </Pressable>
  </View></Screen>;
}
const styles=StyleSheet.create({wrap:{flex:1,alignItems:'center',justifyContent:'center',padding:24,gap:24},center:{textAlign:'center'},button:{backgroundColor:'#B5FA42',borderRadius:100,paddingVertical:18,paddingHorizontal:24,alignItems:'center',alignSelf:'stretch'}});
