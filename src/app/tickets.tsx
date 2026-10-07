import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Card, PageHeader, Screen, Section, T } from '@/components/ui';
import { Radius, Space } from '@/constants/brand';
import { ThemeColors } from '@/constants/theme';
import { useColors } from '@/lib/theme';
import { getEvents } from '@/lib/jdlive';
import { getTicketProducts, startTicketCheckout, TicketProduct } from '@/lib/ticketing';

const FINAL_TITLE = 'Juste Debout — Finales Mondiales Paris 2027';

export default function Tickets() {
  const { test } = useLocalSearchParams<{ test?: string }>();
  const testMode = test === '1';
  const c = useColors();
  const router = useRouter();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [eventId, setEventId] = useState<string | null>(null);
  const [products, setProducts] = useState<TicketProduct[]>([]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [promo, setPromo] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const events = await getEvents();
        const event = events.find((e) => e.title === FINAL_TITLE) ?? events.find((e) => e.starts_on === '2027-03-13' && e.ends_on === '2027-03-14');
        if (!event) throw new Error('Événement introuvable.');
        setEventId(event.id);
        const ps = await getTicketProducts(event.id, testMode);
        setProducts(ps);
        const initial: Record<string, number> = {};
        ps.forEach((p) => { initial[p.id] = p.min_per_order || 1; });
        setQty(initial);
      } catch (e: any) {
        setError(e?.message ?? 'Impossible de charger la billetterie.');
      } finally {
        setLoading(false);
      }
    })();
  }, [testMode]);

  const changeQty = (p: TicketProduct, delta: number) => {
    setQty((q) => {
      const current = q[p.id] ?? p.min_per_order;
      const next = Math.min(p.max_per_order, Math.max(p.min_per_order, current + delta));
      return { ...q, [p.id]: next };
    });
  };

  const buy = async (p: TicketProduct) => {
    if (!eventId) return;
    setBusy(true);
    setError(null);
    try {
      await startTicketCheckout({
        eventId,
        items: [{ productId: p.id, quantity: qty[p.id] ?? p.min_per_order }],
        promoCode: promo || null,
      });
    } catch (e: any) {
      const msg = String(e?.message ?? e ?? '');
      if (msg.includes('sales_not_started')) setError('La billetterie ouvre le 8 octobre à 21h.');
      else if (msg.includes('minimum_quantity_not_met')) setError('La quantité minimum pour ce tarif n’est pas atteinte.');
      else if (msg.includes('invalid_or_expired_promo')) setError('Ce code promotionnel est invalide ou expiré.');
      else if (msg.includes('sold_out_for_day')) setError('Cette journée a atteint sa capacité maximale. Ce pass n’est plus disponible.');
      else setError('Impossible de lancer le paiement pour le moment.');
      setBusy(false);
    }
  };

  if (loading) {
    return <Screen scroll={false}><PageHeader title="Billetterie" subtitle="Paris · 13–14 mars 2027" /><View style={styles.center}><ActivityIndicator color={c.accent} /></View></Screen>;
  }

  return (
    <Screen>
      <PageHeader title="Billetterie" subtitle="Finales Mondiales · 13–14 mars 2027" />

      <Pressable onPress={() => router.push('/seating-plan')} style={{backgroundColor:'#161A1D',borderWidth:1,borderColor:'#B5FC44',borderRadius:14,padding:16,marginBottom:Space.md,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
        <View style={{flex:1}}><T variant="h3">DÉCOUVRIR LE PLAN DE PLACEMENT</T><T variant="small" color={c.textDim} style={{marginTop:4}}>Black Card · VIP · Standard</T></View>
        <Ionicons name="map-outline" size={24} color={c.primary}/>
      </Pressable>
      <Pressable onPress={() => router.push('/seating-plan')} style={{backgroundColor:'#161A1D',borderWidth:1,borderColor:'#B5FC44',borderRadius:14,padding:16,marginBottom:Space.md,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
        <View style={{flex:1}}><T variant="h3">PLAN DE PLACEMENT</T><T variant="small" color={c.textDim} style={{marginTop:4}}>Black Card · VIP · Standard</T></View>
        <Ionicons name="map-outline" size={24} color={c.primary}/>
      </Pressable>
      <Card style={styles.early}>
        <T variant="h3">EARLY BIRD · 48H</T>
        <T variant="small" color={c.textDim} style={{ marginTop: 4 }}>
          Code 48 · -5 € sur le Pass Samedi ou Dimanche · -10 € sur le Pass 2 jours · jusqu’au 10 octobre à 21h.
        </T>
      </Card>

      <View style={{ marginTop: Space.lg }}>
        <T variant="caption" color={c.textMute} style={{ marginBottom: 6 }}>CODE PROMO</T>
        <TextInput
          value={promo}
          onChangeText={setPromo}
          autoCapitalize="characters"
          placeholder="48"
          placeholderTextColor={c.textMute}
          style={styles.input}
        />
      </View>

      {error && <T variant="small" color={c.danger} style={{ marginTop: Space.md }}>{error}</T>}

      <Card style={{ marginTop: Space.lg }}>
        <T variant="h3">À savoir avant d’acheter</T>
        <T variant="small" color={c.textDim} style={{ marginTop: 6 }}>Toute sortie est définitive : aucun retour après le premier scan de la journée.</T>
        <T variant="small" color={c.textDim} style={{ marginTop: 4 }}>Pass 2 jours et Black Card : une entrée samedi et une entrée dimanche.</T>
        <T variant="small" color={c.textDim} style={{ marginTop: 4 }}>Chaque billet possède un QR unique.</T>
      </Card>

      {testMode && <T variant="caption" color={c.accent} style={{ marginTop: Space.md }}>MODE TEST INTERNE · billet 1 € visible uniquement via ce lien</T>}

      <Section title="Choisis ton pass">
        {products.map((p) => {
          const q = qty[p.id] ?? p.min_per_order;
          const price = (p.price_cents / 100).toFixed(0);
          const total = ((p.price_cents * q) / 100).toFixed(0);
          const groupNote = p.group_size > 1 ? `${p.group_size} personnes incluses` : p.min_per_order > 1 ? `Minimum ${p.min_per_order} personnes` : null;
          return (
            <Card key={p.id} style={{ marginBottom: Space.md }}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1, paddingRight: Space.md }}>
                  <T variant="h2">{p.name}</T>
                  {!!p.description && <T variant="small" color={c.textDim} style={{ marginTop: 4 }}>{p.description}</T>}
                  {!!groupNote && <T variant="caption" color={c.accent} style={{ marginTop: 6 }}>{groupNote}</T>}
                </View>
                <T variant="title" color={c.accent} style={{ fontSize: 24 }}>{price} €</T>
              </View>

              {(p.max_per_order > 1 || p.min_per_order > 1) && (
                <View style={styles.qtyRow}>
                  <Pressable onPress={() => changeQty(p, -1)} style={styles.qtyBtn}><Ionicons name="remove" size={18} color={c.text} /></Pressable>
                  <T variant="h3" style={{ minWidth: 36, textAlign: 'center' }}>{q}</T>
                  <Pressable onPress={() => changeQty(p, 1)} style={styles.qtyBtn}><Ionicons name="add" size={18} color={c.text} /></Pressable>
                  <T variant="small" color={c.textDim} style={{ marginLeft: 8 }}>Total {total} €</T>
                </View>
              )}

              <Pressable disabled={busy} onPress={() => buy(p)} style={[styles.buy, busy && { opacity: 0.5 }]}>
                {busy ? <ActivityIndicator color={c.black} /> : <><T variant="label" color={c.black}>Acheter</T><Ionicons name="arrow-forward" size={18} color={c.black} /></>}
              </Pressable>
            </Card>
          );
        })}
      </Section>
    </Screen>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  early: { borderColor: c.primary },
  input: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: c.text,
    fontSize: 16,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', marginTop: Space.lg },
  qtyBtn: {
    width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: c.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface,
  },
  buy: {
    marginTop: Space.lg, backgroundColor: c.primary, borderRadius: Radius.pill,
    paddingVertical: 15, paddingHorizontal: 18, flexDirection: 'row', gap: 8,
    alignItems: 'center', justifyContent: 'center',
  },
});
