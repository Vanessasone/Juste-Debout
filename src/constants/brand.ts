/**
 * Juste Debout — Design System (identité officielle).
 *
 * Source : charte graphique officielle Juste Debout.
 * Couleurs : NOIR + vert acide « supagreen » #A4FA00 (signature) + gris.
 * Polices : FK Screamer Upright (titres CAPS), Ticketing (labels CAPS),
 *           New Airport Dot 2 (chiffres / technique). Corps de texte : système (lisibilité).
 * Style : plat, brut, contrasté — pas de dégradés néon. Textures glitch, cadres arrondis.
 */

export const Palette = {
  // Fonds (noir profond)
  bg: '#0A0A0A',
  bgElevated: '#111111',
  surface: '#161616',
  surface2: '#1E1E1E',
  surface3: '#2A2A2A',
  border: '#2F2F2F', // jet gray
  borderSoft: '#242424',

  // Texte
  text: '#FFFFFF',
  textDim: '#B9B9B4',
  textMute: '#6E6E6A', // ~ davy's gray

  // Marque
  primary: '#A4FA00', // supagreen — LA signature (fonds, boutons, surfaces sombres)
  accent: '#A4FA00', // vert « texte » : identique en sombre, foncé & lisible en clair (voir lightColors)
  primaryDeep: '#86D000',
  ink: '#000000',
  bone: '#F2EFE6',
  jet: '#2F2F2F',
  davy: '#585757',

  // Anciens noms conservés (remappés sur la marque pour cohérence)
  volt: '#A4FA00',
  cyan: '#A4FA00',
  violet: '#EDEDE8',
  gold: '#A4FA00',

  // États
  success: '#A4FA00',
  danger: '#FF4438',
  live: '#FF4438',

  // Côtés d'un passage — couleurs de la saison (ex. 2025 : vert lime / rose fuchsia).
  // Configurables par passage ; ce sont les valeurs par défaut.
  sideLime: '#A4FA00',
  sideFuchsia: '#FF2D9E',

  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.6)',
} as const;

/**
 * Dégradés — la marque est PLATE. On conserve les clés (compat écrans)
 * mais en tons monochrome + supagreen, très discrets.
 */
export const Gradients = {
  energy: ['#A4FA00', '#86D000'] as const,
  duo: ['#A4FA00', '#FF2D9E'] as const, // supagreen → fuchsia (signature bi-ton)
  fuchsia: ['#FF2D9E', '#B8005F'] as const,
  volt: ['#A4FA00', '#CBFF63'] as const,
  gold: ['#F2EFE6', '#BDBDB4'] as const,
  night: ['#1A1A1A', '#0A0A0A'] as const,
  sunset: ['#A4FA00', '#86D000'] as const,
  cyan: ['#A4FA00', '#86D000'] as const,
} as const;

/** Familles de polices officielles (chargées dans _layout via useFonts). */
export const Font = {
  screamer: 'FKScreamer', // gros titres, CAPS
  ticketing: 'Ticketing', // labels / boutons, CAPS
  dot: 'AirportDot', // chiffres, coordonnées, technique
  // Corps de texte : police système (lisibilité des bios, chat, formulaires)
} as const;

export const Radius = {
  sm: 8,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const Space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/**
 * Échelle typographique. Les titres utilisent FK Screamer en CAPS ;
 * les labels/chiffres les polices techniques ; le corps reste en système.
 */
export const Type = {
  display: {
    fontFamily: Font.screamer,
    fontSize: 40,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  title: {
    fontFamily: Font.screamer,
    fontSize: 30,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  h1: {
    fontFamily: Font.screamer,
    fontSize: 24,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  h2: {
    fontFamily: Font.ticketing,
    fontSize: 18,
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
  },
  h3: {
    fontFamily: Font.ticketing,
    fontSize: 15,
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
  },
  body: { fontSize: 15, fontWeight: '500' as const, lineHeight: 21 },
  small: { fontSize: 13, fontWeight: '500' as const },
  // Étiquettes / technique
  label: {
    fontFamily: Font.ticketing,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
  caption: {
    fontFamily: Font.dot,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  data: {
    fontFamily: Font.dot,
    fontSize: 14,
    letterSpacing: 0.5,
  },
} as const;

export const Shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: {
    shadowColor: Palette.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 10,
  },
} as const;

/** Motif signature : coordonnées GPS du Stade Coubertin (affiche 2026). */
export const JD_COORDS = '48°50\'7.6"N  2°23\'8.4"E';
export const JD_SINCE = 'SINCE 2002';
/** Ligne de positionnement (tagline). */
export const JD_TAGLINE = 'La communauté mondiale de la street dance';
