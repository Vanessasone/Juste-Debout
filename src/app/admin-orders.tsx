/**
 * Console STAFF — « Commandes reçues » en temps réel.
 * Chaque nouvelle commande (avec adresse de livraison) apparaît en direct.
 * Réservé au staff/admin (RLS + gate côté profil).
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Card, PageHeader, Screen, T, Tag } from '@/components/ui';
import { Radius, Space } from '@/constants/brand';
import { ThemeColors } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { getAllOrders, Order, setOrderStatus, subscribeOrders } from '@/lib/orders';
import { useColors } from '@/lib/theme';

const NEXT: Record<string, string | null> = {
  pending: 'paid',
  paid: 'shipped',
  shipped: 'delivered',
  delivered: null,
  cancelled: null,
};

function statusColor(c: ThemeColors, s: string): string {
  if (s === 'delivered') return c.accent;
  if (s === 'shipped') return c.accent;
  if (s === 'cancelled') return c.textMute;
  if (s === 'paid') return c.accent;
  return '#F5A623'; // pending — ambre (nouvelle commande à traiter)
}

export default function AdminOrders() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const t = useT();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    getAllOrders()
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      const unsub = subscribeOrders(load); // réception temps réel
      return unsub;
    }, [load]),
  );

  const advance = async (o: Order) => {
    const next = NEXT[o.status];
    if (!next) return;
    setBusy(o.id);
    try {
      await setOrderStatus(o.id, next);
      load();
    } finally {
      setBusy(null);
    }
  };

  const money = (o: Order) => `${(o.total / 100).toFixed(2)} ${o.currency === 'USD' ? '$' : '€'}`;

  return (
    <Screen>
      <PageHeader title={t('orders.received')} subtitle={t('orders.receivedSub')} />

      {loading ? (
        <ActivityIndicator color={c.accent} style={{ marginTop: Space.xl }} />
      ) : orders.length === 0 ? (
        <Card>
          <T variant="small" color={c.textDim}>
            {t('orders.empty')}
          </T>
        </Card>
      ) : (
        orders.map((o) => (
          <Card key={o.id} style={{ marginBottom: Space.md }}>
            <View style={styles.rowBetween}>
              <T variant="h3">{o.buyer?.full_name || o.buyer?.alias || o.full_name}</T>
              <Tag label={t(`orders.st.${o.status}`)} color={statusColor(c, o.status)} />
            </View>

            {/* Articles */}
            <View style={{ marginTop: Space.sm }}>
              {(o.items ?? []).map((it, i) => (
                <T key={i} variant="small" color={c.textDim}>
                  {it.quantity} × {it.name}
                </T>
              ))}
            </View>
            <T variant="label" color={c.accent} style={{ marginTop: 4 }}>
              {money(o)}
            </T>

            {/* Adresse de livraison */}
            <View style={styles.addr}>
              <Ionicons name="location" size={15} color={c.accent} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <T variant="small" color={c.text}>
                  {o.full_name}
                  {o.phone ? ` · ${o.phone}` : ''}
                </T>
                <T variant="small" color={c.textDim}>
                  {[o.address_line1, o.address_line2].filter(Boolean).join(', ')}
                </T>
                <T variant="small" color={c.textDim}>
                  {o.postal_code} {o.city} · {o.country}
                </T>
                {o.note ? (
                  <T variant="caption" color={c.textMute} style={{ marginTop: 2 }}>
                    « {o.note} »
                  </T>
                ) : null}
              </View>
            </View>

            <T variant="caption" color={c.textMute} style={{ marginTop: 6 }}>
              {new Date(o.created_at).toLocaleString()}
            </T>

            {NEXT[o.status] ? (
              <Pressable onPress={() => advance(o)} disabled={busy === o.id} style={styles.cta}>
                <T variant="label" color={c.black}>
                  {busy === o.id ? t('common.loading') : t(`orders.mark.${NEXT[o.status]}`)}
                </T>
              </Pressable>
            ) : null}
          </Card>
        ))
      )}
    </Screen>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    addr: {
      flexDirection: 'row',
      marginTop: Space.md,
      backgroundColor: c.surface,
      borderRadius: Radius.md,
      padding: 12,
    },
    cta: {
      backgroundColor: c.primary,
      borderRadius: Radius.pill,
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: Space.md,
    },
  });
