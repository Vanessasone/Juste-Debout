import translations from '@/constants/customerTranslations.json';
import { useI18n } from '@/lib/i18n';
export function customerText(locale: string, key: keyof typeof translations.fr, values: Record<string, string | number> = {}) {
  const language = locale.split('-')[0] as keyof typeof translations;
  let text = (translations[language] ?? translations.en)[key];
  for (const [name, value] of Object.entries(values)) text = text.replaceAll(`{${name}}`, String(value));
  return text;
}
export function useCustomerText() {
  const { locale } = useI18n();
  return (key: keyof typeof translations.fr, values?: Record<string, string | number>) => customerText(locale, key, values);
}
