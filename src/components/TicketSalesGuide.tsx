import { createElement, useState } from 'react';
import { Linking, Modal, Platform, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Section, T } from '@/components/ui';
import { useCustomerText } from '@/lib/customerText';
import { useColors } from '@/lib/theme';
import { TicketGroup } from '@/lib/ticketSalesPresentation';

// Official video already listed in the application's replay catalogue.
const OFFICIAL_VIDEO = '4KYmQAUPcqo';

export function TicketVideoPreview() {
  const ct = useCustomerText();
  const [open, setOpen] = useState(false);
  const watch = () => {
    if (Platform.OS === 'web') setOpen(true);
    else void Linking.openURL(`https://www.youtube.com/watch?v=${OFFICIAL_VIDEO}`);
  };
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={ct('salesVideoPlay')} onPress={watch} style={{ backgroundColor: '#161A1D', borderRadius: 18, marginTop: 16, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      <Ionicons name="play-circle" size={48} color="#B5FC44" />
      <View style={{ flex: 1 }}><T variant="h3" color="#FFFFFF">{ct('salesVideoPlay')}</T><T variant="small" color="#E5E5E5" style={{ marginTop: 6 }}>{ct('salesVideoBody')}</T></View>
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', padding: 16 }}>
        <View style={{ maxWidth: 800, width: '100%', alignSelf: 'center' }}>
          <T variant="h3" color="#FFFFFF" style={{ marginBottom: 12 }}>{ct('salesVideoBody')}</T>
          <View style={{ width: '100%', aspectRatio: 16 / 9 }}>
            {open && Platform.OS === 'web' && createElement('iframe', { src: `https://www.youtube-nocookie.com/embed/${OFFICIAL_VIDEO}?start=0&end=60&rel=0`, title: ct('salesVideoPlay'), allow: 'encrypted-media; picture-in-picture; fullscreen', allowFullScreen: true, referrerPolicy: 'strict-origin-when-cross-origin', style: { width: '100%', height: '100%', border: 0 } })}
          </View>
          <Pressable accessibilityRole="button" onPress={() => { void Linking.openURL(`https://www.youtube.com/watch?v=${OFFICIAL_VIDEO}`); }} style={{ paddingVertical: 16 }}><T variant="small" color="#FFFFFF">{ct('salesVideoFull')} ↗</T></Pressable>
          <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={{ backgroundColor: '#B5FC44', borderRadius: 24, padding: 16, alignItems: 'center' }}><T variant="label" color="#000000">{ct('close')}</T></Pressable>
        </View>
      </View>
    </Modal>
  </>;
}

export function TicketComparison({ prices, onChoose }: {
  prices: { standard: number | null; vip: number | null; black: number | null };
  onChoose: (group: TicketGroup) => void;
}) {
  const ct = useCustomerText();
  const c = useColors();
  const options = [
    { group: 'standard' as const, name: 'salesStandard' as const, benefit: 'compareStandard' as const, price: prices.standard },
    { group: 'vip' as const, name: 'salesVip' as const, benefit: 'compareVip' as const, price: prices.vip },
    { group: 'black' as const, name: 'salesBlack' as const, benefit: 'compareBlack' as const, price: prices.black },
  ];
  return <Section title={ct('compareTitle')} titleStyle={{ fontSize: 36, lineHeight: 42, flexShrink: 1 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {options.map(option => <Card key={option.group} style={{ flexGrow: 1, flexBasis: 280, minWidth: 0, backgroundColor: option.group === 'black' ? '#161A1D' : c.surface, borderWidth: 2, borderColor: option.group === 'black' ? '#D9C27A' : c.border }}>
        <T variant="h2" color={option.group === 'black' ? '#D9C27A' : c.text} style={{ fontSize: 36 }}>{ct(option.name)}</T>
        {option.price !== null && <T variant="h3" color={option.group === 'black' ? '#D9C27A' : c.accent} style={{ marginTop: 12, fontSize: 28 }}>{ct(option.group === 'black' ? 'comparePrice' : 'compareFrom', {price: (option.price / 100).toFixed(0)})}</T>}
        <T variant="small" color={option.group === 'black' ? '#E5E5E5' : c.textDim} style={{ marginTop: 12, lineHeight: 25, fontSize: 17 }}>{ct(option.benefit)}</T>
        {option.group !== 'standard' && (option.group === 'vip' ? ['vipBenefit1', 'vipBenefit2', 'vipBenefit3', 'vipBenefit4'] as const : ['benefit1', 'benefit2', 'benefit3', 'benefit5'] as const).map(key => <View key={key} style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}><Ionicons name="checkmark-circle" size={20} color={option.group === 'black' ? '#D9C27A' : c.accent} /><T variant="small" color={option.group === 'black' ? '#FFFFFF' : c.text} style={{ flex: 1, lineHeight: 22 }}>{ct(key)}</T></View>)}
        <Pressable accessibilityRole="button" accessibilityLabel={`${ct('compareDiscover')} ${ct(option.name)}`} onPress={() => onChoose(option.group)} style={{ paddingVertical: 16, paddingHorizontal: 16, borderRadius: 30, backgroundColor: option.group === 'black' ? '#D9C27A' : '#B5FC44', marginTop: 24, alignItems: 'center' }}>
          <T variant="label" color="#000000">{ct('compareDiscover')} →</T>
        </Pressable>
      </Card>)}
    </View>
  </Section>;
}

export function TicketFAQ() {
  const ct = useCustomerText();
  const c = useColors();
  const [open, setOpen] = useState<number | null>(null);
  const questions = [
    { question: 'faqAccountQuestion' as const, answer: 'faqAccountAnswer' as const },
    { question: 'faqTicketsQuestion' as const, answer: 'faqTicketsAnswer' as const },
    { question: 'faqDatesQuestion' as const, answer: 'faqDatesAnswer' as const },
    { question: 'faqFamilyQuestion' as const, answer: 'faqFamilyAnswer' as const },
  ];
  return <Section title={ct('faqTitle')} titleStyle={{ fontSize: 36, lineHeight: 42, flexShrink: 1 }}>
    {questions.map((item, index) => <Card key={item.question} style={{ marginBottom: 10 }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open === index }} onPress={() => setOpen(current => current === index ? null : index)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
        <T variant="small" style={{ flex: 1, fontWeight: '700' }}>{ct(item.question)}</T>
        <Ionicons name={open === index ? 'remove' : 'add'} color={c.accent} size={22} />
      </Pressable>
      {open === index && <T variant="small" color={c.textDim} style={{ marginTop: 12, lineHeight: 23 }}>{ct(item.answer)}</T>}
    </Card>)}
  </Section>;
}
