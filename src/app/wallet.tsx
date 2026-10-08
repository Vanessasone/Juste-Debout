/**
 * Portefeuille — les billets de l'utilisateur avec leur QR d'entrée.
 */
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Card, GButton, PageHeader, Screen, Section, T, Tag } from '@/components/ui';
import { Radius, Space } from '@/constants/brand';
import { ThemeColors } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { cancelTicketTransfer, getMyTickets, prepareTicketTransfer, Ticket } from '@/lib/tickets';
import { useColors } from '@/lib/theme';

export default function Wallet() {
  const c = useColors();
  const t = useT();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [transferTicket, setTransferTicket] = useState<Ticket | null>(null);
  const [transferEmail, setTransferEmail] = useState('');
  const [transferBusy, setTransferBusy] = useState(false);

  const load = async () => {
    try {
      const tk = await getMyTickets();
      setTickets(tk);
    } catch (e: any) {
      setError(e?.message ?? t('reg.loadFail'));
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => {
    load();
  }, []));


  const sendTransfer = async () => {
    if (!transferTicket || !transferEmail.trim()) return;
    setTransferBusy(true);
    try {
      await prepareTicketTransfer(transferTicket.id, transferEmail);
      Alert.alert('Invitation envoyée', `Le billet a été proposé à ${transferEmail.trim()}. Tu peux annuler tant qu’il n’a pas été récupéré.`);
      setTransferTicket(null); setTransferEmail('');
      await load();
    } catch (e: any) {
      Alert.alert('Impossible de transférer', e?.message ?? 'Réessaie plus tard.');
    } finally { setTransferBusy(false); }
  };

  if (loading) {
    return (
      <Screen scroll={false}>
        <PageHeader title={t('wallet.title')} subtitle={t('wallet.subtitle')} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={c.accent} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader title={t('wallet.title')} subtitle={t('wallet.subtitle')} />

      {tickets.filter((x) => x.status === 'active').length > 1 && <Card style={{marginBottom:Space.md}}><T variant="h3">Tous tes QR codes au même endroit</T><T variant="small" color={c.textDim} style={{marginTop:6}}>Tu peux conserver tous les billets ici, notamment pour une surprise. L’envoi à chaque invité est facultatif : utilise « Envoyer ce billet » uniquement si tu souhaites le transférer.</T></Card>}
      {tickets.filter((x) => x.status === 'active').length > 1 && (
        <Pressable onPress={() => router.push('/manage-tickets')} style={styles.groupBtn}>
          <Ionicons name="people-outline" size={19} color={c.text} />
          <View style={{flex:1}}>
            <T variant="h3">Gérer mes billets / mon groupe</T>
            <T variant="caption" color={c.textMute}>Importer une liste et attribuer plusieurs billets</T>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.textMute} />
        </Pressable>
      )}

      {error && (
        <T variant="small" color={c.danger} style={{ marginBottom: Space.sm }}>
          {error}
        </T>
      )}

      {tickets.length === 0 ? (
        <Card>
          <T variant="h3">Aucun billet pour le moment</T>
          <T variant="small" color={c.textDim} style={{marginTop:8,marginBottom:Space.md}}>Tes billets achetés apparaîtront ici avec leur QR code.</T>
          <GButton label="Accéder à la billetterie" icon="ticket" onPress={() => router.push('/tickets')} />
        </Card>
      ) : tickets.map((tkt) => (
        <Section key={tkt.id} title={tkt.events?.title ?? 'Mon billet'}>
          <TicketCard ticket={tkt} event={tkt.events ?? null} c={c} styles={styles}
            onTransfer={() => { setTransferTicket(tkt); setTransferEmail(tkt.transfer_email ?? ''); }}
            onCancelTransfer={async () => {
              try { await cancelTicketTransfer(tkt.id); await load(); }
              catch (err:any) { Alert.alert('Impossible d’annuler', err?.message ?? 'Réessaie plus tard.'); }
            }} />
        </Section>
      ))}
      <Pressable onPress={() => router.push('/tickets')} style={styles.groupBtn}>
        <Ionicons name="add-circle-outline" size={20} color={c.primary} />
        <View style={{flex:1}}><T variant="h3">Acheter des billets</T><T variant="caption" color={c.textMute}>Finales Mondiales Paris 2027</T></View>
        <Ionicons name="chevron-forward" size={18} color={c.textMute} />
      </Pressable>
      <Pressable onPress={() => router.push('/my-orders')} style={styles.groupBtn}>
        <Ionicons name="receipt-outline" size={20} color={c.primary} />
        <View style={{flex:1}}><T variant="h3">Mes commandes boutique</T><T variant="caption" color={c.textMute}>Paiements, articles et livraisons</T></View>
        <Ionicons name="chevron-forward" size={18} color={c.textMute} />
      </Pressable>
      <Modal visible={!!transferTicket} transparent animationType="slide" onRequestClose={() => setTransferTicket(null)}>
        <View style={styles.modalBackdrop}><View style={styles.modalCard}>
          <T variant="h2">Envoyer ce billet</T>
          <T variant="small" color={c.textDim} style={{marginTop:6}}>Le destinataire doit se connecter avec l’adresse email utilisée pour l’invitation.</T>
          <TextInput value={transferEmail} onChangeText={setTransferEmail} autoCapitalize="none" keyboardType="email-address" placeholder="email@exemple.com" placeholderTextColor={c.textMute} style={styles.input}/>
          <GButton label={transferBusy ? 'Un instant…' : 'Préparer l’invitation'} icon="mail" onPress={sendTransfer}/>
          <Pressable onPress={() => setTransferTicket(null)} style={{padding:14,alignItems:'center'}}><T variant="small" color={c.textDim}>Fermer</T></Pressable>
        </View></View>
      </Modal>
    </Screen>
  );
}

