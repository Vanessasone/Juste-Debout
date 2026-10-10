import { EventPoster } from '@/components/EventPoster';
import { useI18n } from '@/lib/i18n';
import { ticketProductText } from '@/lib/ticketProductText';
import { LanguagePicker } from '@/components/LanguagePicker';
import { Ionicons } from '@expo/vector-icons';
import { useCustomerText } from '@/lib/customerText';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TicketComparison, TicketFAQ, TicketVideoPreview } from '@/components/TicketSalesGuide';

import { Vitruve, Wordmark } from '@/components/Logo';
import { EarlyBirdCountdown } from '@/components/EarlyBirdCountdown';
import { Card, PageHeader, Screen, Section, T } from '@/components/ui';
import { Radius, Space } from '@/constants/brand';
import { ThemeColors } from '@/constants/theme';
import { useColors } from '@/lib/theme';
import { readTicketDraft, saveTicketDraft } from '@/lib/ticketPurchase';
import { supabase } from '@/lib/supabase';
import { getTicketProducts, TicketProduct } from '@/lib/ticketing';
import { EARLY_BIRD_END, EARLY_BIRD_START, earlyBirdState } from '@/lib/earlyBird';
import { checkoutPromo, displayedTicketPrice, ticketGroup, TicketGroup } from '@/lib/ticketSalesPresentation';

const PARIS_EVENT_ID = 'eb0025ca-b597-4708-9d47-b24ebbf507b5';

