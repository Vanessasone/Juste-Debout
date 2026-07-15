/**
 * Données de démonstration Juste Debout.
 * Danseurs / contenus fictifs — à remplacer par l'API réelle en production.
 */

import { Palette } from '@/constants/brand';

// Les disciplines réelles de Juste Debout (danses « debout » ; le breaking est exclu — c'est l'ADN).
// Classic : Hip-Hop, Locking, Popping, House. Afro-descendantes : Afro, Dancehall, Krump, Electro.
export type Style =
  | 'Hip-Hop'
  | 'House'
  | 'Popping'
  | 'Locking'
  | 'Waacking'
  | 'Voguing'
  | 'Afro'
  | 'Dancehall'
  | 'Electro'
  | 'Krump'
  | 'Breaking'
  | 'Litefeet'
  | 'Bebop'
  | 'Ragga'
  | 'Afrohouse'
  | 'Kuduro'
  | 'Vibe'
  | 'All-Styles';

// Large éventail de danses (le profil = préférences perso ; la compétition JD garde ses catégories).
export const STYLES: Style[] = [
  'Hip-Hop',
  'House',
  'Popping',
  'Locking',
  'Waacking',
  'Voguing',
  'Afro',
  'Afrohouse',
  'Dancehall',
  'Ragga',
  'Electro',
  'Krump',
  'Breaking',
  'Litefeet',
  'Bebop',
  'Kuduro',
  'Vibe',
  'All-Styles',
];

// Toutes les disciplines partagent l'accent de marque (supagreen) — le label distingue.
export const styleColor = Object.fromEntries(STYLES.map((s) => [s, '#A4FA00'])) as Record<Style, string>;

export type Level = 'Amateur' | 'Confirmé' | 'Pro' | 'Légende';

export interface Dancer {
  id: string;
  name: string;
  alias: string;
  country: string;
  flag: string;
  city: string;
  styles: Style[];
  level: Level;
  profession: string;
  bio: string;
  wins: number;
  losses: number;
  titles: number;
  color: string;
  verified?: boolean;
}

export const currentUser: Dancer & {
  points: number;
  xp: number;
  levelNo: number;
  nextLevelXp: number;
} = {
  id: 'me',
  name: 'Toi',
  alias: 'You',
  country: 'France',
  flag: '🇫🇷',
  city: 'Paris',
  styles: ['Hip-Hop', 'House'],
  level: 'Confirmé',
  profession: 'Danseur',
  bio: "Danseur passionné de House & Hip-Hop. En route pour les qualifications Juste Debout 2026.",
  wins: 24,
  losses: 11,
  titles: 2,
  color: Palette.primary,
  verified: true,
  points: 4820,
  xp: 3200,
  levelNo: 7,
  nextLevelXp: 4000,
};

export const dancers: Dancer[] = [
  {
    id: 'd1',
    name: 'Malik Traoré',
    alias: 'Zoo',
    country: 'France',
    flag: '🇫🇷',
    city: 'Paris',
    styles: ['Popping'],
    level: 'Légende',
    profession: 'Danseur · Professeur',
    bio: 'Double finaliste Juste Debout. Popping sur du funk pur.',
    wins: 214,
    losses: 38,
    titles: 6,
    color: '#7A5CFF',
    verified: true,
  },
  {
    id: 'd2',
    name: 'Aïcha N.',
    alias: 'Ayoka',
    country: 'Sénégal',
    flag: '🇸🇳',
    city: 'Dakar',
    styles: ['Afro', 'House'],
    level: 'Pro',
    profession: 'Chorégraphe',
    bio: 'Fusion Afro-House. Championne Afrique de l’Ouest 2025.',
    wins: 98,
    losses: 21,
    titles: 3,
    color: '#FF9E2D',
    verified: true,
  },
  {
    id: 'd3',
    name: 'Kenji Sato',
    alias: 'K-Flow',
    country: 'Japon',
    flag: '🇯🇵',
    city: 'Tokyo',
    styles: ['House'],
    level: 'Pro',
    profession: 'Danseur',
    bio: 'Footwork infini. Représente la scène house de Tokyo.',
    wins: 156,
    losses: 44,
    titles: 4,
    color: '#38E1FF',
    verified: true,
  },
  {
    id: 'd4',
    name: 'Diego Fuentes',
    alias: 'El Loco',
    country: 'Mexique',
    flag: '🇲🇽',
    city: 'Mexico',
    styles: ['Krump'],
    level: 'Pro',
    profession: 'Danseur',
    bio: 'Énergie brute et explosive. Top 8 mondial en Krump.',
    wins: 132,
    losses: 51,
    titles: 2,
    color: '#D8FF3E',
  },
  {
    id: 'd5',
    name: 'Lena Brandt',
    alias: 'Volt',
    country: 'Allemagne',
    flag: '🇩🇪',
    city: 'Berlin',
    styles: ['Electro', 'Hip-Hop'],
    level: 'Confirmé',
    profession: 'Danseuse · Vidéaste',
    bio: 'Recherche du mouvement. Style hybride et texturé.',
    wins: 61,
    losses: 29,
    titles: 1,
    color: '#D8FF3E',
  },
  {
    id: 'd6',
    name: 'Marcus Bell',
    alias: 'Lockstar',
    country: 'USA',
    flag: '🇺🇸',
    city: 'Los Angeles',
    styles: ['Locking'],
    level: 'Légende',
    profession: 'Danseur · Juge',
    bio: 'Gardien de la funk. Juge international Locking.',
    wins: 188,
    losses: 33,
    titles: 5,
    color: '#FFC24B',
    verified: true,
  },
  {
    id: 'd7',
    name: 'Sofia Rossi',
    alias: 'Sisi',
    country: 'Italie',
    flag: '🇮🇹',
    city: 'Milan',
    styles: ['Hip-Hop'],
    level: 'Confirmé',
    profession: 'Danseuse',
    bio: 'Groove et bounce. Montante de la scène italienne.',
    wins: 47,
    losses: 22,
    titles: 0,
    color: '#FF2D74',
  },
  {
    id: 'd8',
    name: 'Yaw Mensah',
    alias: 'Ghost',
    country: 'Ghana',
    flag: '🇬🇭',
    city: 'Accra',
    styles: ['Afro'],
    level: 'Pro',
    profession: 'Danseur · Professeur',
    bio: 'Afro dance authentique, énergie brute.',
    wins: 84,
    losses: 19,
    titles: 2,
    color: '#FF9E2D',
  },
];

