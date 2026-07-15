import { LegalDoc } from '@/components/LegalDoc';

export default function Notice() {
  return (
    <LegalDoc
      title="Mentions légales"
      subtitle="Éditeur & hébergement"
      updated="10 juillet 2026"
      sections={[
        {
          h: 'Éditeur de l\'application',
          body: [
            "[Juste Debout — dénomination sociale à compléter]",
            "Forme juridique et capital : [à compléter]",
            "Siège social : [adresse à compléter]",
            "Immatriculation (SIRET / RCS) : [à compléter]",
            "Contact : [contact@justedebout.com]",
          ],
        },
        {
          h: 'Directeur de la publication',
          body: ['[Nom du responsable — à compléter]'],
        },
        {
          h: 'Hébergement',
          body: [
            "Base de données, authentification et stockage : Supabase.",
            "Distribution et build de l'application : Expo (Expo Application Services).",
            "Assistant IA : Anthropic.",
          ],
        },
        {
          h: 'Marque',
          body: [
            "« Juste Debout » et son identité visuelle sont des marques et créations protégées. Tous droits réservés.",
          ],
        },
        {
          h: 'Contact',
          body: [
            "Pour toute question relative à l'application ou à ces mentions : [contact@justedebout.com].",
          ],
        },
      ]}
    />
  );
}
