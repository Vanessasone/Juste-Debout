/**
 * Juste Debout — Bibliothèque de composants UI réutilisables (thème clair/sombre).
 */
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Font, Gradients, Palette, Radius, Space, Type } from '@/constants/brand';
import { ThemeColors } from '@/constants/theme';
import { useColors } from '@/lib/theme';

/* ---------- Screen wrapper ---------- */
export function Screen({
  children,
  scroll = true,
  padded = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const pad = padded ? Space.lg : 0;
  if (!scroll) {
    return (
      <View style={[{ flex: 1, backgroundColor: c.bg }, { paddingTop: insets.top + Space.sm }]}>
        {children}
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + Space.sm,
          paddingBottom: insets.bottom + 96,
          paddingHorizontal: pad,
        }}>
        {children}
      </ScrollView>
    </View>
  );
}

/* ---------- Header ---------- */
export function AppHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const c = useColors();
  return (
    <View style={s.header}>
      <View style={{ flex: 1 }}>
        {subtitle ? <Text style={s.eyebrow}>{subtitle}</Text> : null}
        <Text style={[s.title, { color: c.text }]}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

/* ---------- Page header with back button ---------- */
export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const c = useColors();
  const router = useRouter();
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Space.sm }}>
      <Pressable
        onPress={goBack}
        hitSlop={10}
        style={[s.backBtn, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Ionicons name="chevron-back" size={22} color={c.text} />
      </Pressable>
      <View style={{ flex: 1 }}>
        {subtitle ? <Text style={s.eyebrow}>{subtitle}</Text> : null}
        <Text style={[s.title, { color: c.text }]}>{title}</Text>
      </View>
    </View>
  );
}

/* ---------- Section ---------- */
export function Section({
  title,
  action,
  onAction,
  children,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  const c = useColors();
  return (
    <View style={{ marginTop: Space.xl }}>
      <View style={s.sectionHead}>
        <Text style={[s.sectionTitle, { color: c.text }]}>{title}</Text>
        {action ? (
          <Pressable onPress={onAction} hitSlop={8}>
            <Text style={s.sectionAction}>{action}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/* ---------- Card ---------- */
export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const c = useColors();
  const content = (
    <View style={[{ backgroundColor: c.surface, borderColor: c.borderSoft }, s.card, style]}>
      {children}
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
        {content}
      </Pressable>
    );
  }
  return content;
}

/* ---------- Text helpers ---------- */
export function T({
  children,
  variant = 'body',
  color,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  variant?: keyof typeof Type;
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const c = useColors();
  return (
    <Text numberOfLines={numberOfLines} style={[Type[variant], { color: color ?? c.text }, style]}>
      {children}
    </Text>
  );
}

/* ---------- Chip ---------- */
export function Chip({
  label,
  color = Palette.primary,
  active = false,
  onPress,
  small = false,
}: {
  label: string;
  color?: string;
  active?: boolean;
  onPress?: () => void;
  small?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={[
        s.chip,
        small && { paddingVertical: 5, paddingHorizontal: 10 },
        active
          ? { backgroundColor: color, borderColor: color }
          : { backgroundColor: 'transparent', borderColor: c.border },
      ]}>
      <Text style={[s.chipText, small && { fontSize: 12 }, { color: active ? Palette.black : c.textDim }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/* ---------- Tag (couleur portée par la prop, thème-agnostique) ---------- */
export function Tag({ label, color }: { label: string; color: string }) {
  return (
    <View style={[s.tag, { backgroundColor: color + '22', borderColor: color + '55' }]}>
      <Text style={[s.tagText, { color }]}>{label}</Text>
    </View>
  );
}

/* ---------- Avatar ---------- */
export function Avatar({
  name,
  color = Palette.primary,
  size = 44,
  ring = false,
  uri,
}: {
  name: string;
  color?: string;
  size?: number;
  ring?: boolean;
  uri?: string | null;
}) {
  const c = useColors();
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: ring ? 2 : 1,
          borderColor: ring ? Palette.primary : c.border,
          backgroundColor: c.surface2,
        }}
      />
    );
  }
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.surface2,
        borderWidth: ring ? 2 : 1,
        borderColor: ring ? Palette.primary : c.border,
      }}>
      <Text
        style={{
          color: ring ? Palette.primary : c.text,
          fontFamily: Font.dot,
          fontSize: size * 0.34,
          letterSpacing: 0.5,
        }}>
        {initials}
      </Text>
    </View>
  );
}

/* ---------- Gradient button (vert + texte noir, thème-agnostique) ---------- */
export function GButton({
  label,
  icon,
  onPress,
  colors = Gradients.energy,
  full = true,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  colors?: readonly [string, string];
  full?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.gbtn, full && { alignSelf: 'stretch' }]}>
        {icon ? <Ionicons name={icon} size={18} color={Palette.black} style={{ marginRight: 8 }} /> : null}
        <Text style={s.gbtnText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

/* ---------- Ghost button ---------- */
export function GhostButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
}) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} style={[s.ghostBtn, { borderColor: c.border, backgroundColor: c.surface }]}>
      {icon ? <Ionicons name={icon} size={18} color={c.text} style={{ marginRight: 8 }} /> : null}
      <Text style={[s.ghostText, { color: c.text }]}>{label}</Text>
    </Pressable>
  );
}

