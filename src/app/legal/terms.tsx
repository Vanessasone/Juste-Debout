import { LegalDoc } from '@/components/LegalDoc';

export default function Terms() {
  return (
    <LegalDoc
      title="CGU"
      subtitle="Conditions générales d'utilisation"
      updated="14 octobre 2026"
      intro="Les présentes conditions régissent l'utilisation de l'application Juste Debout, éditée par [Juste Debout — entité juridique à compléter]. En créant un compte, tu les acceptes."
      sections={[
        {
          h: 'Objet',
          body: [
            "L'application permet de découvrir les événements Juste Debout, s'y inscrire (danseur ou spectateur), obtenir un billet, suivre les rencontres en direct, voter en tant que public, gérer son profil de danseur et accéder à la Juste Debout School.",
          ],
        },
        {
          h: 'Compte',
          body: [
            "Tu dois fournir des informations exactes et garder ton mot de passe confidentiel. Tu es responsable de l'activité réalisée depuis ton compte. Un compte est personnel.",
          ],
        },
        {
          h: 'Règles de bonne conduite',
          body: [
            "Tu t'engages à ne pas publier de contenu illégal, haineux, diffamatoire ou portant atteinte aux droits d'autrui, à ne pas usurper l'identité d'un tiers, et à respecter l'esprit de la communauté street dance.",
            "Tout abus (triche au vote, contenu inapproprié, harcèlement) peut entraîner la suspension du compte.",
          ],
        },
        {
          h: 'Contenu que tu publies',
          body: [
            "Tu restes propriétaire des photos et informations que tu publies. Tu nous accordes le droit de les afficher dans l'application pour les besoins du service (profil, annuaire, écrans de passage). Tu garantis disposer des droits nécessaires sur les photos que tu envoies.",
          ],
        },
        {
          h: 'Vote et résultats',
          body: [
            "Le vote officiel est réservé aux juges désignés par Juste Debout. Le vote du public est indicatif et peut servir de départage en cas d'égalité. Les résultats officiels relèvent de la décision de l'organisation.",
          ],
        },
        {
          h: 'Propriété intellectuelle',
          body: [
            "La marque « Juste Debout », les logos, l'identité visuelle et le contenu de l'application sont protégés. Toute reproduction sans autorisation est interdite.",
          ],
        },
        {
          h: 'Billets',
          body: [
            "Toute commande de billets est ferme et définitive après confirmation du paiement. Les billets ne sont ni repris ni échangés à la demande de l’acheteur, sauf dispositions légales impératives applicables.",
            "Les prestations de loisirs fournies à une date ou période déterminée ne bénéficient pas du droit de rétractation de 14 jours, conformément à l’article L221-28, 12° du Code de la consommation, lorsque ses conditions sont réunies.",
            "En cas d’annulation ou de modification substantielle de l’événement, les droits légaux de l’acheteur restent applicables. Les modalités de réclamation sont communiquées par l’organisateur.",
          ],
        },
        {
          h: 'Responsabilité',
          body: [
            "L'application est fournie « en l'état ». Nous mettons tout en œuvre pour assurer sa disponibilité mais ne garantissons pas une absence totale d'interruption ou d'erreur.",
          ],
        },
        {
          h: 'Résiliation',
          body: [
            "Tu peux supprimer ton compte à tout moment depuis les Réglages. Nous pouvons suspendre un compte en cas de non-respect des présentes conditions.",
          ],
        },
        {
          h: 'Droit applicable',
          body: [
            "Les présentes conditions sont soumises au droit français. En cas de litige, une solution amiable sera recherchée en priorité.",
          ],
        },
      ]}
    />
  );
}
