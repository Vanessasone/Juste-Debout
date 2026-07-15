/**
 * Pays → drapeau. Accepte un code ISO (FR) ou un nom français (« France », « Chine »).
 */
import { flagEmoji } from '@/lib/vote';

const NAME_TO_CODE: Record<string, string> = {
  france: 'FR', chine: 'CN', japon: 'JP', italie: 'IT', 'corée du sud': 'KR', corée: 'KR',
  espagne: 'ES', portugal: 'PT', allemagne: 'DE', 'royaume-uni': 'GB', angleterre: 'GB',
  'états-unis': 'US', 'etats-unis': 'US', usa: 'US', sénégal: 'SN', senegal: 'SN', ghana: 'GH',
  mexique: 'MX', brésil: 'BR', bresil: 'BR', canada: 'CA', belgique: 'BE', suisse: 'CH',
  'pays-bas': 'NL', maroc: 'MA', tunisie: 'TN', algérie: 'DZ', algerie: 'DZ', "côte d'ivoire": 'CI',
  nigéria: 'NG', nigeria: 'NG', 'afrique du sud': 'ZA', australie: 'AU', russie: 'RU',
  ukraine: 'UA', pologne: 'PL', suède: 'SE', suede: 'SE', norvège: 'NO', danemark: 'DK',
  finlande: 'FI', autriche: 'AT', grèce: 'GR', grece: 'GR', turquie: 'TR', inde: 'IN',
  thaïlande: 'TH', thailande: 'TH', vietnam: 'VN', indonésie: 'ID', indonesie: 'ID',
  philippines: 'PH', taïwan: 'TW', taiwan: 'TW', 'hong kong': 'HK', singapour: 'SG',
  chili: 'CL', argentine: 'AR', colombie: 'CO', pérou: 'PE', perou: 'PE',
};

export function countryFlag(input?: string | null): string {
  if (!input) return '';
  const t = input.trim();
  if (/^[A-Za-z]{2}$/.test(t)) return flagEmoji(t);
  const code = NAME_TO_CODE[t.toLowerCase()];
  return code ? flagEmoji(code) : '';
}
