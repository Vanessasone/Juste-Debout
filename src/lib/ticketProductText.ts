import { customerText } from '@/lib/customerText';
export function ticketProductText(code: string, locale: string, fallback: { name: string; description?: string | null }) {
  const ct = (key: Parameters<typeof customerText>[1], values?: Record<string, string | number>) => customerText(locale, key, values);
  const dates = code.endsWith('_sat') ? [13] : code.endsWith('_sun') ? [14] : code === 'three_days' ? [12,13,14] : code === 'four_days' ? [11,12,13,14] : [13,14];
  const format = (day: number, weekday = false) => new Intl.DateTimeFormat(locale, { timeZone: 'Europe/Paris', ...(weekday ? {weekday:'long' as const} : {day:'numeric' as const,month:'long' as const,year:'numeric' as const}) }).format(new Date(Date.UTC(2027,2,day,12)));
  const suffix = dates.length === 1 ? format(dates[0], true) : ct('passTwo');
  let name = fallback.name;
  let description = fallback.description ?? '';
  if (code === 'black_card') return { name: 'Black Card', description: ct('blackInfo') };
  if (code.startsWith('day_')) name = `${ct('passDay')} · ${suffix}`;
  else if (code === 'two_days') name = ct('passTwo');
  else if (code.startsWith('family_')) name = `${ct('familyPass')} · ${suffix}`;
  else if (code.startsWith('vip_')) name = `VIP · ${suffix}`;
  else if (code.startsWith('mjc_')) name = `${ct('mjc')} · ${suffix}`;
  else if (code === 'three_days') name = ct('passThree');
  else if (code === 'four_days') name = ct('passFour');
  else return { name, description };
  description = ct('access', { dates: dates.map(day => format(day)).join(' · ') });
  if (code.startsWith('family_')) description += ` · ${ct('family')}`;
  if (code.startsWith('mjc_')) description += ` · 20 € · ${ct('minimum', {n:10})}`;
  return { name, description };
}
