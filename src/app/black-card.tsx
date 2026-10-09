import { useCustomerText } from '@/lib/customerText';
import { useI18n } from '@/lib/i18n';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Vitruve, Wordmark } from '@/components/Logo';
import { Card, PageHeader, Screen, T } from '@/components/ui';
import { Radius, Space } from '@/constants/brand';
import { BLACK_CARD_BENEFITS } from '@/constants/blackCardBenefits';
import { BlackCardMembership, BlackCardEvent, getMyBlackCard, getMyBlackCardEvents } from '@/lib/blackCard';
import { useColors } from '@/lib/theme';

const GOLD = '#D9C27A';
export default function BlackCardScreen() {
  const c = useColors();
  const ct = useCustomerText();
  const { locale } = useI18n();
  const [card, setCard] = useState<BlackCardMembership | null>();
  const [events, setEvents] = useState<BlackCardEvent[]>([]);
  const [calendarError,setCalendarError] = useState(false);
  const loadEvents = () => { setCalendarError(false); getMyBlackCardEvents().then(setEvents).catch(()=>setCalendarError(true)); };
  const [error, setError] = useState(false);
  const [width, setWidth] = useState(340);
  const [qrOpen, setQrOpen] = useState(false);
  const load = () => {
    setError(false);
    setCard(undefined);
    getMyBlackCard().then(setCard).catch(() => { setError(true); setCard(null); });
  };
  useEffect(load, []);
  useEffect(()=>{if(card) loadEvents();else setEvents([]);},[card?.id]);
  const qrSize = Math.max(96, Math.min(180, Math.floor(width * 0.34)));
  const titleSize = Math.min(68, Math.max(40, width * 0.14));
  const number = card?.card_number.replace(/^JD-BC-/, '2026-').replace('-', ' · ') || '2026 · 0000';
  return <Screen><PageHeader title="Black Card" subtitle="Juste Debout · Membership" />
    {card === undefined ? <ActivityIndicator /> : error ? <Card><T variant="h3">{ct('cardLoad')}</T><Pressable onPress={load} accessibilityRole="button"><T style={{ marginTop: 12 }} color={c.primary}>{ct('retry')}</T></Pressable></Card> : <>
      <View style={styles.blackCard} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
        <View style={styles.glow} />
        <View style={styles.logo}><Vitruve size={48} color={GOLD} /></View>
        <View style={styles.body}>
          <View style={styles.identity}>
            <T variant="title" color="#FFFFFF" style={{ fontSize: titleSize, lineHeight: titleSize }}>BLACK</T>
            <T variant="title" color={GOLD} style={{ fontSize: titleSize, lineHeight: titleSize }}>CARD</T>
            <T variant="small" color="#FFFFFF" style={{ marginTop: 14 }}>{card?.holder_name || (card ? ct('name') : ct('name').toUpperCase())}</T>
            <T variant="h2" color="#FFFFFF" style={{ marginTop: 8, fontSize: width < 340 ? 15 : 18 }}>{number}</T>
            <T variant="caption" color="#A9A9A9" style={{ marginTop: 8 }}>{card ? ct('validUntil', {date:new Date(card.valid_until).toLocaleDateString(locale)}) : ct('inactivePreview')}</T>
          </View>
          <View style={styles.qrColumn}>
            {card?.qr_token ? <Pressable onPress={() => setQrOpen(true)} accessibilityRole="button" accessibilityLabel={ct('qrZoom')} style={styles.qr}>
              <QRCode value={card.qr_token} size={qrSize} color="#0A0A0A" backgroundColor="#FFFFFF" quietZone={8} />
            </Pressable> : <View style={[styles.qrPlaceholder, { width: qrSize + 16, height: qrSize + 16 }]}><Ionicons name="qr-code-outline" size={qrSize * 0.7} color={GOLD} /></View>}
            <T variant="caption" color={GOLD} style={{ marginTop: 8 }}>{card?.qr_token ? ct('myTicket').toUpperCase() : ct('previewShort')}</T>
          </View>
        </View>
        <View style={styles.signature}><Wordmark height={34} color={GOLD} /></View>
      </View>
      <Card style={{ marginTop: Space.lg }}>
        <T variant="h3">{card ? ct('activeBenefits') : ct('noBlack')}</T>
        {card ? <>
          <View style={styles.benefit}><Ionicons name="bag-handle-outline" size={20} color={c.primary} /><T variant="small">{ct('merchDiscount', {n:card.merchandise_discount_percent})}</T></View>
          <View style={styles.benefit}><Ionicons name="ticket-outline" size={20} color={c.primary} /><T variant="small" style={{ flex: 1 }}>{ct('qrAccess')}</T></View>
          <View style={styles.benefit}><Ionicons name="calendar-outline" size={20} color={c.primary} /><T variant="small" style={{ flex: 1 }}>{ct('blackYear')}</T></View>
        </> : <T variant="small" color={c.textDim} style={{ marginTop: 6 }}>{ct('blackLimit')}</T>}
      </Card>
      {card && <Card style={{marginTop:Space.lg}}>
        <T variant="h3">{ct('blackProgram')}</T>
        {calendarError ? <Pressable onPress={loadEvents}><T color={c.primary} style={{marginTop:12}}>{ct('retry')}</T></Pressable> : events.map(event => {
          const canonical = event.event_id === 'eb0025ca-b597-4708-9d47-b24ebbf507b5';
          const date = (value:string) => new Date(value+'T12:00:00Z').toLocaleDateString(locale,{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Paris'});
          return <View key={event.event_id} style={{marginTop:14}}>
            <T variant="small">{canonical ? ct('presels')+' · '+date('2027-03-11')+' – '+date('2027-03-12') : event.events?.title}</T>
            <T variant="caption" color={c.textDim}>{canonical ? ct('preselVenue') : date(event.access_start_date)+' – '+date(event.access_end_date)+' · '+(event.events?.venue || ct('unknownVenue'))}</T>
            {canonical && <><T variant="small" style={{marginTop:10}}>{ct('finalDays')+' · '+date('2027-03-13')+' – '+date('2027-03-14')}</T><T variant="caption" color={c.textDim}>{event.events?.venue || 'Stade Pierre-de-Coubertin'}</T></>}
          </View>;
        })}
        <T variant="small" color={c.textDim} style={{marginTop:14}}>{ct('blackCalendar')}</T>
      </Card>}
      <Card style={{ marginTop: Space.lg }}>
        <T variant="h3">{ct('includedBlack')}</T>
        {BLACK_CARD_BENEFITS.map(benefit => <T key={benefit} variant="small" color={c.textDim} style={{marginTop: 12}}>• {ct(`benefit${BLACK_CARD_BENEFITS.indexOf(benefit) + 1}` as Parameters<typeof ct>[0])}</T>)}
        <T variant="small" color={c.textDim} style={{marginTop: 16}}>{ct('blackCalendar')}</T>
      </Card>
    </>}
    <Modal visible={qrOpen && !!card?.qr_token} transparent animationType="fade" onRequestClose={() => setQrOpen(false)}>
      <Pressable style={styles.modal} onPress={() => setQrOpen(false)} accessibilityRole="button" accessibilityLabel={ct('closeQr')}>
        <View style={styles.largeQr}>{card?.qr_token && <QRCode value={card.qr_token} size={240} quietZone={16} color="#0A0A0A" backgroundColor="#FFFFFF" />}</View>
        <T color="#FFFFFF" style={{ marginTop: 18 }}>{ct('close')}</T>
      </Pressable>
    </Modal>
  </Screen>;
}
const styles = StyleSheet.create({
  blackCard: { borderRadius: Radius.xl, padding: 20, backgroundColor: '#050505', borderWidth: 1, borderColor: '#3A3421', overflow: 'hidden', maxWidth: 650, width: '100%', alignSelf: 'center' },
  glow: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: '#19160D', right: -60, top: -80 },
  logo: { alignItems: 'center', marginBottom: 16 },
  body: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  identity: { flex: 1 },
  qrColumn: { alignItems: 'center' },
  qr: { backgroundColor: '#FFFFFF', padding: 4 },
  qrPlaceholder: { borderWidth: 1, borderColor: '#3A3421', alignItems: 'center', justifyContent: 'center' },
  signature: { alignItems: 'center', marginTop: 22 },
  benefit: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 14 },
  modal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  largeQr: { backgroundColor: '#FFFFFF', padding: 8 },
});