export default function Tickets() {
  const { test, resume } = useLocalSearchParams<{ test?: string; resume?: string }>();
  const requestedTest = test === '1';
  const [testMode, setTestMode] = useState(false);
  const c = useColors();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const ct = useCustomerText();
  const { locale, t } = useI18n();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [eventId, setEventId] = useState<string | null>(null);
  const [products, setProducts] = useState<TicketProduct[]>([]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [promo, setPromo] = useState(() => earlyBirdState(Date.now()).phase === 'active' ? '48' : '');
  const [now, setNow] = useState(Date.now);
  const [group, setGroup] = useState<TicketGroup>('standard');
  const scrollRef = useRef<ScrollView>(null);
  const offersY = useRef(0);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<{ days: { date: string; remaining: number }[]; black_card: { capacity: number; remaining: number } } | null>(null);

  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const boundary = now < EARLY_BIRD_START ? EARLY_BIRD_START : EARLY_BIRD_END;
    const timer = now < boundary ? setTimeout(refresh, Math.min(2147483647, boundary - now + 10)) : undefined;
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [now]);

  const earlyActive = earlyBirdState(now).phase === 'active';
  const effectivePromo = promo.trim() === '48' && !earlyActive ? '' : promo;
  const showOffers = (nextGroup?: TicketGroup) => {
    if (nextGroup) setGroup(nextGroup);
    scrollRef.current?.scrollTo({ y: offersY.current, animated: true });
  };
  const lowestPrice = (codes: string[]) => {
    const matching = products.filter(p => p.active && codes.includes(p.code));
    return matching.length ? Math.min(...matching.map(p => displayedTicketPrice(p, effectivePromo, now))) : null;
  };
  const groups = [
    { id: 'standard' as const, label: 'salesStandard' as const },
    { id: 'vip' as const, label: 'salesVip' as const },
    { id: 'black' as const, label: 'salesBlack' as const },
    { id: 'family' as const, label: 'salesFamily' as const },
  ];

  useEffect(() => {
    (async () => {
      try {
        const event = { id: PARIS_EVENT_ID };
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
        const draft = await readTicketDraft();
        if (draft?.eventId === event.id) {
          const product = ps.find(p => p.id === draft.productId && p.active);
          if (product) {
            initial[product.id] = Math.max(product.min_per_order, Math.min(product.max_per_order, draft.quantity));
            setPromo(draft.promoCode || (earlyBirdState(Date.now()).phase === 'active' ? '48' : ''));
            setSelectedProduct(product.id);
            setGroup(ticketGroup(product.code));
          }
        }
        setQty(initial);
      } catch (e: any) {
        setError(ct('loadError'));
      } finally {
        setLoading(false);
      }
    })();
  }, [requestedTest, resume]);

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
    await saveTicketDraft({ eventId, productId: p.id, productName: ticketProductText(p.code, locale, p).name, productCode: p.code, quantity: qty[p.id] ?? p.min_per_order, promoCode: checkoutPromo(p, effectivePromo, Date.now()), createdAt: Date.now() });
    router.push('/ticket-details');
  };

  if (loading) {
    return <Screen scroll={false}><PageHeader title={ct('boxoffice')} subtitle={ct('finals')} /><View style={styles.center}><ActivityIndicator color={c.accent} /></View></Screen>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
    <Screen scrollRef={scrollRef}>
      <LanguagePicker />
      <View accessibilityLabel="Juste Debout" style={{ backgroundColor: '#161A1D', borderRadius: 18, alignItems: 'center', paddingVertical: 16, marginBottom: Space.md, gap: 8 }}><Vitruve size={64} /><Wordmark height={26} /></View>
      <EarlyBirdCountdown />
      <PageHeader title={ct('boxoffice')} subtitle={ct('finals')} />
      <View style={[styles.hero, { flexDirection: width >= 900 ? 'row' : 'column', alignItems: 'center', gap: 24 }]}><View style={{ flex: 1, width: '100%', minWidth: 0 }}>
        <T variant="title" color="#FFFFFF" style={{ fontSize: width >= 900 ? 76 : 48, lineHeight: width >= 900 ? 80 : 52 }}>{ct('salesHeadline')}</T>
        <T color="#B5FC44" style={{ marginTop: 20, fontSize: 20, lineHeight: 28 }}>{ct('salesVenue')}</T>
        <Pressable accessibilityRole="button" onPress={() => showOffers()} style={styles.buy}>
          <T variant="label" color="#000000">{ct('salesReserve')}</T><Ionicons name="arrow-down" size={20} color="#000000" />
        </Pressable>
        <T variant="small" color="#FFFFFF" style={{ marginTop: 12, lineHeight: 21 }}>{ct('salesTrust')}</T>
        </View><View style={{ width: width >= 900 ? '36%' : '100%', maxWidth: 400 }}><EventPoster /></View>
      </View>
      <View style={{ backgroundColor: '#B5FC44', borderRadius: 16, padding: 20, marginBottom: 16 }}><T variant="label" color="#000000" style={{ fontSize: 20, lineHeight: 30, textAlign: 'center' }}>POPPING · LOCKING · HIP HOP · HOUSE · JUNIOR DANCE TOUR · AFRO · DANCEHALL · ELECTRO · KRUMP</T></View>
      <TicketVideoPreview />
      <T variant="small" color={c.textDim} style={{ marginBottom: Space.md }}>{ct('steps')}</T>
      <Pressable onPress={() => router.push('/login')} accessibilityRole="button"><T variant="small" color={c.accent}>{ct('login')}</T></Pressable>

      <Pressable onPress={() => router.push('/seating-plan')} style={{backgroundColor:'#161A1D',borderWidth:1,borderColor:'#B5FC44',borderRadius:14,padding:16,marginBottom:Space.md,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
        <View style={{flex:1}}><T variant="h3" color="#FFFFFF">{ct('plan')}</T><T variant="small" color="#E5E5E5" style={{marginTop:4}}>Black Card · VIP · Standard</T></View>
        <Ionicons name="map-outline" size={24} color={c.primary}/>
      </Pressable>

      <View style={{ marginTop: Space.lg }}>
        <T variant="h3" color={c.text} style={{ marginBottom: 10 }}>{ct('promo')}</T>
        <TextInput
          accessibilityLabel={ct('promo')}
          value={effectivePromo}
          onChangeText={setPromo}
          autoCapitalize="characters"
          placeholder={earlyActive ? '48' : ct('promo')}
          placeholderTextColor={c.textMute}
          style={styles.input}
        />
        {earlyActive && effectivePromo.trim() === '48' && <T variant="small" color={c.accent} style={{ marginTop: 8 }}>{ct('salesPromoApplied')}</T>}
      </View>

      {error && <T variant="small" color={c.danger} style={{ marginTop: Space.md }}>{error}</T>}

      {testMode && <Card style={{marginTop:Space.md,borderColor:c.accent}}><T variant="h3">APERÇU INTERNE DES NOUVEAUX PASS</T><T variant="small" color={c.textDim} style={{marginTop:6}}>Les pass 3 et 4 jours sont visibles ici uniquement pour vérification par les administrateurs. Ils restent désactivés et ne peuvent pas être achetés. Le billet technique 1 € reste réservé aux tests.</T></Card>}

      <TicketComparison prices={{ standard: lowestPrice(['day_sat','day_sun']), vip: lowestPrice(['vip_sat','vip_sun']), black: lowestPrice(['black_card']) }} onChoose={showOffers} />

      <View onLayout={event => { offersY.current = event.nativeEvent.layout.y; }}>
      <Section title={ct('choose')} titleStyle={{ fontSize: 36, lineHeight: 42, flexShrink: 1 }}>
        <View style={styles.groups}>
          {groups.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: group === item.id }} onPress={() => setGroup(item.id)} style={[styles.group, group === item.id && { backgroundColor: c.primary, borderColor: c.primary }]}>
            <T variant="label" color={group === item.id ? '#000000' : c.text} style={{ fontSize: 13 }}>{ct(item.label)}</T>
          </Pressable>)}
        </View>
        <T variant="small" color={c.textDim} style={{ marginBottom: 16 }}>{ct(group === 'standard' ? 'salesStandardInfo' : group === 'vip' ? 'salesVipInfo' : group === 'black' ? 'salesBlackInfo' : 'salesFamilyInfo')}</T>
        {products.filter(p => ticketGroup(p.code) === group).map((p) => {
          const q = qty[p.id] ?? p.min_per_order;
          const display = ticketProductText(p.code, locale, p);
          const displayCents = displayedTicketPrice(p, effectivePromo, now);
          const discounted = displayCents < p.price_cents;
          const price = (displayCents / 100).toFixed(0);
          const total = ((displayCents * q) / 100).toFixed(0);
          const previewOnly = !p.active && ['three_days', 'four_days'].includes(p.code);
          const vip = ['vip_sat','vip_sun','vip_two_days'].includes(p.code);
          const bc = p.code === 'black_card';
          const sat = availability?.days.find(d=>d.date==='2027-03-13')?.remaining;
          const sun = availability?.days.find(d=>d.date==='2027-03-14')?.remaining;
          const remaining = bc ? availability?.black_card.remaining : p.code==='vip_sat' ? sat : p.code==='vip_sun' ? sun : vip && sat!==undefined && sun!==undefined ? Math.min(sat,sun) : undefined;
          const soldOut = remaining !== undefined && remaining < q;
          const groupNote = p.code.startsWith('family_') ? ct('family') : p.group_size > 1 ? ct('people', { n: p.group_size }) : p.min_per_order > 1 ? ct('minimum', { n: p.min_per_order }) : null;
          return (
            <Card key={p.id} style={{ marginBottom: Space.md, ...(selectedProduct === p.id ? { borderColor: c.primary, borderWidth: 2 } : {}) }}>
              {selectedProduct === p.id && <T variant="caption" color={c.accent}>{ct('selected')}</T>}
              <View style={styles.rowBetween}>
                <View style={{ flex: 1, paddingRight: Space.md }}>
                  <T variant="h2" style={{ fontSize: 28, lineHeight: 34 }}>{display.name}</T>
                  {previewOnly && <T variant="caption" color={c.accent} style={{marginTop:5}}>{ct('preview')}</T>}
                  {!!p.description && <T variant="small" color={c.textDim} style={{ marginTop: 4 }}>{display.description}</T>}
                  {(vip || bc) && <T variant="small" color={soldOut ? c.danger : c.accent} style={{marginTop:6}}>{remaining===undefined ? ct('availability') : remaining===0 ? ct('full') : `${ct('places', { n: remaining, max: bc ? 56 : 112 })}${vip ? ` · ${ct('perDay')}` : ''}`}</T>}
                  {!!groupNote && <T variant="caption" color={c.accent} style={{ marginTop: 6 }}>{groupNote}</T>}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {discounted && <T variant="small" color={c.textDim} style={{ textDecorationLine: 'line-through' }}>{(p.price_cents / 100).toFixed(0)} €</T>}
                  <T variant="title" color={c.accent} style={{ fontSize: 36 }}>{price} €</T>
                  {discounted && <T variant="small" color={c.accent}>{ct('salesWithCode')}</T>}
                </View>
              </View>

              {(vip || bc) && <View style={{ marginTop: Space.md, gap: 8 }}>
                <T variant="h3">{ct(bc ? 'includedBlack' : 'includedVip')}</T>
                {(bc
                  ? ['benefit1','benefit2','benefit3','benefit4','benefit5','benefit6','benefit7','benefit8','benefit9'] as const
                  : ['vipBenefit1','vipBenefit2','vipBenefit3','vipBenefit4'] as const
                ).map(key => <T key={key} variant="small" color={c.textDim}>• {ct(key)}</T>)}
              </View>}

              {(p.max_per_order > 1 || p.min_per_order > 1) && (
                <View style={styles.qtyRow}>
                  <Pressable onPress={() => changeQty(p, -1)} style={styles.qtyBtn}><Ionicons name="remove" size={18} color={c.text} /></Pressable>
                  <T variant="h3" style={{ minWidth: 36, textAlign: 'center' }}>{q}</T>
                  <Pressable onPress={() => changeQty(p, 1)} style={styles.qtyBtn}><Ionicons name="add" size={18} color={c.text} /></Pressable>
                  <T variant="small" color={c.textDim} style={{ marginLeft: 8 }}>{t('checkout.total')} {total} €</T>
                </View>
              )}

              <Pressable disabled={previewOnly || busy || soldOut || ((vip || bc) && !availability)} onPress={() => buy(p)} style={[styles.buy, (previewOnly || busy || soldOut || ((vip || bc) && !availability)) && { opacity: 0.5 }]}>
                {busy ? <ActivityIndicator color={c.black} /> : <><T variant="label" color={c.black}>{previewOnly ? ct('soon') : soldOut ? ct('full') : selectedProduct === p.id ? ct('continue') : ct('choosePass')}</T><Ionicons name="arrow-forward" size={18} color={c.black} /></>}
              </Pressable>
            </Card>
          );
        })}
      </Section>
      </View>
      <TicketFAQ />
      <View style={{ backgroundColor: '#161A1D', borderRadius: 24, padding: 24, marginTop: 24 }}>
        <T variant="h2" color="#FFFFFF" style={{ fontSize: 36, lineHeight: 42 }}>{ct('salesReserve')}</T>
        <T color="#E5E5E5" style={{ marginTop: 12, lineHeight: 24 }}>{ct('salesTrust')}</T>
        <Pressable accessibilityRole="button" onPress={() => showOffers()} style={styles.buy}><T variant="label" color="#000000">{ct('choose')}</T><Ionicons name="arrow-up" size={20} color="#000000" /></Pressable>
      </View>
    </Screen>
    {width < 768 && <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: c.bg, borderTopWidth: 1, borderColor: c.border, paddingHorizontal: 16, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 12) }}>
      <Pressable accessibilityRole="button" accessibilityLabel={ct('salesReserve')} onPress={() => showOffers()} style={[styles.buy, { marginTop: 0 }]}>
        <T variant="label" color="#000000">{ct('salesReserve')}</T><Ionicons name="arrow-down" size={20} color="#000000" />
      </Pressable>
    </View>}
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  hero: { backgroundColor: '#161A1D', borderRadius: Radius.xl, padding: 24, marginVertical: 16 },
  groups: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  group: { paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: c.border, borderRadius: Radius.pill },
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
