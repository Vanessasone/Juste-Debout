/**
 * Gamification « JD Points » — 100% dérivée d'actions réelles (aucun point fictif).
 * Fonctions pures : calcul des points, rang, quêtes et badges à partir de compteurs réels.
 */
import type { MyRegistration } from '@/lib/jdlive';
import type { Profile } from '@/lib/profile';
import type { Ticket } from '@/lib/tickets';

const PROFILE_FIELDS = (p: Profile | null) => [
  p?.full_name,
  p?.alias,
  p?.country,
  p?.city,
  p?.bio,
  p?.styles?.length ? 'x' : '',
  p?.photo_url,
];

export function profilePct(p: Profile | null): number {
  const f = PROFILE_FIELDS(p);
  return f.filter(Boolean).length / f.length;
}

export type GamiCounts = {
  events: number;
  dancerRegs: number;
  spectatorRegs: number;
  disciplines: number;
  countries: number;
  publicVotes: number;
  attended: number; // présences vérifiées (billets scannés)
  school: boolean;
  profilePct: number; // 0..100
  predCorrect: number; // pronostics gagnés
  predTotal: number; // pronostics résolus
};

/** Construit les compteurs à partir des données réelles déjà chargées. */
export function countsFrom(input: {
  profile: Profile | null;
  regs: MyRegistration[];
  publicVotes: number;
  tickets: Ticket[];
  predStats?: { total: number; correct: number };
}): GamiCounts {
  const { profile, regs, publicVotes, tickets, predStats } = input;
  const dancerRegs = regs.filter((r) => r.type === 'dancer');
  const distinctEvents = new Set(regs.map((r) => r.events?.id).filter(Boolean));
  const distinctDisc = new Set(dancerRegs.map((r) => r.categories?.name).filter(Boolean));
  const distinctCountries = new Set(regs.map((r) => r.events?.country).filter(Boolean));
  return {
    events: distinctEvents.size,
    dancerRegs: dancerRegs.length,
    spectatorRegs: regs.filter((r) => r.type === 'spectator').length,
    disciplines: distinctDisc.size,
    countries: distinctCountries.size,
    publicVotes,
    attended: tickets.filter((t) => !!t.used_at).length,
    school: !!profile?.available_for_school,
    profilePct: Math.round(profilePct(profile) * 100),
    predCorrect: predStats?.correct ?? 0,
    predTotal: predStats?.total ?? 0,
  };
}

const POINTS = {
  profileMax: 200,
  perEvent: 100,
  perDancerReg: 80,
  perDiscipline: 40,
  perCountry: 60,
  perVote: 5,
  voteCap: 200,
  perAttended: 150,
  school: 100,
  perPrediction: 20, // par pronostic gagné
};

// Programme de fidélité JD Coins — 4 paliers (aspirationnels, alignés sur JD School).
const RANKS = [
  { name: 'Basic', min: 0, mult: 1, color: '#8A8A82', icon: 'ellipse-outline' },
  { name: 'Foundation', min: 1000, mult: 1.1, color: '#CD7F32', icon: 'flame' },
  { name: 'Rise & Shine', min: 5000, mult: 1.25, color: '#C7CCD1', icon: 'star' },
  { name: 'Full Out', min: 10000, mult: 1.5, color: '#A4FA00', icon: 'diamond' },
];

export type Breakdown = { label: string; points: number }[];
export type Rank = {
  index: number;
  name: string;
  min: number;
  next: number | null;
  nextName: string | null;
  progress: number; // 0..1 vers le rang suivant
  mult: number; // multiplicateur de gain de coins
  color: string;
  icon: string;
};
export type Gamification = { points: number; counts: GamiCounts; breakdown: Breakdown; rank: Rank };

export function rankFor(points: number): Rank {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) if (points >= RANKS[i].min) idx = i;
  const cur = RANKS[idx];
  const nextR = RANKS[idx + 1] ?? null;
  const progress = nextR ? (points - cur.min) / (nextR.min - cur.min) : 1;
  return {
    index: idx,
    name: cur.name,
    min: cur.min,
    next: nextR?.min ?? null,
    nextName: nextR?.name ?? null,
    progress: Math.max(0, Math.min(1, progress)),
    mult: cur.mult,
    color: cur.color,
    icon: cur.icon,
  };
}