function TicketCard({
  ticket,
  event,
  c,
  styles,
  onTransfer,
  onCancelTransfer,
}: {
  ticket: Ticket;
  event: Ticket['events'];
  c: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
  onTransfer: () => void;
  onCancelTransfer: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const ev = event ?? { title: 'Juste Debout', venue: null, city: null, address: null };
  const isWeekend = (ticket.ticket_products?.access_days ?? 1) > 1;
  const scans = ticket.scan_history ?? [];
  const saturdayScan = scans.find(x => x.access_date === '2027-03-13');
  const sundayScan = scans.find(x => x.access_date === '2027-03-14');
  const multiStart = ticket.ticket_products?.access_start_date;
  const multiDays = ticket.ticket_products?.access_days ?? 1;
  const expectedDates = multiStart && multiDays > 2 ? Array.from({length:multiDays},(_,i)=>{const d=new Date(multiStart+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+i);return d.toISOString().slice(0,10);}) : [];
  const multiScannedCount = expectedDates.filter(d=>scans.some(x=>x.access_date===d)).length;
  const fullyScanned = expectedDates.length ? multiScannedCount===expectedDates.length : isWeekend && !!saturdayScan && !!sundayScan;
  const used = ticket.status === 'used' || fullyScanned;
  const cancelled = ticket.status === 'cancelled';
  const saturdayUsed = !expectedDates.length && isWeekend && !!saturdayScan && !sundayScan && !cancelled;
  const multiPartial = expectedDates.length>0 && multiScannedCount>0 && !fullyScanned && !cancelled;
  const accessStatus = cancelled ? t('wallet.cancelled') : used ? (isWeekend ? 'PASS ENTIÈREMENT UTILISÉ' : 'UTILISÉ') : multiPartial ? `${multiScannedCount}/${multiDays} JOURS UTILISÉS` : saturdayUsed ? 'DIMANCHE DISPONIBLE' : t('wallet.valid');
  const scanTime = (stamp:string) => new Date(stamp).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Paris'});
  const categoryCode = ticket.ticket_products?.code ?? '';
  const premiumBlack = categoryCode === 'black_card';
  const premiumVip = categoryCode.startsWith('vip_');
  const categoryColor = premiumBlack ? '#D7B66D' : premiumVip ? '#B5FA42' : '#303030';
  const categoryTextColor = premiumBlack || premiumVip ? '#101010' : '#FFFFFF';
  return (
    <Card style={{ alignItems: 'center' }}>
      <View style={styles.rowFull}>
        <T variant="h3" numberOfLines={1} style={{ flex: 1 }}>
          {ev.title}
        </T>
        <Tag
          label={accessStatus}
          color={used ? c.textMute : cancelled ? c.danger : c.primary}
        />
      </View>
      <T variant="small" color={c.textDim} style={{ alignSelf: 'flex-start', marginTop: 2 }}>
        {expectedDates.length > 0 ? 'Paris · plusieurs lieux selon les journées' : [ev.venue, ev.city].filter(Boolean).join(' · ')}
      </T>

      <View style={{alignSelf:'stretch',backgroundColor:categoryColor,paddingVertical:14,paddingHorizontal:14,borderRadius:10,marginTop:16}}>
        <T variant="label" color={categoryTextColor} style={{textAlign:'center'}}>{(ticket.ticket_products?.name ?? ticketTypeLabel(ticket.type,t)).toUpperCase()}</T>
      </View>
      <View style={styles.ticketDetails}>
        <DetailRow icon="ticket-outline" label="Accès" value={multiDays > 2 ? `${multiDays} jours · une entrée par jour, sortie définitive` : multiDays===2 ? 'Samedi et dimanche · 2 jours' : '1 jour · entrée unique, sortie définitive'} c={c} />
        <DetailRow icon="calendar-outline" label="Date" value={ticketDateLabel(ticket)} c={c} />
        {expectedDates.length>0 && scans.filter(x=>expectedDates.includes(x.access_date)).map(x=><DetailRow key={x.access_date} icon="checkmark-circle-outline" label={new Date(x.access_date+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})} value={`Entrée utilisée à ${scanTime(x.scanned_at)} · sortie définitive`} c={c} />)}
        {saturdayUsed && <DetailRow icon="checkmark-circle-outline" label="Samedi" value={`Entrée utilisée à ${scanTime(saturdayScan!.scanned_at)} · sortie définitive. Dimanche disponible.`} c={c} />}
        {!expectedDates.length && sundayScan && <DetailRow icon="checkmark-circle-outline" label="Dimanche" value={`Entrée utilisée à ${scanTime(sundayScan.scanned_at)} · sortie définitive`} c={c} />}
        {!isWeekend && scans.length>0 && <DetailRow icon="checkmark-circle-outline" label="Entrée" value={`Utilisée à ${scanTime(scans[0].scanned_at)} · sortie définitive`} c={c} />}
        {expectedDates.length > 0 ? <>
          <DetailRow icon="location-outline" label="Présélections · 11–12 mars" value="Autre salle à Paris · adresse communiquée ultérieurement" c={c} />
          <DetailRow icon="location-outline" label="Finales · 13–14 mars" value={[ev.venue, ev.address, ev.city].filter(Boolean).join(' · ') || 'Stade Pierre-de-Coubertin · Paris' } c={c} />
        </> : <DetailRow icon="location-outline" label="Lieu" value={[ev.venue, ev.address, ev.city].filter(Boolean).join(' · ') || 'À confirmer'} c={c} />}
        <DetailRow icon="person-outline" label="Détenteur" value={ticket.holder_name || ticket.holder_email || 'Acheteur du billet'} c={c} />
        <DetailRow icon="receipt-outline" label="Référence" value={ticket.id.slice(0, 8).toUpperCase()} c={c} />
      </View>

      <View style={[styles.qrBox, used && { opacity: 0.3 }]}>
        <QRCode value={ticket.qr_token} size={180} color="#0A0A0A" backgroundColor="#FFFFFF" />
        {used && (
          <View style={styles.usedStamp}>
            <Ionicons name="checkmark-circle" size={30} color={c.text} />
            <T variant="label" color={c.text}>
              {t('wallet.entered')}
            </T>
          </View>
        )}
      </View>

      {ticket.ticket_products?.code?.startsWith('family_') && ticket.order_item_id && (
        <Pressable onPress={() => router.push({pathname:'/family-tickets',params:{item:ticket.order_item_id!}})} style={styles.groupBtn}>
          <Ionicons name="people-outline" size={18} color={c.primary}/>
          <T variant="label">Attribuer les 2 adultes et 2 enfants</T>
        </Pressable>
      )}
      {ticket.ticket_products?.code === 'black_card' && (
        <Pressable onPress={() => router.push('/black-card')} style={styles.blackCardBtn}>
          <Ionicons name="diamond-outline" size={17} color="#D9C27A" />
          <T variant="label" color="#D9C27A">Voir ma Black Card</T>
        </Pressable>
      )}
            {ticket.status === 'active' && ticket.transfer_status !== 'pending' && (
        <Pressable onPress={onTransfer} style={styles.transferBtn}>
          <Ionicons name="paper-plane-outline" size={17} color={c.black} />
          <T variant="label" color={c.black}>Envoyer ce billet</T>
        </Pressable>
      )}
      {ticket.transfer_status === 'pending' && ticket.transfer_email ? (
        <View style={styles.pendingBox}>
          <View style={{flex:1}}>
            <T variant="caption" color={c.accent}>INVITATION EN ATTENTE</T>
            <T variant="small" color={c.text} style={{marginTop:3}}>{ticket.transfer_email}</T>
          </View>
          <Pressable onPress={onCancelTransfer} style={styles.cancelInvite}><T variant="caption" color={c.danger}>ANNULER</T></Pressable>
        </View>
      ) : ticket.transfer_status === 'accepted' ? (
        <T variant="caption" color={c.primary} style={{marginBottom:Space.sm}}>✓ BILLET RÉCUPÉRÉ PAR LE DESTINATAIRE</T>
      ) : null}
      <View style={styles.rowFull}>
        <T variant="caption" color={c.textMute}>
          {ticketTypeLabel(ticket.type, t)}
        </T>
        <T variant="caption" color={c.textMute}>
          {ticket.payment_method === 'free' ? t('wallet.payOnSite') : ticket.payment_method}
        </T>
      </View>
    </Card>
  );
}