export interface EventInfo {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  city: string;
  venue: string;
  status: 'À venir' | 'Live' | 'Qualifications';
  cover: readonly [string, string];
}

export const nextEvent: EventInfo = {
  id: 'jd-world-2026',
  title: 'Juste Debout World Final',
  subtitle: 'La finale mondiale · les danses debout · 15 pays',
  date: '7–8 Mars 2026',
  city: 'Paris',
  venue: 'Stade Pierre de Coubertin',
  status: 'À venir',
  cover: ['#FF2D74', '#7A5CFF'],
};

export const events: EventInfo[] = [
  nextEvent,
  {
    id: 'jd-qualif-jp',
    title: 'JD Qualifier · Tokyo',
    subtitle: 'Qualification Asie',
    date: '18 Jan. 2026',
    city: 'Tokyo',
    venue: 'Shibuya Hall',
    status: 'Qualifications',
    cover: ['#38E1FF', '#7A5CFF'],
  },
  {
    id: 'jd-qualif-us',
    title: 'JD Qualifier · New York',
    subtitle: 'Qualification Amérique',
    date: '1 Fév. 2026',
    city: 'New York',
    venue: 'Brooklyn Steel',
    status: 'Qualifications',
    cover: ['#FF9E2D', '#FF2D74'],
  },
];

export interface Passage {
  id: string;
  style: Style;
  round: string;
  a: { alias: string; flag: string; score: number };
  b: { alias: string; flag: string; score: number };
  live?: boolean;
}

export const livePassages: Passage[] = [
  {
    id: 'b1',
    style: 'Popping',
    round: 'Demi-finale',
    a: { alias: 'Zoo', flag: '🇫🇷', score: 3 },
    b: { alias: 'K-Flow', flag: '🇯🇵', score: 2 },
    live: true,
  },
  {
    id: 'b2',
    style: 'House',
    round: '1/4 de finale',
    a: { alias: 'Ayoka', flag: '🇸🇳', score: 2 },
    b: { alias: 'Sisi', flag: '🇮🇹', score: 2 },
    live: true,
  },
  {
    id: 'b3',
    style: 'Locking',
    round: '1/8 de finale',
    a: { alias: 'Lockstar', flag: '🇺🇸', score: 3 },
    b: { alias: 'Ghost', flag: '🇬🇭', score: 1 },
  },
];

export interface Replay {
  id: string;
  title: string;
  year: number;
  style: Style;
  duration: string;
  views: string;
  premium?: boolean;
  color: readonly [string, string];
}