/* ---------- Icon bubble (thème-agnostique) ---------- */
export function IconBubble({
  icon,
  color = Palette.primary,
  size = 44,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Radius.md,
        backgroundColor: color + '22',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Ionicons name={icon} size={size * 0.5} color={color} />
    </View>
  );
}

/* ---------- Stat block ---------- */
export function Stat({ value, label, color }: { value: string; label: string; color?: string }) {
  const c = useColors();
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ color: color ?? c.text, fontSize: 20, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: c.textMute, fontSize: 11, fontWeight: '600', marginTop: 2 }}>{label}</Text>
    </View>
  );
}

/* ---------- Live dot (thème-agnostique) ---------- */
export function LiveBadge() {
  return (
    <View style={s.liveBadge}>
      <View style={s.liveDot} />
      <Text style={s.liveText}>LIVE</Text>
    </View>
  );
}

/* ---------- Progress bar ---------- */
export function Progress({ value, color = Palette.primary }: { value: number; color?: string }) {
  const c = useColors();
  return (
    <View style={[s.progressTrack, { backgroundColor: c.surface2 }]}>
      <View style={[s.progressFill, { width: `${Math.min(1, value) * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

/* ---------- Styles statiques (layout + couleurs thème-agnostiques) ---------- */
const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: Space.xs, marginTop: Space.sm },
  eyebrow: {
    color: Palette.primary,
    fontFamily: Font.dot,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  title: { ...Type.title },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Space.md,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Space.md,
  },
  sectionTitle: { ...Type.h2 },
  sectionAction: {
    color: Palette.primary,
    fontFamily: Font.ticketing,
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  card: { borderRadius: Radius.lg, padding: Space.lg, borderWidth: 1 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: Radius.pill, borderWidth: 1, marginRight: 8 },
  chipText: { fontFamily: Font.ticketing, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' },
  tag: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: Radius.pill, borderWidth: 1, alignSelf: 'flex-start' },
  tagText: { fontFamily: Font.ticketing, fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase' },
  gbtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 22,
    borderRadius: Radius.pill,
  },
  gbtnText: { color: Palette.black, fontFamily: Font.ticketing, fontSize: 15, letterSpacing: 0.6, textTransform: 'uppercase' },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  ghostText: { fontFamily: Font.ticketing, fontSize: 15, letterSpacing: 0.5, textTransform: 'uppercase' },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.live,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: Radius.pill,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff', marginRight: 5 },
  liveText: { color: '#fff', fontFamily: Font.dot, fontSize: 10, letterSpacing: 1 },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
});

// (référence conservée pour compat éventuelle)
export type { ThemeColors };
