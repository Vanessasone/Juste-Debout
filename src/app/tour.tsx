/**
 * Le tour mondial — carte brandée (SVG) des présélections + finales.
 * Point vert = présélection, point fuchsia = finale. Tap → fiche + « J'en suis ».
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import Svg, { Circle, Defs, G, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { Card, PageHeader, Screen, T } from '@/components/ui';
import { Palette, Radius, Space } from '@/constants/brand';
import { cityCoords, project } from '@/lib/cities';
import { countryFlag } from '@/lib/countries';
import { useI18n } from '@/lib/i18n';
import { EventRow, getEvents } from '@/lib/jdlive';
import { LAND_DOTS } from '@/lib/landdots';
import { useColors } from '@/lib/theme';

const isFinale = (t?: string | null) => /finale/i.test(t ?? '');

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

// Sous-ensemble de points qui « scintillent » (réparti sur toutes les terres).
const TWINKLES = LAND_DOTS.filter((_, i) => i % 44 === 0);

/** Un point vivant : scintillement doux (opacité + rayon) en boucle, déphasé. */
function Twinkle({ x, y, delay, color }: { x: number; y: number; delay: number; color: string }) {
  const v = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: 950, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(v, { toValue: 0, duration: 1150, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, delay]);
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] });
  const r = v.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.7] });
  return <AnimatedCircle cx={x} cy={y} r={r} fill={color} opacity={opacity} />;
}


export default function Tour() {
  const c = useColors();
  const router = useRouter();
  const { t, locale } = useI18n();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [selected, setSelected] = useState<EventRow | null>(null);

  // Respiration du halo ambiant.
  const amb = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(amb, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(amb, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [amb]);
  const ambOpacity = amb.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  // Halo fuchsia en contre-phase du halo vert (respiration alternée).
  const amb2Opacity = amb.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] });

  useFocusEffect(
    useCallback(() => {
      getEvents()
        .then((e) => setEvents(e.filter((x) => x.status !== 'done')))
        .catch(() => setEvents([]));
    }, []),
  );

  const points = useMemo(
    () =>
      events
        .map((e) => {
          const co = cityCoords(e.city);
          if (!co) return null;
          const p = project(co[0], co[1]);
          return { e, x: p.x, y: p.y, fin: isFinale(e.title) };
        })
        .filter(Boolean) as { e: EventRow; x: number; y: number; fin: boolean }[],
    [events],
  );
  return (
    <Screen>
      <PageHeader title={t('tour.title')} subtitle={t('home.season')} />

      <View style={{ width: '100%', aspectRatio: 2, borderRadius: Radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: c.border }}>
        <Svg width="100%" height="100%" viewBox="0 0 360 180">
          <Defs>
            <RadialGradient id="amb" cx="34%" cy="42%" r="55%">
              <Stop offset="0%" stopColor={Palette.primary} stopOpacity={0.14} />
              <Stop offset="60%" stopColor={Palette.primary} stopOpacity={0.03} />
              <Stop offset="100%" stopColor={Palette.primary} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="amb2" cx="72%" cy="60%" r="52%">
              <Stop offset="0%" stopColor={Palette.sideFuchsia} stopOpacity={0.12} />
              <Stop offset="60%" stopColor={Palette.sideFuchsia} stopOpacity={0.025} />
              <Stop offset="100%" stopColor={Palette.sideFuchsia} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={360} height={180} fill="#0A0A0A" />
          <AnimatedRect x={0} y={0} width={360} height={180} fill="url(#amb)" opacity={ambOpacity} />
          <AnimatedRect x={0} y={0} width={360} height={180} fill="url(#amb2)" opacity={amb2Opacity} />

          {/* Terres — semis de points néon (dot-matrix, vraies côtes Natural Earth) */}
          {LAND_DOTS.map(([x, y], i) => (
            <Circle key={`d${i}`} cx={x} cy={y} r={0.9} fill={Palette.primary} fillOpacity={0.6} />
          ))}

          {/* Points vivants — scintillement déphasé (bi-ton lime/fuchsia) */}
          {TWINKLES.map(([x, y], i) => (
            <Twinkle key={`tw${i}`} x={x} y={y} delay={(i * 137) % 2100} color={i % 3 === 0 ? Palette.sideFuchsia : Palette.primary} />
          ))}

          {/* Villes — points blancs lumineux (halo blanc + anneau coloré présel/finale) */}
          {points.map((p) => {
            const col = p.fin ? Palette.sideFuchsia : Palette.primary;
            const on = selected?.id === p.e.id;
            return (
              <G key={p.e.id} onPress={() => setSelected(p.e)}>
                <Circle cx={p.x} cy={p.y} r={on ? 9 : 6.5} fill="#FFFFFF" fillOpacity={0.16} />
                <Circle cx={p.x} cy={p.y} r={5} fill="none" stroke={col} strokeWidth={0.9} strokeOpacity={0.85} />
                <Circle cx={p.x} cy={p.y} r={on ? 3.4 : 2.7} fill="#FFFFFF" />
              </G>
            );
          })}

          {/* Labels */}
          {points.map((p) => (
            <SvgText key={`t${p.e.id}`} x={p.x} y={p.y - 8} fill="#FFFFFF" fontSize={6} fontWeight="bold" textAnchor="middle">
              {(p.e.city ?? '').toUpperCase()}
            </SvgText>
          ))}
        </Svg>
      </View>

      {/* Légende */}
      <View style={{ flexDirection: 'row', gap: Space.lg, marginTop: Space.md, justifyContent: 'center' }}>
        <Legend color={Palette.primary} label={t('tour.presel')} />
        <Legend color={Palette.sideFuchsia} label={t('home.worldFinals')} />
      </View>

      {/* Détail au tap */}
      {selected ? (
        <Card style={{ marginTop: Space.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <T style={{ fontSize: 26 }}>{countryFlag(selected.country)}</T>
            <View style={{ flex: 1, marginLeft: Space.md }}>
              <T variant="h3">{selected.city ?? selected.title}</T>
              <T variant="caption" color={c.textMute} style={{ marginTop: 2 }}>
                {[isFinale(selected.title) ? t('home.worldFinals') : t('tour.presel'), selected.country].filter(Boolean).join(' · ')}
                {selected.starts_on ? ` · ${new Date(selected.starts_on).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}
              </T>
            </View>
          </View>
          <Pressable
            onPress={() => router.push('/register')}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary, borderRadius: Radius.pill, paddingVertical: 13, marginTop: Space.md }}>
            <T variant="label" color={c.black}>{t('home.imIn')}</T>
            <Ionicons name="arrow-forward" size={16} color={c.black} style={{ marginLeft: 6 }} />
          </Pressable>
        </Card>
      ) : (
        <T variant="small" color={c.textDim} style={{ textAlign: 'center', marginTop: Space.lg }}>
          {t('tour.touchCity')}
        </T>
      )}
    </Screen>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: color }} />
      <T variant="caption" color={c.textDim}>
        {label}
      </T>
    </View>
  );
}
