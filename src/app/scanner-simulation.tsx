/**
 * Banc de simulation des contrôles d'entrée Juste Debout.
 * Aucun QR réel, aucun appel Supabase, aucune écriture ni comptage réel.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '@/components/ui';
import { Palette } from '@/constants/brand';

type Category = 'standard' | 'vip' | 'black_card' | 'family' | 'mjc';
type Scenario = {
  id: string;
  title: string;
  category: Category;
  ticketLabel: string;
  day: 'samedi' | 'dimanche';
  expected: 'accepted' | 'refused';
  reason?: string;
  previousScan?: string;
};
const cases: Scenario[] = [
  { id: 'standard', title: 'Standard — première entrée', category: 'standard', ticketLabel: 'Pass Standard — Samedi', day: 'samedi', expected: 'accepted' },
  { id: 'vip', title: 'VIP — première entrée', category: 'vip', ticketLabel: 'Pass VIP — Samedi', day: 'samedi', expected: 'accepted' },
  { id: 'black', title: 'Black Card — première entrée', category: 'black_card', ticketLabel: 'Black Card', day: 'samedi', expected: 'accepted' },
  { id: 'family', title: 'Famille — billet individuel', category: 'family', ticketLabel: 'Pass Famille — Samedi', day: 'samedi', expected: 'accepted' },
  { id: 'mjc', title: 'MJC — billet individuel', category: 'mjc', ticketLabel: 'Tarif MJC — Dimanche', day: 'dimanche', expected: 'accepted' },
  { id: 'repeat', title: 'Deuxième scan — sortie définitive', category: 'vip', ticketLabel: 'Pass VIP — Samedi', day: 'samedi', expected: 'refused', reason: 'Déjà entré(e) à 14:32 · sortie définitive', previousScan: '14:32' },
  { id: 'wrong', title: 'Billet samedi présenté dimanche', category: 'standard', ticketLabel: 'Pass Standard — Samedi', day: 'dimanche', expected: 'refused', reason: 'Billet non valable aujourd’hui' },
  { id: 'cancelled', title: 'Billet annulé', category: 'black_card', ticketLabel: 'Black Card', day: 'samedi', expected: 'refused', reason: 'Billet annulé · accès refusé' },
  { id: 'weekend_sat', title: 'Week-end — entrée samedi', category: 'vip', ticketLabel: 'Pass VIP — 2 jours', day: 'samedi', expected: 'accepted', reason: 'Samedi utilisé · dimanche reste disponible' },
  { id: 'weekend_sun', title: 'Week-end — entrée dimanche', category: 'vip', ticketLabel: 'Pass VIP — 2 jours', day: 'dimanche', expected: 'accepted', reason: 'Pass entièrement utilisé après cette entrée' },
];
const colors: Record<Category, { background: string; foreground: string }> = {
  standard: { background: '#333333', foreground: '#FFFFFF' },
  vip: { background: '#B5FA42', foreground: '#101010' },
  black_card: { background: '#D7B66D', foreground: '#101010' },
  family: { background: '#333333', foreground: '#FFFFFF' },
  mjc: { background: '#333333', foreground: '#FFFFFF' },
};

export default function ScannerSimulation() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<Scenario | null>(null);
  const [simulated, setSimulated] = useState(false);
  const choose = (item: Scenario) => { setSelected(item); setSimulated(false); };
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 140, paddingHorizontal: 20 }}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" color="#FFFFFF" size={20} />
          <T variant="label" color="#FFFFFF">Retour au scanner</T>
        </Pressable>
        <T variant="h2" color="#FFFFFF" style={{ marginTop: 20 }}>MODE SIMULATION</T>
        <View style={styles.warning}>
          <Ionicons name="shield-checkmark-outline" size={22} color="#B5FA42" />
          <View style={{ flex: 1 }}>
            <T variant="label" color="#B5FA42">ENTRAÎNEMENT — AUCUNE ENTRÉE RÉELLE</T>
            <T variant="small" color="#FFFFFF" style={{ marginTop: 6 }}>Les scénarios sont fictifs. Aucun QR code réel n'est scanné, aucun billet n'est consommé et aucune donnée n'est envoyée à Supabase.</T>
          </View>
        </View>
        <T variant="h3" color="#FFFFFF" style={{ marginTop: 22, marginBottom: 12 }}>Choisir un scénario</T>
        {cases.map(item => {
          const expanded = selected?.id === item.id;
          const tone = item.expected === 'accepted' ? '#B5FA42' : '#FF7777';
          return <View key={item.id} style={{ marginBottom: 8 }}>
            <Pressable
              onPress={() => choose(item)}
              accessibilityRole="button"
              accessibilityLabel={`Choisir le scénario : ${item.title}`}
              accessibilityState={{ expanded }}
              style={[styles.case, expanded && styles.selected]}
            >
              <View style={{ flex: 1 }}>
                <T variant="small" color="#FFFFFF">{item.title}</T>
                <T variant="caption" color="#AAAAAA">{item.day === 'samedi' ? '13 mars 2027' : '14 mars 2027'}</T>
              </View>
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={23} color={expanded ? '#B5FA42' : '#FFFFFF'} />
            </Pressable>
            {expanded && <View style={styles.preview}>
              <T variant="caption" color="#B5FA42">BILLET FICTIF · {item.day.toUpperCase()}</T>
              <View style={[styles.category, { backgroundColor: colors[item.category].background }]}>
                <T variant="h3" color={colors[item.category].foreground} style={{ textAlign: 'center' }}>{item.ticketLabel.toUpperCase()}</T>
              </View>
              <Pressable accessibilityRole="button" onPress={() => setSimulated(true)} style={styles.button}>
                <Ionicons name="scan-outline" size={20} color="#101010" />
                <T variant="label" color="#101010">SIMULER LE PASSAGE</T>
              </Pressable>
              {simulated && <View style={[styles.result, { borderColor: tone }]}>
                <Ionicons name={item.expected === 'accepted' ? 'checkmark-circle' : 'close-circle'} size={55} color={tone} />
                <T variant="h2" color={tone}>{item.expected === 'accepted' ? 'ENTRÉE AUTORISÉE' : 'ENTRÉE REFUSÉE'}</T>
                <T variant="small" color="#FFFFFF" style={{ textAlign: 'center' }}>{item.ticketLabel}</T>
                {!!item.reason && <T variant="small" color="#FFFFFF" style={{ marginTop: 8, textAlign: 'center' }}>{item.reason}</T>}
                <T variant="caption" color="#AAAAAA" style={{ marginTop: 12 }}>RÉSULTAT SIMULÉ — NON ENREGISTRÉ</T>
              </View>}
            </View>}
          </View>;
        })}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#090909' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 9, alignSelf: 'flex-start', paddingVertical: 10 },
  warning: { flexDirection: 'row', gap: 12, backgroundColor: '#18200D', borderWidth: 1, borderColor: '#56752D', padding: 16, borderRadius: 14, marginTop: 18 },
  case: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, marginBottom: 0, borderRadius: 12, borderWidth: 1, borderColor: '#333333', backgroundColor: '#1B1B1B' },
  selected: { borderColor: '#B5FA42' },
  preview: { marginTop: 8, marginBottom: 10, padding: 18, backgroundColor: '#171717', borderRadius: 15, borderWidth: 1, borderColor: '#383838' },
  category: { padding: 16, marginTop: 12, borderRadius: 9 },
  button: { backgroundColor: '#B5FA42', borderRadius: 28, marginTop: 18, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  result: { alignItems: 'center', gap: 10, padding: 20, marginTop: 18, borderWidth: 2, borderRadius: 14 },
});