export function computeGamification(counts: GamiCounts): Gamification {
  const b: Breakdown = [];
  const add = (label: string, points: number) => {
    if (points > 0) b.push({ label, points });
  };
  add('Profil complété', Math.round((counts.profilePct / 100) * POINTS.profileMax));
  add('Inscriptions', counts.events * POINTS.perEvent);
  add('Passages en danseur', counts.dancerRegs * POINTS.perDancerReg);
  add('Disciplines', counts.disciplines * POINTS.perDiscipline);
  add('Pays visités', counts.countries * POINTS.perCountry);
  add('Votes du public', Math.min(counts.publicVotes * POINTS.perVote, POINTS.voteCap));
  add('Présences vérifiées', counts.attended * POINTS.perAttended);
  add('Pronostics gagnés', counts.predCorrect * POINTS.perPrediction);
  add('Juste Debout School', counts.school ? POINTS.school : 0);
  const points = b.reduce((s, x) => s + x.points, 0);
  return { points, counts, breakdown: b, rank: rankFor(points) };
}

export type Quest = {
  id: string;
  label: string;
  done: boolean;
  progress: number; // 0..1
  reward: number;
  route: string;
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function quests(counts: GamiCounts): Quest[] {
  // `label` = clé i18n (traduite à l'affichage).
  return [
    { id: 'profile', label: 'gami.qProfile', done: counts.profilePct >= 100, progress: clamp01(counts.profilePct / 100), reward: POINTS.profileMax, route: '/edit-profile' },
    { id: 'register', label: 'gami.qRegister', done: counts.events >= 1, progress: clamp01(counts.events / 1), reward: POINTS.perEvent, route: '/register' },
    { id: 'dancer', label: 'gami.qDancer', done: counts.dancerRegs >= 1, progress: clamp01(counts.dancerRegs / 1), reward: POINTS.perDancerReg, route: '/register' },
    { id: 'disc', label: 'gami.qDisc', done: counts.disciplines >= 2, progress: clamp01(counts.disciplines / 2), reward: POINTS.perDiscipline * 2, route: '/register' },
    { id: 'votes', label: 'gami.qVotes', done: counts.publicVotes >= 5, progress: clamp01(counts.publicVotes / 5), reward: POINTS.perVote * 5, route: '/live' },
    { id: 'passport', label: 'gami.qPassport', done: counts.events >= 3, progress: clamp01(counts.events / 3), reward: POINTS.perEvent, route: '/passport' },
    { id: 'school', label: 'gami.qSchool', done: counts.school, progress: counts.school ? 1 : 0, reward: POINTS.school, route: '/school' },
  ];
}

export type Badge = { id: string; label: string; icon: string; earned: boolean };

export function badges(counts: GamiCounts): Badge[] {
  // `label` = clé i18n (traduite à l'affichage).
  return [
    { id: 'b1', label: 'gami.bProfile', icon: 'checkmark-done', earned: counts.profilePct >= 85 },
    { id: 'b2', label: 'gami.bRegistered', icon: 'ticket', earned: counts.events > 0 },
    { id: 'b3', label: 'gami.bDancer', icon: 'body', earned: counts.dancerRegs > 0 },
    { id: 'b4', label: 'gami.bMulti', icon: 'flame', earned: counts.disciplines >= 2 },
    { id: 'b5', label: 'gami.bPresent', icon: 'qr-code', earned: counts.attended > 0 },
    { id: 'b6', label: 'gami.bSupporter', icon: 'megaphone', earned: counts.publicVotes >= 5 },
    { id: 'b7', label: 'gami.bPredictor', icon: 'analytics', earned: counts.predCorrect >= 3 },
    { id: 'b8', label: 'gami.bProf', icon: 'school', earned: counts.school },
    { id: 'b9', label: 'gami.bGlobe', icon: 'earth', earned: counts.countries >= 3 },
  ];
}
