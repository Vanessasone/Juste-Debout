import { createElement, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { Card, Section, T } from '@/components/ui';
import { useCustomerText } from '@/lib/customerText';
import { useColors } from '@/lib/theme';
import { TicketGroup } from '@/lib/ticketSalesPresentation';

const PROMO_VIDEO = 'https://justedeboutapp.com/media/juste-debout-promo.mp4';

function NativePromoVideo() {
  const player = useVideoPlayer(PROMO_VIDEO, player => {
    player.muted = true;
    player.loop = true;
    player.play();
  });
  return <VideoView player={player} nativeControls={false} contentFit="cover" style={{ width: '100%', height: '100%' }} />;
}

export function TicketVideoBackground() {
  return <View pointerEvents="none" accessible={false} style={StyleSheet.absoluteFill}>
    {Platform.OS === 'web' ? createElement('video', {
      src: '/media/juste-debout-promo.mp4', poster: '/media/juste-debout-promo.jpg',
      autoPlay: true, muted: true, playsInline: true, loop: true, controls: false, preload: 'auto',
      tabIndex: -1, 'aria-hidden': true, disablePictureInPicture: true,
      style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' },
    }) : <NativePromoVideo />}
    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.62)' }]} />
  </View>;
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
