import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Vitruve, Wordmark } from '@/components/Logo';
import { Card, PageHeader, Screen, T } from '@/components/ui';
import { Radius, Space } from '@/constants/brand';
import { BlackCardMembership, getMyBlackCard } from '@/lib/blackCard';
import { useColors } from '@/lib/theme';

const GOLD = '#D9C27A';
export default function BlackCardScreen() {
  const c = useColors();
  const [card, setCard] = useState<BlackCardMembership | null>();
  const [error, setError] = useState(false);
  const [width, setWidth] = useState(340);
  const [qrOpen, setQrOpen] = useState(false);
  const load = () => {
    setError(false);
    setCard(undefined);
    getMyBlackCard().then(setCard).catch(() => { setError(true); setCard(null); });
  };
  useEffect(load, []);
  const qrSize = Math.max(96, Math.min(180, Math.floor(width * 0.34)));
  const titleSize = Math.min(68, Math.max(40, width * 0.14));
  const number = card?.card_number.replace(/^JD-BC-/, '2026-').replace('-', ' · ') || '2026 · 0000';
  return <Screen><PageHeader title="Black Card" subtitle="Juste Debout · Membership" />
    {card === undefined ? <ActivityIndicator /> : error ? <Card><T variant="h3">Impossible de charger ta carte</T><Pressable onPress={load} accessibilityRole="button"><T style={{ marginTop: 12 }} color={c.primary}>Réessayer</T></Pressable></Card> : <>
      <View style={styles.blackCard} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
        <View style={styles.glow} />
        <View style={styles.logo}><Vitruve size={48} color={GOLD} /></View>
        <View style={styles.body}>
          <View style={styles.identity}>
            <T variant="title" color="#FFFFFF" style={{ fontSize: titleSize, lineHeight: titleSize }}>BLACK</T>
            <T variant="title" color={GOLD} style={{ fontSize: titleSize, lineHeight: titleSize }}>CARD</T>
            <T variant="small" color="#FFFFFF" style={{ marginTop: 14 }}>{card?.holder_name || (card ? 'Titulaire à renseigner' : 'PRÉNOM NOM')}</T>
            <T variant="h2" color="#FFFFFF" style={{ marginTop: 8, fontSize: width < 340 ? 15 : 18 }}>{number}</T>
            <T variant="caption" color="#A9A9A9" style={{ marginTop: 8 }}>{card ? `VALABLE JUSQU’AU ${new Date(card.valid_until).toLocaleDateString('fr-FR')}` : 'APERÇU · NON ACTIVE'}</T>
          </View>
          <View style={styles.qrColumn}>
            {card?.qr_token ? <Pressable onPress={() => setQrOpen(true)} accessibilityRole="button" accessibilityLabel="Agrandir le QR code de mon billet" style={styles.qr}>
              <QRCode value={card.qr_token} size={qrSize} color="#0A0A0A" backgroundColor="#FFFFFF" quietZone={8} />
            </Pressable> : <View style={[styles.qrPlaceholder, { width: qrSize + 16, height: qrSize + 16 }]}><Ionicons name="qr-code-outline" size={qrSize * 0.7} color={GOLD} /></View>}
            <T variant="caption" color={GOLD} style={{ marginTop: 8 }}>{card?.qr_token ? 'MON BILLET' : 'APERÇU'}</T>
          </View>
        </View>
        <View style={styles.signature}><Wordmark height={34} color={GOLD} /></View>
      </View>
      <Card style={{ marginTop: Space.lg }}>
        <T variant="h3">{card ? 'Tes avantages actifs' : 'Aucune Black Card active'}</T>
        {card ? <>
          <View style={styles.benefit}><Ionicons name="bag-handle-outline" size={20} color={c.primary} /><T variant="small">-{card.merchandise_discount_percent}% sur le merchandising éligible dans l’app</T></View>
          <View style={styles.benefit}><Ionicons name="ticket-outline" size={20} color={c.primary} /><T variant="small" style={{ flex: 1 }}>Ce QR reprend ton billet acheté. Les accès sont contrôlés selon les événements et dates inclus.</T></View>
          <View style={styles.benefit}><Ionicons name="calendar-outline" size={20} color={c.primary} /><T variant="small" style={{ flex: 1 }}>Membership valable 1 an à compter de l’activation</T></View>
        </> : <T variant="small" color={c.textDim} style={{ marginTop: 6 }}>La Black Card est limitée à 56 exemplaires et valable un an à compter de son activation.</T>}
      </Card>
    </>}
    <Modal visible={qrOpen && !!card?.qr_token} transparent animationType="fade" onRequestClose={() => setQrOpen(false)}>
      <Pressable style={styles.modal} onPress={() => setQrOpen(false)} accessibilityRole="button" accessibilityLabel="Fermer le QR code agrandi">
        <View style={styles.largeQr}>{card?.qr_token && <QRCode value={card.qr_token} size={240} quietZone={16} color="#0A0A0A" backgroundColor="#FFFFFF" />}</View>
        <T color="#FFFFFF" style={{ marginTop: 18 }}>Toucher pour fermer</T>
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