export const replays: Replay[] = [
  { id: 'r1', title: 'Zoo vs Iron — Finale Popping', year: 2025, style: 'Popping', duration: '6:24', views: '1.2M', color: ['#7A5CFF', '#FF2D74'] },
  { id: 'r2', title: 'Ayoka vs Nala — Finale House', year: 2025, style: 'House', duration: '5:48', views: '840k', premium: true, color: ['#38E1FF', '#7A5CFF'] },
  { id: 'r3', title: 'Best of Afro 2024', year: 2024, style: 'Afro', duration: '12:10', views: '2.1M', color: ['#33D69F', '#38E1FF'] },
  { id: 'r4', title: 'Lockstar — Route vers le titre', year: 2024, style: 'Locking', duration: '9:32', views: '560k', premium: true, color: ['#FFC24B', '#FF9E2D'] },
  { id: 'r5', title: 'Krump 2vs2 — Top 8', year: 2025, style: 'Krump', duration: '15:04', views: '410k', color: ['#D8FF3E', '#33D69F'] },
  { id: 'r6', title: 'Afro Session — Accra Cypher', year: 2025, style: 'Afro', duration: '7:20', views: '690k', color: ['#FF9E2D', '#FF2D74'] },
];

export interface Course {
  id: string;
  title: string;
  teacher: string;
  category: 'Danse' | 'Business' | 'Préparation';
  style?: Style;
  lessons: number;
  level: string;
  price: string;
  color: readonly [string, string];
}

export const courses: Course[] = [
  { id: 'c1', title: 'Popping Fondamentaux', teacher: 'Zoo', category: 'Danse', style: 'Popping', lessons: 24, level: 'Débutant → Inter.', price: '49 €', color: ['#7A5CFF', '#FF2D74'] },
  { id: 'c2', title: 'House Footwork Avancé', teacher: 'K-Flow', category: 'Danse', style: 'House', lessons: 18, level: 'Intermédiaire', price: '59 €', color: ['#38E1FF', '#7A5CFF'] },
  { id: 'c3', title: 'Vivre de la danse', teacher: 'JD Academy', category: 'Business', lessons: 12, level: 'Tous niveaux', price: '39 €', color: ['#FFC24B', '#FF9E2D'] },
  { id: 'c4', title: 'Créer son école de danse', teacher: 'JD Academy', category: 'Business', lessons: 10, level: 'Avancé', price: '69 €', color: ['#FF2D74', '#7A5CFF'] },
  { id: 'c5', title: 'Nutrition & récupération', teacher: 'Dr. Lefevre', category: 'Préparation', lessons: 8, level: 'Tous niveaux', price: '29 €', color: ['#33D69F', '#38E1FF'] },
  { id: 'c6', title: 'Préparation mentale du passage', teacher: 'M. Coach', category: 'Préparation', lessons: 6, level: 'Tous niveaux', price: '34 €', color: ['#D8FF3E', '#33D69F'] },
];

export interface Service {
  id: string;
  title: string;
  provider: string;
  flag: string;
  type: string;
  rating: number;
  reviews: number;
  price: string;
  color: string;
}

export const services: Service[] = [
  { id: 's1', title: 'Cours particulier Popping', provider: 'Zoo', flag: '🇫🇷', type: 'Cours particulier', rating: 4.9, reviews: 128, price: '60 €/h', color: '#7A5CFF' },
  { id: 's2', title: 'Chorégraphie mariage', provider: 'Ayoka', flag: '🇸🇳', type: 'Wedding dance', rating: 5.0, reviews: 64, price: 'dès 350 €', color: '#FF9E2D' },
  { id: 's3', title: 'Coaching compétition', provider: 'Lockstar', flag: '🇺🇸', type: 'Coaching', rating: 4.8, reviews: 92, price: '80 €/h', color: '#FFC24B' },
  { id: 's4', title: 'Location studio · 80m²', provider: 'Studio Flow', flag: '🇫🇷', type: 'Location studio', rating: 4.7, reviews: 210, price: '25 €/h', color: '#38E1FF' },
  { id: 's5', title: 'Captation vidéo de passage', provider: 'Volt', flag: '🇩🇪', type: 'Vidéaste', rating: 4.9, reviews: 47, price: 'dès 200 €', color: '#D8FF3E' },
];

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  pay: string;
  tags: string[];
  urgent?: boolean;
}

export const jobs: Job[] = [
  { id: 'j1', title: 'Danseurs pour tournée mondiale', company: 'Nova Live Show', location: 'International', type: 'Tournée', pay: '2 500 €/mois', tags: ['Hip-Hop', 'House'], urgent: true },
  { id: 'j2', title: 'Casting clip artiste international', company: 'MVMT Records', location: 'Paris', type: 'Casting', pay: 'Cachet 800 €', tags: ['Afro', 'Hip-Hop'] },
  { id: 'j3', title: 'Professeur Popping — mi-temps', company: 'Studio Flow', location: 'Lyon', type: 'Emploi', pay: '1 400 €/mois', tags: ['Popping'] },
  { id: 'j4', title: 'Chorégraphe spectacle', company: 'Cie Racine', location: 'Bruxelles', type: 'Mission', pay: 'À négocier', tags: ['Afro'] },
];

