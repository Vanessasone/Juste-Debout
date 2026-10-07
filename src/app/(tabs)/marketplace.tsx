/**
 * Boutique — le shop officiel Juste Debout (JD ADN).
 * Catalogue stylé ; achat sur la boutique officielle (paiement natif via Stripe plus tard).
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';

import { AppHeader, Card, Screen, T } from '@/components/ui';
import { Palette, Radius, Space } from '@/constants/brand';
import { ThemeColors } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { formatPrice, getProducts, Product } from '@/lib/products';
import { useColors } from '@/lib/theme';
import { getMyBlackCard } from '@/lib/blackCard';

export default function Marketplace() {
  const c = useColors();
  const t = useT();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [blackDiscount, setBlackDiscount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      Promise.all([getProducts(), getMyBlackCard()]).then(([ps,bc])=>{setProducts(ps);setBlackDiscount(bc?.merchandise_discount_percent ?? 0);}).catch(() => setProducts([])).finally(() => setLoading(false));
    }, []),
  );

  return (
    <Screen>
      <AppHeader title={t('shop.title')} subtitle={t('shop.subtitle')} />

      {/* Bandeau shop */}
      <View style={styles.hero}>
        <View style={styles.heroAccent} />
        <T variant="caption" color={Palette.primary}>
          JD ADN · OFFICIEL
        </T>
        <T variant="title" color={c.white} style={{ fontSize: 30, marginTop: 4 }}>
          {t('shop.drop')}
        </T>
        <T variant="small" color={c.textDim} style={{ marginTop: 4 }}>
          {t('shop.dropSub')}
        </T>
      </View>

      {loading ? (
        <ActivityIndicator color={c.primary} style={{ marginTop: Space.xl }} />
      ) : products.length === 0 ? (
        <Card style={{ marginTop: Space.lg }}>
          <T variant="small" color={c.textDim}>
            {t('shop.soon')}
          </T>
        </Card>
      ) : (
        <View style={styles.grid}>
          {products.map((p) => (
            <Pressable
              key={p.id}
              style={styles.pcard}
              disabled={p.sold_out}
              onPress={() => router.push(`/checkout?productId=${p.id}` as never)}>
              <View style={styles.thumbWrap}>
                {p.image_url ? (
                  <Image source={{ uri: p.image_url }} style={[styles.thumb, p.sold_out && { opacity: 0.4 }]} resizeMode="cover" />
                ) : (
                  <View style={[styles.thumb, styles.thumbEmpty]}>
                    <Ionicons name="shirt" size={30} color={c.textMute} />
                  </View>
                )}
                {p.sold_out && (
                  <View style={styles.soldOut}>
                    <T variant="label" color={c.white} style={{ fontSize: 11, letterSpacing: 1 }}>
                      {t('shop.soldOut')}
                    </T>
                  </View>
                )}
              </View>
              <T variant="small" numberOfLines={2} style={{ marginTop: 8, minHeight: 34 }}>
                {p.name}
              </T>
              {blackDiscount > 0 ? <><T variant="caption" color={c.textMute} style={{textDecorationLine:'line-through',marginTop:2}}>{formatPrice(p)}</T><T variant="h3" color={c.primary}>{p.price==null?'':`${(p.price*(1-blackDiscount/100)).toFixed(2)} €`} · BLACK CARD</T></> : <T variant="h3" color={c.primary} style={{ marginTop: 2 }}>{formatPrice(p)}</T>}
            </Pressable>
          ))}
        </View>
      )}

      <T variant="caption" color={c.textMute} style={{ marginTop: Space.lg, textAlign: 'center' }}>
        {t('shop.footer')}
      </T>
    </Screen>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    hero: {
      backgroundColor: '#0E0E0E',
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: Radius.xl,
      padding: Space.xl,
      overflow: 'hidden',
      marginBottom: Space.lg,
    },
    heroAccent: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 5,
      backgroundColor: Palette.sideFuchsia,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    pcard: { width: '48%', marginBottom: Space.lg },
    thumbWrap: { position: 'relative', borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: c.surface2 },
    thumb: { width: '100%', aspectRatio: 1 },
    thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
    soldOut: {
      position: 'absolute',
      top: 8,
      left: 8,
      backgroundColor: 'rgba(0,0,0,0.75)',
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 6,
    },
  });
