/**
 * Thèmes clair / sombre. Mêmes clés que Palette (marque JD).
 * Le sombre = identité par défaut (noir + supagreen). Le clair = blanc + noir + accent vert.
 */
import { Palette } from '@/constants/brand';

export type ThemeColors = Record<keyof typeof Palette, string>;

export const darkColors: ThemeColors = { ...Palette };

export const lightColors: ThemeColors = {
  ...Palette,
  // Fonds clairs
  bg: '#FBFBF9',
  bgElevated: '#FFFFFF',
  surface: '#FFFFFF',
  surface2: '#F1F1EE',
  surface3: '#E7E7E2',
  border: '#E2E2DB',
  borderSoft: '#EDEDE8',
  // Texte foncé
  text: '#0B0B0B',
  textDim: '#55554F',
  textMute: '#9A9A94',
  // Accents lisibles sur fond clair
  accent: '#1F7A00', // vert « texte » foncé & lisible sur blanc (le vif #A4FA00 reste pour les fonds)
  violet: '#2A2A2A',
  success: '#3E9E00',
  danger: '#D93A3A',
  overlay: 'rgba(0,0,0,0.35)',
  // primary (#A4FA00), volt, cyan, gold restent la signature (fonds avec texte noir)
};
