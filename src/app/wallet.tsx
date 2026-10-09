import { useCustomerText, customerText } from '@/lib/customerText';
import { useI18n } from '@/lib/i18n';
import { ticketProductText } from '@/lib/ticketProductText';
/**
 * Portefeuille — les billets de l'utilisateur avec leur QR d'entrée.
 */
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Card, GButton, PageHeader, Screen, Section, T, Tag } from '@/components/ui';
import { Radius, Space } from '@/constants/brand';
import { ThemeColors } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { cancelTicketTransfer, getMyTickets, prepareTicketTransfer, Ticket } from '@/lib/tickets';
import { serverRequest } from '@/lib/serverRequest';
import { supabase } from '@/lib/supabase';
import { claimGuestTickets, resendMyTicketConfirmations } from '@/lib/guestTickets';
import { useColors } from '@/lib/theme';

export default function Wallet() {
  const c = useColors();
  const t = useT();
  const ct = useCustomerText();
  const { locale } = useI18n();
  const router = useRouter();
  const { payment } = useLocalSearchParams<{ payment?: string }>();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [transferTicket, setTransferTicket] = useState<Ticket | null>(null);
  const [transferEmail, setTransferEmail] = useState('');
  const [transferBusy, setTransferBusy] = useState(false);

  const [accountEmail, setAccountEmail] = useState('');
  const [resendBusy, setResendBusy] = useState(false);
  const [recoveryInfo, setRecoveryInfo] = useState('');
  const loadGeneration = useRef(0);
  const load = async () => {
    const generation = ++loadGeneration.current;
    setLoading(true); setError(null); setTickets([]); setAccountEmail('');
    try {
      const {data:{user},error:authError} = await serverRequest(() => supabase.auth.getUser());
      if (authError) throw authError;
      if (!user) { router.replace({pathname:'/login',params:{recover:'1'}}); return; }
      await claimGuestTickets();
      const tk = await serverRequest(() => getMyTickets());
      const {data:{user:current}} = await serverRequest(() => supabase.auth.getUser());
      if (generation !== loadGeneration.current || current?.id !== user.id) return;
      setAccountEmail(user.email ?? ''); setTickets(tk);
    } catch {
      if (generation === loadGeneration.current) setError(ct('recoveryHelp'));
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  };
  useFocusEffect(useCallback(() => {
    void load();
    return () => { loadGeneration.current++; };
  }, []));
  const resend = async () => {
    if (resendBusy) return;
    setResendBusy(true); setRecoveryInfo('');
    try {
      const result = await resendMyTicketConfirmations();
      setRecoveryInfo(ct(result.queued > 0 ? 'confirmationQueued' : result.cooldown ? 'confirmationCooldown' : 'recoveryHelp'));
    } catch { setRecoveryInfo(ct('retry')); }
    finally { setResendBusy(false); }
  };


  const sendTransfer = async () => {
    if (!transferTicket || !transferEmail.trim()) return;
    setTransferBusy(true);
    try {
      await prepareTicketTransfer(transferTicket.id, transferEmail);
      Alert.alert(ct('inviteSent'), ct('inviteSentBody', {email:transferEmail.trim()}));
      setTransferTicket(null); setTransferEmail('');
      await load();
    } catch (e: any) {
      Alert.alert(ct('inviteError'), ct('retry'));
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

      <Card style={{marginBottom:Space.md}}>
        {!!accountEmail && <><T variant="small">{ct('connectedEmail',{email:accountEmail})}</T><Pressable accessibilityRole="button" onPress={async()=>{loadGeneration.current++;setTickets([]);setAccountEmail('');await supabase.auth.signOut({scope:'local'});router.replace({pathname:'/login',params:{recover:'1'}});}} style={{paddingVertical:10}}><T variant="small" color={c.primary}>{ct('switchAccount')}</T></Pressable></>}
        <T variant="small" color={c.textDim} style={{marginTop:6}}>{ct('recoveryHelp')}</T>
        <Pressable accessibilityRole="button" disabled={resendBusy} onPress={()=>void resend()} style={{paddingVertical:14}}>
          <T color={c.primary}>{resendBusy ? ct('wait') : ct('resendPurchaseConfirmation')}</T>
        </Pressable>
        {!!recoveryInfo && <T variant="small" color={c.textDim}>{recoveryInfo}</T>}
      </Card>
      {payment === 'success'  && <Card style={{ marginBottom: Space.md }}>
        <T variant="h3" color={c.primary}>{ct('paymentReturn')}</T>
        <T variant="small" color={c.textDim} style={{ marginTop: 6 }}>
          {ct('walletPending')}
        </T>
        <Pressable accessibilityRole="button" onPress={() => { setLoading(true); void load(); }} style={{ backgroundColor: '#B5FA42', padding: 12, borderRadius: 12, marginTop: 12, alignItems: 'center' }}>
          <T variant="label" color="#101010">{ct('refreshTickets')}</T>
        </Pressable>
      </Card>}

      {tickets.filter((x) => x.status === 'active').length > 1 && <Card style={{marginBottom:Space.md}}><T variant="h3">{ct('allQr')}</T><T variant="small" color={c.textDim} style={{marginTop:6}}>{ct('allQrBody')}</T></Card>}
      {tickets.filter((x) => x.status === 'active').length > 1 && (
        <Pressable onPress={() => router.push('/manage-tickets')} style={styles.groupBtn}>
          <Ionicons name="people-outline" size={19} color={c.text} />
          <View style={{flex:1}}>
            <T variant="h3">{ct('manage')}</T>
            <T variant="caption" color={c.textMute}>{ct('importList')}</T>
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
          <T variant="h3">{ct('noTickets')}</T>
          <T variant="small" color={c.textDim} style={{marginTop:8,marginBottom:Space.md}}>{ct('recoveryHelp')}</T>
          <GButton label={ct('refreshTickets')} onPress={()=>void load()} />
          <Pressable onPress={()=>router.push({pathname:'/login',params:{recover:'1'}})} style={{paddingVertical:14}}><T color={c.primary}>{ct('backLogin')}</T></Pressable>
          <GButton label={ct('boxoffice')} icon="ticket" onPress={() => router.push('/billetterie')} />
        </Card>
      ) : tickets.map((tkt) => (
        <Section key={tkt.id} title={tkt.events?.title ?? ct('myTicket')}>
          <TicketCard ticket={tkt} event={tkt.events ?? null} c={c} styles={styles}
            onTransfer={() => { setTransferTicket(tkt); setTransferEmail(tkt.transfer_email ?? ''); }}
            onCancelTransfer={async () => {
              try { await cancelTicketTransfer(tkt.id); await load(); }
              catch (err:any) { Alert.alert(ct('cancelError'), ct('retry')); }
            }} />
        </Section>
      ))}
      <Pressable onPress={() => router.push('/billetterie')} style={styles.groupBtn}>
        <Ionicons name="add-circle-outline" size={20} color={c.primary} />
        <View style={{flex:1}}><T variant="h3">{ct('buyTickets')}</T><T variant="caption" color={c.textMute}>{ct('finals')}</T></View>
        <Ionicons name="chevron-forward" size={18} color={c.textMute} />
      </Pressable>
      <Pressable onPress={() => router.push('/my-orders')} style={styles.groupBtn}>
        <Ionicons name="receipt-outline" size={20} color={c.primary} />
        <View style={{flex:1}}><T variant="h3">{ct('myOrders')}</T><T variant="caption" color={c.textMute}>{ct('orderSubtitle')}</T></View>
        <Ionicons name="chevron-forward" size={18} color={c.textMute} />
      </Pressable>
      <Modal visible={!!transferTicket} transparent animationType="slide" onRequestClose={() => setTransferTicket(null)}>
        <View style={styles.modalBackdrop}><View style={styles.modalCard}>
          <T variant="h2">{ct('sendTicket')}</T>
          <T variant="small" color={c.textDim} style={{marginTop:6}}>{ct('inviteRecipient')}</T>
          <TextInput value={transferEmail} onChangeText={setTransferEmail} autoCapitalize="none" keyboardType="email-address" placeholder="email@exemple.com" placeholderTextColor={c.textMute} style={styles.input}/>
          <GButton label={transferBusy ? ct('wait') : ct('prepareInvite')} icon="mail" onPress={sendTransfer}/>
          <Pressable onPress={() => setTransferTicket(null)} style={{padding:14,alignItems:'center'}}><T variant="small" color={c.textDim}>{ct('close')}</T></Pressable>
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
  const ct = useCustomerText();
  const { locale } = useI18n();
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
  const categoryCode = ticket.ticket_products?.code ?? '';
  const premiumBlack = categoryCode === 'black_card';
  const used = ticket.status === 'used' || (!premiumBlack && fullyScanned);
  const cancelled = ticket.status === 'cancelled' || ticket.status === 'refunded';
  const saturdayUsed = !expectedDates.length && isWeekend && !!saturdayScan && !sundayScan && !cancelled;
  const multiPartial = expectedDates.length>0 && multiScannedCount>0 && !fullyScanned && !cancelled;
  const accessStatus = cancelled ? t('wallet.cancelled') : used ? (isWeekend ? ct('fullyUsed') : ct('used')) : multiPartial ? ct('daysUsed', {n:multiScannedCount, days:multiDays}) : saturdayUsed ? ct('sundayAvailable') : t('wallet.valid');
  const scanTime = (stamp:string) => new Date(stamp).toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Paris'});
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
        {expectedDates.length > 0 ? ct('multipleVenues') : [ev.venue, ev.city].filter(Boolean).join(' · ')}
      </T>

      <View style={{alignSelf:'stretch',backgroundColor:categoryColor,paddingVertical:14,paddingHorizontal:14,borderRadius:10,marginTop:16}}>
        <T variant="label" color={categoryTextColor} style={{textAlign:'center'}}>{ticketProductText(categoryCode, locale, {name: ticket.ticket_products?.name ?? ticketTypeLabel(ticket.type,t)}).name.toUpperCase()}</T>
      </View>
      <View style={styles.ticketDetails}>
        <DetailRow icon="ticket-outline" label={ct('accessLabel')} value={multiDays > 2 ? ct('accessMulti', {n:multiDays}) : multiDays===2 ? ct('accessTwo') : ct('accessOne')} c={c} />
        <DetailRow icon="calendar-outline" label={ct('dateLabel')} value={ticketDateLabel(ticket, locale)} c={c} />
        {expectedDates.length>0 && scans.filter(x=>expectedDates.includes(x.access_date)).map(x=><DetailRow key={x.access_date} icon="checkmark-circle-outline" label={new Date(x.access_date+'T12:00:00').toLocaleDateString(locale,{weekday:'long',day:'numeric',month:'long'})} value={ct('scannedAt', {time:scanTime(x.scanned_at)})} c={c} />)}
        {saturdayUsed && <DetailRow icon="checkmark-circle-outline" label={new Date('2027-03-13T12:00:00Z').toLocaleDateString(locale,{weekday:'long'})} value={`${ct('scannedAt', {time:scanTime(saturdayScan!.scanned_at)})} · ${ct('sundayAvailable')}`} c={c} />}
        {!expectedDates.length && sundayScan && <DetailRow icon="checkmark-circle-outline" label={new Date('2027-03-14T12:00:00Z').toLocaleDateString(locale,{weekday:'long'})} value={ct('scannedAt', {time:scanTime(sundayScan.scanned_at)})} c={c} />}
        {!isWeekend && scans.length>0 && <DetailRow icon="checkmark-circle-outline" label={ct('accessLabel')} value={ct('scannedAt', {time:scanTime(scans[0].scanned_at)})} c={c} />}
        {expectedDates.length > 0 ? <>
          <DetailRow icon="location-outline" label={ct('presels')} value={ct('preselVenue')} c={c} />
          <DetailRow icon="location-outline" label={ct('finalDays')} value={[ev.venue, ev.address, ev.city].filter(Boolean).join(' · ') || 'Stade Pierre-de-Coubertin · Paris' } c={c} />
        </> : <DetailRow icon="location-outline" label={ct('location')} value={[ev.venue, ev.address, ev.city].filter(Boolean).join(' · ') || ct('unknownVenue')} c={c} />}
        <DetailRow icon="person-outline" label={ct('holder')} value={ticket.holder_name || ticket.holder_email || ct('buyer')} c={c} />
        <DetailRow icon="receipt-outline" label={ct('reference')} value={ticket.id.slice(0, 8).toUpperCase()} c={c} />
      </View>

      {premiumBlack && <T variant="small" color={c.textDim} style={{alignSelf:'stretch',marginTop:16}}>{ct('blackCalendar')}</T>}
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
          <T variant="label">{ct('assignFamily')}</T>
        </Pressable>
      )}
      {ticket.ticket_products?.code === 'black_card' && (
        <Pressable onPress={() => router.push('/black-card')} style={styles.blackCardBtn}>
          <Ionicons name="diamond-outline" size={17} color="#D9C27A" />
          <T variant="label" color="#D9C27A">{ct('viewBlack')}</T>
        </Pressable>
      )}
            {ticket.status === 'active' && ticket.transfer_status !== 'pending' && (
        <Pressable onPress={onTransfer} style={styles.transferBtn}>
          <Ionicons name="paper-plane-outline" size={17} color={c.black} />
          <T variant="label" color={c.black}>{ct('sendTicket')}</T>
        </Pressable>
      )}
      {ticket.transfer_status === 'pending' && ticket.transfer_email ? (
        <View style={styles.pendingBox}>
          <View style={{flex:1}}>
            <T variant="caption" color={c.accent}>{ct('invitePending')}</T>
            <T variant="small" color={c.text} style={{marginTop:3}}>{ticket.transfer_email}</T>
          </View>
          <Pressable onPress={onCancelTransfer} style={styles.cancelInvite}><T variant="caption" color={c.danger}>{ct('cancel')}</T></Pressable>
        </View>
      ) : ticket.transfer_status === 'accepted' ? (
        <T variant="caption" color={c.primary} style={{marginBottom:Space.sm}}>{ct('inviteAccepted')}</T>
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

function ticketDateLabel(ticket: Ticket, locale: string): string {
  const product = ticket.ticket_products;
  const event = ticket.events;
  const date = product?.access_date;
  if (product?.access_start_date && (product.access_days ?? 1)>2) {
    const start=new Date(product.access_start_date+'T12:00:00Z');
    const end=new Date(start);end.setUTCDate(start.getUTCDate()+product.access_days-1);
    return `${start.toLocaleDateString(locale,{day:'numeric',month:'long'})} – ${end.toLocaleDateString(locale,{day:'numeric',month:'long',year:'numeric'})}`;
  }
  if (date) return new Date(date + 'T12:00:00').toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if (!event?.starts_on) return customerText(locale, 'unknownVenue');
  const start = new Date(event.starts_on + 'T12:00:00');
  const end = event.ends_on ? new Date(event.ends_on + 'T12:00:00') : null;
  if ((product?.access_days ?? 1) > 1 && end && event.ends_on !== event.starts_on) {
    return `${start.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })} + ${end.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`;
  }
  return start.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
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
