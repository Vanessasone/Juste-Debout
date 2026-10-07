/**
 * Portefeuille — les billets de l'utilisateur avec leur QR d'entrée.
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Card, GButton, PageHeader, Screen, Section, T, Tag } from '@/components/ui';
import { Radius, Space } from '@/constants/brand';
import { ThemeColors } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { EventRow, getEvents } from '@/lib/jdlive';
import { getMyTickets, Ticket } from '@/lib/tickets';
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
              <TicketCard ticket={tkt} event={e} c={c} styles={styles} />
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
}: {
  ticket: Ticket;
  event: EventRow;
  c: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
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
