/**
 * Logos officiels Juste Debout — wordmark manuscrit + emblème « Vitruve danseur ».
 * Images monochromes sur fond transparent, teintables (blanc / supagreen).
 */
import { Image } from 'react-native';

import { Palette } from '@/constants/brand';

const WORDMARK_RATIO = 1494 / 575; // largeur / hauteur du fichier source

export function Wordmark({
  height = 34,
  color = Palette.white,
}: {
  height?: number;
  color?: string;
}) {
  return (
    <Image
      source={require('@/assets/brand/wordmark-black.png')}
      style={{ height, width: height * WORDMARK_RATIO, tintColor: color }}
      resizeMode="contain"
    />
  );
}

export function Vitruve({
  size = 44,
  color = Palette.primary,
  opacity = 1,
}: {
  size?: number;
  color?: string;
  opacity?: number;
}) {
  return (
    <Image
      source={require('@/assets/brand/vitruve.png')}
      style={{ width: size, height: size, tintColor: color, opacity }}
      resizeMode="contain"
    />
  );
}
