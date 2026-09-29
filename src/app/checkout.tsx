/**
 * Commande d'un produit de la boutique — quantité + adresse de livraison.
 * Paiement (Stripe) à venir : la commande est enregistrée en `pending` et reçue
 * en temps réel par le staff (console « Commandes reçues »).
 */
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Card, PageHeader, Screen, Section, T } from '@/components/ui';
import { Radius, Space } from '@/constants/brand';
import { ThemeColors } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { createOrder } from '@/lib/orders';
import { getProducts, Product } from '@/lib/products';
import { getMyProfile } from '@/lib/profile';
import { useColors } from '@/lib/theme';

export default function Checkout() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const t = useT();
  const router = useRouter();
  const { productId } = useLocalSearchParams<{ productId?: string }>();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [addr1, setAddr1] = useState('');
  const [addr2, setAddr2] = useState('');
  const [postal, setPostal] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('France');
  const [note, setNote] = useState('');

  useEffect(() => {
    getProducts()
      .then((list) => setProduct(list.find((p) => p.id === productId) ?? null))
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
    getMyProfile()
      .then((p) => p?.full_name && setFullName(p.full_name))
      .catch(() => {});
  }, [productId]);

  const unitCents = product?.price != null ? Math.round(product.price * 100) : 0;
  const totalCents = unitCents * qty;
  const cur = product?.currency ?? 'EUR';
  const money = (cents: number) => `${(cents / 100).toFixed(2)} ${cur === 'USD' ? '$' : '€'}`;

  const canOrder =
    !!product &&
    fullName.trim().length > 1 &&
    addr1.trim().length > 2 &&
    postal.trim().length > 1 &&
    city.trim().length > 1 &&
    country.trim().length > 1 &&
    !saving;

  const submit = async () => {
    if (!product) return;
    setSaving(true);
    setError(null);
    try {
      await createOrder(
        {
          full_name: fullName,
          phone,
          address_line1: addr1,
          address_line2: addr2,
          postal_code: postal,
          city,
          country,
          note,
        },
        [{ product_id: product.id, name: product.name, unit_price: unitCents, quantity: qty }],
        cur,
      );
      setDone(true);
    } catch (e: any) {
      setError(e?.message ?? t('checkout.fail'));
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <PageHeader title={t('checkout.title')} subtitle={t('shop.drop')} />
        <ActivityIndicator color={c.accent} style={{ marginTop: Space.xl }} />
      </Screen>
    );
  }

  if (done) {
    return (
      <Screen>
        <PageHeader title={t('checkout.title')} subtitle={t('shop.drop')} />
        <Card style={{ alignItems: 'center', paddingVertical: Space.xl }}>
          <Ionicons name="checkmark-circle" size={54} color={c.primary} />
          <T variant="h3" style={{ marginTop: Space.md, textAlign: 'center' }}>
            {t('checkout.doneTitle')}
          </T>
          <T variant="small" color={c.textDim} style={{ textAlign: 'center', marginTop: Space.sm }}>
            {t('checkout.doneBody')}
          </T>
          <Pressable onPress={() => router.back()} style={[styles.cta, { marginTop: Space.xl, alignSelf: 'stretch' }]}>
            <T variant="label" color={c.black} style={{ fontSize: 15 }}>
              {t('common.done')}
            </T>
          </Pressable>
        </Card>
      </Screen>
    );
  }

  if (!product) {
    return (
      <Screen>
        <PageHeader title={t('checkout.title')} subtitle={t('shop.drop')} />
        <Card>
          <T variant="small" color={c.textDim}>
            {t('checkout.notFound')}
          </T>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader title={t('checkout.title')} subtitle={product.name} />

      <Card style={{ marginBottom: Space.md }}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <T variant="h3">{product.name}</T>
            <T variant="small" color={c.textDim} style={{ marginTop: 2 }}>
              {money(unitCents)}
            </T>
          </View>
          <View style={styles.qty}>
            <Pressable onPress={() => setQty((q) => Math.max(1, q - 1))} hitSlop={8}>
              <Ionicons name="remove-circle" size={26} color={c.accent} />
            </Pressable>
            <T variant="h3" style={{ minWidth: 26, textAlign: 'center' }}>
              {qty}
            </T>
            <Pressable onPress={() => setQty((q) => q + 1)} hitSlop={8}>
              <Ionicons name="add-circle" size={26} color={c.accent} />
            </Pressable>
          </View>
        </View>
      </Card>

      <Section title={t('checkout.address')}>
        <Field label={t('checkout.fullName')}>
          <Input value={fullName} onChangeText={setFullName} placeholder="Vanessa Sone" autoCapitalize="words" />
        </Field>
        <Field label={t('checkout.phone')}>
          <Input value={phone} onChangeText={setPhone} placeholder="+33 6 12 34 56 78" keyboardType="phone-pad" />
        </Field>
        <Field label={t('checkout.addr1')}>
          <Input value={addr1} onChangeText={setAddr1} placeholder="12 rue de la Danse" />
        </Field>
        <Field label={t('checkout.addr2')}>
          <Input value={addr2} onChangeText={setAddr2} placeholder={t('checkout.addr2Ph')} />
        </Field>
        <View style={{ flexDirection: 'row', gap: Space.md }}>
          <Field label={t('checkout.postal')} style={{ flex: 1 }}>
            <Input value={postal} onChangeText={setPostal} placeholder="75016" keyboardType="numbers-and-punctuation" />
          </Field>
          <Field label={t('checkout.city')} style={{ flex: 2 }}>
            <Input value={city} onChangeText={setCity} placeholder="Paris" />
          </Field>
        </View>
        <Field label={t('checkout.country')}>
          <Input value={country} onChangeText={setCountry} placeholder="France" />
        </Field>
        <Field label={t('checkout.note')}>
          <Input value={note} onChangeText={setNote} placeholder={t('checkout.notePh')} />
        </Field>
      </Section>

      {error && (
        <T variant="small" color={c.danger} style={{ marginBottom: Space.sm }}>
          {error}
        </T>
      )}

      <View style={styles.totalRow}>
        <T variant="label" color={c.textDim}>
          {t('checkout.total')}
        </T>
        <T variant="title" color={c.accent} style={{ fontSize: 24 }}>
          {money(totalCents)}
        </T>
      </View>

      <Pressable onPress={submit} disabled={!canOrder} style={[styles.cta, !canOrder && { opacity: 0.4 }]}>
        {saving ? (
          <ActivityIndicator color={c.black} />
        ) : (
          <T variant="label" color={c.black} style={{ fontSize: 15 }}>
            {t('checkout.place')}
          </T>
        )}
      </Pressable>
      <T variant="caption" color={c.textMute} style={{ textAlign: 'center', marginTop: Space.sm }}>
        {t('checkout.payNote')}
      </T>
    </Screen>
  );
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: any }) {
  const c = useColors();
  return (
    <View style={[{ marginBottom: Space.md }, style]}>
      <T variant="caption" color={c.textMute} style={{ marginBottom: 6 }}>
        {label}
      </T>
      {children}
    </View>
  );
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return <TextInput {...props} placeholderTextColor={c.textMute} style={styles.input} />;
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    qty: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Space.md },
    input: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: Radius.md,
      paddingHorizontal: 14,
      paddingVertical: 13,
      color: c.text,
      fontSize: 15,
    },
    cta: {
      backgroundColor: c.primary,
      borderRadius: Radius.pill,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 52,
    },
  });
