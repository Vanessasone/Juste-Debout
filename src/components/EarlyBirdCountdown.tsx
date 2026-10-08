import { useEffect, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { earlyBirdState } from '@/lib/earlyBird';

export function EarlyBirdCountdown() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = setInterval(refresh, 1000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);
  const { phase, color, clock } = earlyBirdState(now);
  if (phase === 'ended') return null;
  return <View style={{ backgroundColor: '#161A1D', borderColor: color, borderWidth: 2, borderRadius: 18, padding: 18, marginTop: 16 }}>
    <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>EARLY BIRD · 48 H</Text>
    <Text style={{ color: '#E5E5E5', fontSize: 15, marginTop: 10 }}>{phase === 'upcoming' ? 'Ouverture ce soir à 21 h · dans' : 'Profite du code 48 · temps restant'}</Text>
    <Text accessibilityLabel={`${phase === 'upcoming' ? 'Ouverture dans' : 'Temps restant'} ${clock}`} style={{ color, fontSize: 38, fontWeight: '800', fontVariant: ['tabular-nums'], marginTop: 8 }}>{clock}</Text>
    <Text style={{ color: '#FFFFFF', fontSize: 16, lineHeight: 23, marginTop: 12 }}>Standard : 35 € le samedi ou le dimanche, 60 € les deux jours.</Text>
    <Text style={{ color: '#E5E5E5', fontSize: 14, lineHeight: 20, marginTop: 8 }}>Du 8 octobre à 21 h au 10 octobre à 21 h · heure de Paris.</Text>
  </View>;
}
