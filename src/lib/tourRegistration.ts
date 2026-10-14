export const JDT_REFERENCE_DATE = '2027-03-13';
export const JDT_MIN_BIRTH_DATE = '2012-03-14';
export const JDT_MAX_BIRTH_DATE = '2021-03-13';
export const CLASSIC = ['Locking', 'Popping', 'House', 'Hip Hop'];
export const AFRO = ['Afro', 'Dancehall', 'Electro', 'Krump'];
export type TourStop = { slug: string; name: string; date: string; endDate?: string; venue?: string; categories: string[]; junior: boolean };
export const TOUR_STOPS: TourStop[] = [
  { slug: 'chongqing', name: 'Chine · Chongqing', date: '2026-12-20', categories: CLASSIC, junior: true },
  { slug: 'tokyo', name: 'Japon · Tokyo', date: '2027-01-04', venue: 'SHIBUYA STREAM HALL', categories: CLASSIC, junior: false },
  { slug: 'milan', name: 'Italie · Milan', date: '2027-02-13', categories: CLASSIC, junior: true },
  { slug: 'netherlands', name: 'Pays-Bas', date: '2027-02-27', categories: CLASSIC, junior: false },
  { slug: 'liege', name: 'Belgique · Liège', date: '2027-03-06', categories: CLASSIC, junior: false },
  { slug: 'london', name: 'Royaume-Uni · Londres', date: '2027-03-07', categories: ['Hip Hop', 'Popping', 'Afro', 'Krump'], junior: false },
  { slug: 'paris', name: 'France · Paris — prélims', date: '2027-03-11', endDate: '2027-03-12', categories: [...CLASSIC, ...AFRO], junior: true },
];
export type Dancer = { name: string; alias: string; email: string; country: string; birthDate: string; photoPath?: string };
export type TourEntry = { stop: string; category: string; teamName: string; dancers: Dancer[]; guardianName: string; guardianEmail: string; guardianPhone: string; guardianConsent: boolean; consent: boolean; duoPhotoPath?: string };
export const emptyDancer = (): Dancer => ({ name: '', alias: '', email: '', country: '', birthDate: '' });
export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
export function isJdtEligible(value: string): boolean {
  return isValidDate(value) && value >= JDT_MIN_BIRTH_DATE && value <= JDT_MAX_BIRTH_DATE;
}
export function validateEntry(entry: TourEntry): string | null {
  const stop = TOUR_STOPS.find(s => s.slug === entry.stop);
  if (!stop) return 'Choisis une édition.';
  const junior = entry.category === 'Junior Dance Tour';
  if (!(junior ? stop.junior : stop.categories.includes(entry.category))) return 'Choisis une discipline proposée pour cette édition.';
  if (entry.dancers.length !== (junior ? 1 : 2)) return junior ? 'Un seul participant est requis.' : 'Deux danseurs sont requis.';
  for (const d of entry.dancers) {
    if (!d.name.trim() || !d.country.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) return 'Renseigne le nom, le pays et un e-mail valide pour chaque participant.';
  }
  if (!junior && entry.dancers[0].email.trim().toLowerCase() === entry.dancers[1].email.trim().toLowerCase()) return 'Les deux danseurs doivent avoir des e-mails distincts.';
  if (junior) {
    if (!isJdtEligible(entry.dancers[0].birthDate)) return 'JDT : le participant doit avoir de 6 à 14 ans inclus au 13 mars 2027.';
    if (!entry.guardianName.trim() || !entry.guardianPhone.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry.guardianEmail.trim()) || !entry.guardianConsent) return 'Renseigne le responsable légal et son autorisation.';
  }
  if (!entry.consent) return 'Ton consentement est nécessaire pour traiter les données de cette inscription.';
  return null;
}
