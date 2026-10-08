import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Card, PageHeader, Screen, Section, T } from '@/components/ui';
import { Radius, Space } from '@/constants/brand';
import { ThemeColors } from '@/constants/theme';
import { useColors } from '@/lib/theme';
import { getEvents } from '@/lib/jdlive';
import { supabase } from '@/lib/supabase';
import { getTicketProducts, startTicketCheckout, TicketProduct } from '@/lib/ticketing';

const FINAL_TITLE = 'Juste Debout — Finales Mondiales Paris 2027';

export default function Tickets() {
  const { test } = useLocalSearchParams<{ test?: string }>();
  const requestedTest = test === '1';
  const [testMode, setTestMode] = useState(false);
  const c = useColors();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [eventId, setEventId] = useState<string | null>(null);
  const [products, setProducts] = useState<TicketProduct[]>([]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [promo, setPromo] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<{ days: { date: string; remaining: number }[]; black_card: { capacity: number; remaining: number } } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const events = await getEvents();
        const event = events.find((e) => e.title === FINAL_TITLE) ?? events.find((e) => e.starts_on === '2027-03-13' && e.ends_on === '2027-03-14');
        if (!event) throw new Error('Événement introuvable.');
        setEventId(event.id);
        let authorizedPreview = false;
        if (requestedTest) {
          const { data: { user }, error: authError } = await supabase.auth.getUser();
          if (!authError && user) {
            const { data: profile, error: profileError } = await supabase.from('profiles').select('roles').eq('id', user.id).maybeSingle();
            authorizedPreview = !profileError && Array.isArray(profile?.roles) && profile.roles.includes('admin');
          }
        }
        setTestMode(authorizedPreview);
        const ps = await getTicketProducts(event.id, authorizedPreview);
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
  }, [requestedTest]);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      const { data, error } = await supabase.rpc('vip_availability_2027');
      if (mounted && !error && data?.days && data?.black_card) setAvailability(data);
    };
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => { mounted = false; clearInterval(timer); };
  }, []);

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
      else if (msg.includes('vip_sold_out_for_day')) setError('Les places VIP sont complètes pour cette journée.');
      else if (msg.includes('sold_out_for_day')) setError('Cette journée a atteint sa capacité maximale. Ce pass n’est plus disponible.');
      else if (msg.includes('ticket_products_stock_limit') || msg.includes('sold_out')) setError('Cette catégorie est complète.');
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
      {Date.now() < Date.parse('2026-10-10T19:00:00Z') && <Card style={styles.early}>
        <T variant="h3">EARLY BIRD · 48H</T>
        <T variant="small" color={c.textDim} style={{ marginTop: 4 }}>
          Code 48 · Standard : 35 € le samedi ou le dimanche, 60 € les deux jours · du 8 octobre à 21h au 10 octobre à 21h (heure de Paris).
        </T>
      </Card>}

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
        <T variant="small" color={c.textDim} style={{ marginTop: 4 }}>Pass 3 jours : 12, 13 et 14 mars · Pass 4 jours : 11, 12, 13 et 14 mars. Ces formules ne sont pas encore ouvertes à la vente.</T>
      </Card>

      {testMode && <Card style={{marginTop:Space.md,borderColor:c.accent}}><T variant="h3">APERÇU INTERNE DES NOUVEAUX PASS</T><T variant="small" color={c.textDim} style={{marginTop:6}}>Les pass 3 et 4 jours sont visibles ici uniquement pour vérification par les administrateurs. Ils restent désactivés et ne peuvent pas être achetés. Le billet technique 1 € reste réservé aux tests.</T></Card>}

      <Section title="Choisis ton pass">
        {products.map((p) => {
          const q = qty[p.id] ?? p.min_per_order;
          const price = (p.price_cents / 100).toFixed(0);
          const total = ((p.price_cents * q) / 100).toFixed(0);
          const previewOnly = !p.active && ['three_days', 'four_days'].includes(p.code);
          const vip = ['vip_sat','vip_sun','vip_two_days'].includes(p.code);
          const bc = p.code === 'black_card';
          const sat = availability?.days.find(d=>d.date==='2027-03-13')?.remaining;
          const sun = availability?.days.find(d=>d.date==='2027-03-14')?.remaining;
          const remaining = bc ? availability?.black_card.remaining : p.code==='vip_sat' ? sat : p.code==='vip_sun' ? sun : vip && sat!==undefined && sun!==undefined ? Math.min(sat,sun) : undefined;
          const soldOut = remaining !== undefined && remaining < q;
          const groupNote = p.code.startsWith('family_') ? '2 adultes + 2 enfants de moins de 12 ans' : p.group_size > 1 ? `${p.group_size} personnes incluses` : p.min_per_order > 1 ? `Minimum ${p.min_per_order} personnes` : null;
          return (
            <Card key={p.id} style={{ marginBottom: Space.md }}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1, paddingRight: Space.md }}>
                  <T variant="h2">{p.name}</T>
                  {previewOnly && <T variant="caption" color={c.accent} style={{marginTop:5}}>APERÇU INTERNE — VENTE DÉSACTIVÉE</T>}
                  {!!p.description && <T variant="small" color={c.textDim} style={{ marginTop: 4 }}>{p.description}</T>}
                  {(vip || bc) && <T variant="small" color={soldOut ? c.danger : c.accent} style={{marginTop:6}}>{remaining===undefined ? 'Disponibilité en cours de vérification' : remaining===0 ? 'COMPLET' : `${remaining} place${remaining>1?'s':''} restante${remaining>1?'s':''} sur ${bc?56:112}${vip?' par jour':''}`}</T>}
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

              <Pressable disabled={previewOnly || busy || soldOut || ((vip || bc) && !availability)} onPress={() => buy(p)} style={[styles.buy, (previewOnly || busy || soldOut || ((vip || bc) && !availability)) && { opacity: 0.5 }]}>
                {busy ? <ActivityIndicator color={c.black} /> : <><T variant="label" color={c.black}>{previewOnly ? 'Bientôt disponible' : soldOut ? 'Complet' : 'Acheter'}</T><Ionicons name="arrow-forward" size={18} color={c.black} /></>}
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