export interface Masterclass {
  id: string;
  title: string;
  master: string;
  flag: string;
  duration: string;
  color: readonly [string, string];
}

export const masterclasses: Masterclass[] = [
  { id: 'm1', title: "L'art du groove", master: 'Zoo', flag: '🇫🇷', duration: '2h10', color: ['#7A5CFF', '#FF2D74'] },
  { id: 'm2', title: 'Musicalité en House', master: 'K-Flow', flag: '🇯🇵', duration: '1h48', color: ['#38E1FF', '#7A5CFF'] },
  { id: 'm3', title: 'Locking : héritage & feeling', master: 'Lockstar', flag: '🇺🇸', duration: '2h30', color: ['#FFC24B', '#FF9E2D'] },
];

export interface Badge {
  id: string;
  label: string;
  icon: string;
  earned: boolean;
  color: string;
}

export const badges: Badge[] = [
  { id: 'bd1', label: 'Premier passage', icon: 'flame', earned: true, color: '#FF2D74' },
  { id: 'bd2', label: 'Profil complété', icon: 'checkmark-done', earned: true, color: '#33D69F' },
  { id: 'bd3', label: '10 workshops', icon: 'school', earned: true, color: '#7A5CFF' },
  { id: 'bd4', label: 'Qualifié', icon: 'trophy', earned: true, color: '#FFC24B' },
  { id: 'bd5', label: 'Globe-trotter · 5 pays', icon: 'earth', earned: false, color: '#38E1FF' },
  { id: 'bd6', label: 'Finaliste', icon: 'medal', earned: false, color: '#D8FF3E' },
];

export interface Challenge {
  id: string;
  label: string;
  reward: string;
  progress: number; // 0..1
  icon: string;
}

export const challenges: Challenge[] = [
  { id: 'ch1', label: 'Regarder 3 rencontres', reward: '+50 XP', progress: 0.66, icon: 'play-circle' },
  { id: 'ch2', label: 'Compléter ton profil', reward: '+100 XP', progress: 0.8, icon: 'person-circle' },
  { id: 'ch3', label: 'Participer à un workshop', reward: '+150 XP', progress: 0.0, icon: 'school' },
  { id: 'ch4', label: 'Publier un freestyle', reward: '+80 XP', progress: 0.0, icon: 'videocam' },
];

export interface PassportStamp {
  id: string;
  event: string;
  city: string;
  flag: string;
  year: number;
  earned: boolean;
}

export const passportStamps: PassportStamp[] = [
  { id: 'p1', event: 'JD Qualifier', city: 'Paris', flag: '🇫🇷', year: 2024, earned: true },
  { id: 'p2', event: 'JD Qualifier', city: 'Londres', flag: '🇬🇧', year: 2024, earned: true },
  { id: 'p3', event: 'World Final', city: 'Paris', flag: '🇫🇷', year: 2025, earned: true },
  { id: 'p4', event: 'JD Camp', city: 'Barcelone', flag: '🇪🇸', year: 2025, earned: true },
  { id: 'p5', event: 'JD Qualifier', city: 'Tokyo', flag: '🇯🇵', year: 2026, earned: false },
  { id: 'p6', event: 'World Final', city: 'Paris', flag: '🇫🇷', year: 2026, earned: false },
];

export interface HallOfFameEntry {
  year: number;
  style: Style;
  winner: string;
  flag: string;
}

export const hallOfFame: HallOfFameEntry[] = [
  { year: 2025, style: 'Popping', winner: 'Zoo', flag: '🇫🇷' },
  { year: 2025, style: 'House', winner: 'Ayoka', flag: '🇸🇳' },
  { year: 2025, style: 'Locking', winner: 'Lockstar', flag: '🇺🇸' },
  { year: 2024, style: 'Hip-Hop', winner: 'Sisi', flag: '🇮🇹' },
  { year: 2024, style: 'Krump', winner: 'El Loco', flag: '🇲🇽' },
  { year: 2024, style: 'Afro', winner: 'Ghost', flag: '🇬🇭' },
];

export interface CompanionMsg {
  id: string;
  from: 'ai' | 'user';
  text: string;
}

export const companionIntro: CompanionMsg[] = [
  {
    id: 'i1',
    from: 'ai',
    text: "Salut 👋 Je suis Flow, ton assistant IA. Je peux créer ton planning, te recommander des workshops, trouver des danseurs à rencontrer ou te guider dans l'arène. Que veux-tu faire ?",
  },
];

export const companionSuggestions: string[] = [
  'Crée mon planning du World Final',
  'Recommande-moi un workshop House',
  'Quelles rencontres regarder ce soir ?',
  'Trouve un partenaire 2vs2',
];
