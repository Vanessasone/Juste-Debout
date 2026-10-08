export const EARLY_BIRD_START = Date.parse('2026-10-08T21:00:00+02:00');
export const EARLY_BIRD_END = Date.parse('2026-10-10T21:00:00+02:00');

export function earlyBirdState(now: number) {
  const phase = now < EARLY_BIRD_START ? 'upcoming' : now >= EARLY_BIRD_END ? 'ended' : 'active';
  const seconds = Math.max(0, Math.ceil(((phase === 'upcoming' ? EARLY_BIRD_START : EARLY_BIRD_END) - now) / 1000));
  const remaining = EARLY_BIRD_END - now;
  const color = phase !== 'active' || remaining > 24 * 3600000 ? '#B5FC44' : remaining > 12 * 3600000 ? '#FFAA33' : '#FF5C5C';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  const clock = [hours, minutes, seconds % 60].map(n => String(n).padStart(2, '0')).join(' : ');
  return { phase, color, clock };
}