function DetailRow({ icon, label, value, c }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; c: ThemeColors }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8 }}>
      <Ionicons name={icon} size={17} color={c.primary} style={{ marginTop: 1, marginRight: 10 }} />
      <View style={{ flex: 1 }}>
        <T variant="caption" color={c.textMute}>{label.toUpperCase()}</T>
        <T variant="small" color={c.text} style={{ marginTop: 2 }}>{value}</T>
      </View>
    </View>
  );
}

function ticketDateLabel(ticket: Ticket): string {
  const product = ticket.ticket_products;
  const event = ticket.events;
  const date = product?.access_date;
  if (product?.access_start_date && (product.access_days ?? 1)>2) {
    const start=new Date(product.access_start_date+'T12:00:00Z');
    const end=new Date(start);end.setUTCDate(start.getUTCDate()+product.access_days-1);
    return `${start.toLocaleDateString('fr-FR',{day:'numeric',month:'long'})} au ${end.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})}`;
  }
  if (date) return new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if (!event?.starts_on) return 'À confirmer';
  const start = new Date(event.starts_on + 'T12:00:00');
  const end = event.ends_on ? new Date(event.ends_on + 'T12:00:00') : null;
  if ((product?.access_days ?? 1) > 1 && end && event.ends_on !== event.starts_on) {
    return `${start.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} + ${end.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`;
  }
  return start.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function ticketTypeLabel(type: string, t: (k: string) => string): string {
  return (
    { spectator: t('profile.spectator'), participant: t('wallet.tParticipant'), day: t('wallet.tDay'), full: 'Full pass', vip: 'VIP' }[type] ??
    type
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    rowFull: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      alignSelf: 'stretch',
    },
    groupBtn:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:c.surface,borderWidth:1,borderColor:c.border,borderRadius:Radius.lg,padding:Space.lg,marginBottom:Space.lg},
    modalBackdrop:{flex:1,backgroundColor:'rgba(0,0,0,0.72)',justifyContent:'flex-end'},
    modalCard:{backgroundColor:c.surface,borderTopLeftRadius:Radius.xl,borderTopRightRadius:Radius.xl,padding:Space.xl},
    input:{backgroundColor:c.surface2,borderWidth:1,borderColor:c.border,borderRadius:Radius.md,paddingHorizontal:14,paddingVertical:13,color:c.text,fontSize:16,marginVertical:Space.lg},
    pendingBox:{alignSelf:'stretch',flexDirection:'row',alignItems:'center',backgroundColor:c.surface2,borderRadius:Radius.md,padding:Space.md,marginBottom:Space.md},
    cancelInvite:{paddingVertical:8,paddingHorizontal:10},
    blackCardBtn:{alignSelf:'stretch',backgroundColor:'#080808',borderWidth:1,borderColor:'#3A3421',borderRadius:Radius.pill,paddingVertical:13,paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginBottom:Space.sm},
    transferBtn:{alignSelf:'stretch',backgroundColor:c.primary,borderRadius:Radius.pill,paddingVertical:13,paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginBottom:Space.md},
    ticketDetails: {
      alignSelf: 'stretch',
      backgroundColor: c.surface2,
      borderRadius: Radius.md,
      paddingHorizontal: Space.md,
      marginTop: Space.lg,
    },
    qrBox: {
      backgroundColor: '#FFFFFF',
      padding: 16,
      borderRadius: Radius.lg,
      marginVertical: Space.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    usedStamp: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.7)',
    },
  });
