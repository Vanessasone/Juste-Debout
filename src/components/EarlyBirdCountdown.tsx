import { useCustomerText } from '@/lib/customerText';
import { useEffect, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { earlyBirdState } from '@/lib/earlyBird';

export function EarlyBirdCountdown() {
  const [now, setNow] = useState(Date.now);
  const ct = useCustomerText();
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = setInterval(refresh, 1000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);
  const { phase, color, clock } = earlyBirdState(now);
  if (phase === 'ended') return null;
  return <View style={{ backgroundColor: '#161A1D', borderColor: color, borderWidth: 2, borderRadius: 18, padding: 18, marginTop: 16, marginBottom: 16 }}>
    <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>EARLY BIRD · 48 H</Text>
    <Text style={{ color: '#E5E5E5', fontSize: 15, marginTop: 10 }}>{phase === 'upcoming' ? ct('opening') : ct('remaining')}</Text>
    <Text accessibilityLabel={`${phase === 'upcoming' ? ct('opening') : ct('remaining')} ${clock}`} style={{ color, fontSize: 38, fontWeight: '800', fontVariant: ['tabular-nums'], marginTop: 8 }}>{clock}</Text>
    <Text style={{ color: '#FFFFFF', fontSize: 16, lineHeight: 23, marginTop: 12 }}>{ct('earlyPrice')}</Text>
    <Text style={{ color: '#E5E5E5', fontSize: 14, lineHeight: 20, marginTop: 8 }}>{ct('earlyDates')}</Text>
  </View>;
}
