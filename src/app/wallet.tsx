/**
 * Portefeuille — les billets de l'utilisateur avec leur QR d'entrée.
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Card, GButton, PageHeader, Screen, Section, T, Tag } from '@/components/ui';
import { Radius, Space } from '@/constants/brand';
import { ThemeColors } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { EventRow, getEvents } from '@/lib/jdlive';
import { cancelTicketTransfer, getMyTickets, prepareTicketTransfer, Ticket } from '@/lib/tickets';
import { useColors } from '@/lib/theme';

export default function Wallet() {
  const c = useColors();
  const t = useT();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [transferTicket, setTransferTicket] = useState<Ticket | null>(null);
  const [transferEmail, setTransferEmail] = useState('');
  const [transferBusy, setTransferBusy] = useState(false);

  const load = async () => {
    try {
      const [ev, tk] = await Promise.all([getEvents(), getMyTickets()]);
      setEvents(ev);
      setTickets(tk);
    } catch (e: any) {
      setError(e?.message ?? t('reg.loadFail'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const ticketFor = (eventId: string) => tickets.find((t) => t.event_id === eventId);

  const sendTransfer = async () => {
    if (!transferTicket || !transferEmail.trim()) return;
    setTransferBusy(true);
    try {
      await prepareTicketTransfer(transferTicket.id, transferEmail);
      Alert.alert('Invitation préparée', `Ce billet est maintenant réservé à ${transferEmail.trim()}. L'envoi automatique par email sera activé dès que le domaine Juste Debout sera validé.`);
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

      {events.map((e) => {
        const tkt = ticketFor(e.id);
        return (
          <Section key={e.id} title={e.city ?? e.title}>
            {tkt ? (
              <TicketCard ticket={tkt} event={e} c={c} styles={styles}
                onTransfer={() => { setTransferTicket(tkt); setTransferEmail(tkt.transfer_email ?? ''); }}
                onCancelTransfer={async () => {
                  try { await cancelTicketTransfer(tkt.id); await load(); }
                  catch (err:any) { Alert.alert('Impossible d’annuler', err?.message ?? 'Réessaie plus tard.'); }
                }} />
            ) : e.tickets_open ? (
              <Card>
                <T variant="h3">{e.title}</T>
                <T variant="small" color={c.textDim} style={{ marginTop: 2, marginBottom: Space.md }}>
                  {[e.venue, e.city].filter(Boolean).join(' · ')}
                </T>
                <GButton
                  label="Voir les billets"
                  icon="ticket"
                  onPress={() => router.push('/tickets')}
                />
                <T variant="caption" color={c.textMute} style={{ textAlign: 'center', marginTop: Space.sm }}>
                  Paiement sécurisé par Stripe · QR émis après confirmation du paiement.
                </T>
              </Card>
            ) : (
              <Card>
                <T variant="h3">{e.title}</T>
                <T variant="small" color={c.textDim} style={{ marginTop: 2, marginBottom: Space.md }}>
                  {[e.venue, e.city].filter(Boolean).join(' · ')}
                </T>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="time-outline" size={16} color={c.accent} />
                  <T variant="small" color={c.accent}>
                    {t('wallet.ticketsSoon')}
                  </T>
                </View>
              </Card>
            )}
          </Section>
        );
      })}
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
  event: EventRow;
  c: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
  onTransfer: () => void;
  onCancelTransfer: () => void;
}) {
  const t = useT();
  const used = ticket.status === 'used';
  const cancelled = ticket.status === 'cancelled';
  return (
    <Card style={{ alignItems: 'center' }}>
      <View style={styles.rowFull}>
        <T variant="h3" numberOfLines={1} style={{ flex: 1 }}>
          {event.title}
        </T>
        <Tag
          label={used ? t('wallet.used') : cancelled ? t('wallet.cancelled') : t('wallet.valid')}
          color={used ? c.textMute : cancelled ? c.danger : c.primary}
        />
      </View>
      <T variant="small" color={c.textDim} style={{ alignSelf: 'flex-start', marginTop: 2 }}>
        {[event.venue, event.city].filter(Boolean).join(' · ')}
      </T>

      <View style={styles.ticketDetails}>
        <DetailRow icon="ticket-outline" label="Catégorie" value={ticket.ticket_products?.name ?? ticketTypeLabel(ticket.type, t)} c={c} />
        <DetailRow icon="calendar-outline" label="Date" value={ticketDateLabel(ticket)} c={c} />
        <DetailRow icon="location-outline" label="Lieu" value={[event.venue, event.address, event.city].filter(Boolean).join(' · ') || 'À confirmer'} c={c} />
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
