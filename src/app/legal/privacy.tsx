import { LegalDoc } from '@/components/LegalDoc';

export default function Privacy() {
  return (
    <LegalDoc
      title="Confidentialité"
      subtitle="Protection des données (RGPD)"
      updated="10 juillet 2026"
      intro="Cette politique explique quelles données personnelles l'application Juste Debout collecte, pourquoi, et comment tu peux les contrôler. Le responsable de traitement est [Juste Debout — entité juridique à compléter], contact : [contact@justedebout.com]."
      sections={[
        {
          h: 'Données que nous collectons',
          body: [
            "• Compte : ton adresse e-mail (et mot de passe, stocké chiffré par notre prestataire).",
            "• Profil : nom, alias de danseur, pays, ville, photo, biographie, réseaux sociaux, disciplines, niveau, disponibilité pour la Juste Debout School.",
            "• Participation : tes inscriptions aux événements (danseur ou spectateur), tes billets, tes votes du public.",
            "• Contenu : les photos que tu envoies (avatar, photos de passage).",
            "• Données techniques minimales nécessaires au fonctionnement (identifiants de session).",
          ],
        },
        {
          h: 'Pourquoi nous les utilisons',
          body: [
            "Gérer ton compte et ton profil ; te permettre de t'inscrire aux événements et d'obtenir tes billets ; faire fonctionner le vote du public ; afficher l'annuaire des danseurs ; te mettre en relation avec la Juste Debout School si tu l'actives ; et améliorer l'application.",
            "Base légale : l'exécution du service que tu demandes (contrat) et ton consentement pour les traitements optionnels.",
          ],
        },
        {
          h: 'Assistant IA (Flow)',
          body: [
            "Lorsque tu utilises l'assistant Flow, tes messages sont transmis à notre prestataire d'intelligence artificielle (Anthropic) uniquement pour générer une réponse. N'y saisis pas d'informations sensibles.",
          ],
        },
        {
          h: 'Qui a accès à tes données',
          body: [
            "• Nos prestataires techniques (sous-traitants) : Supabase (hébergement de la base de données et des fichiers) et Anthropic (assistant IA).",
            "• Les organisateurs d'un événement, pour la liste des inscrits à cet événement uniquement.",
            "• Les autres utilisateurs, pour les informations publiques de ton profil (alias, ville, disciplines, photo) dans l'annuaire.",
            "Nous ne vendons jamais tes données.",
          ],
        },
        {
          h: 'Durée de conservation',
          body: [
            "Tes données sont conservées tant que ton compte existe. Si tu supprimes ton compte, elles sont effacées (voir ci-dessous), sauf obligation légale de conservation.",
          ],
        },
        {
          h: 'Tes droits',
          body: [
            "Conformément au RGPD, tu disposes des droits d'accès, de rectification, d'effacement, de portabilité, de limitation et d'opposition.",
            "Tu peux modifier ton profil à tout moment dans l'app, et supprimer ton compte (Réglages → Supprimer mon compte), ce qui efface tes données personnelles.",
            "Pour toute demande : [contact@justedebout.com]. Tu peux aussi saisir la CNIL.",
          ],
        },
        {
          h: 'Mineurs',
          body: [
            "Le Junior Dance Tour concerne des mineurs. L'inscription et l'usage de l'application pour un mineur doivent être réalisés avec l'accord et sous la responsabilité d'un parent ou représentant légal.",
          ],
        },
        {
          h: 'Sécurité',
          body: [
            "Les accès sont protégés par authentification et par des règles de sécurité au niveau de la base de données. Aucune transmission n'est toutefois garantie 100% sûre.",
          ],
        },
      ]}
    />
  );
}
