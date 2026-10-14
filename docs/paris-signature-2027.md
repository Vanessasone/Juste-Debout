# Paris 2027 : règlement signé, confirmation et photos

## Comportement

- Portée : inscriptions danseurs Juste Debout Paris uniquement. Les étapes étrangères gardent leur parcours sans signature imposée.
- Le dossier permet d’ajouter une photo par participant et une photo commune en 2 vs 2. Les photos sont facultatives à ce stade, privées, JPEG/PNG, maximum 5 Mo. Aucun droit de publication n’est déduit de cet ajout.
- Le règlement source est https://www.juste-debout-shop.com/reglement, capturé intégralement et figé en version `paris-2027-v1`. Le texte affiché et le texte envoyé par e-mail correspondent à ce même instantané.
- Chaque danseur signe avec son propre compte et son e-mail confirmé. Il saisit son nom complet et accepte le règlement. L’utilisateur peut partager le lien de signature avec son partenaire ; connaître le lien ne permet pas de signer à sa place.
- Pour le JDT, le compte du responsable légal identifié dans le dossier signe, pas le créateur du dossier s’il s’agit d’une autre personne.
- La preuve conserve le signataire, le nom saisi, l’heure serveur, la version du règlement et l’empreinte du dossier. C’est une signature par nom saisi et acceptation, pas une signature manuscrite dessinée ni une signature qualifiée.
- Toute modification du dossier avant soumission exige de nouvelles signatures. Un dossier soumis est gelé : correction via production.
- Le serveur refuse toute insertion/validation d’une inscription danseur Paris officielle sans toutes les signatures. Les anciens doublons Paris sont bloqués pour les nouvelles participations.
- La confirmation est mise en file après le statut `confirmed` ou `paid`, jamais après une simple sauvegarde de brouillon. Elle part vers chaque danseur ou vers le responsable légal JDT, contient le règlement intégral et l’attache au format TXT. Aucun participant n’est ajouté à une liste marketing.
- Le traitement reprend le dispatcher d’e-mails billetterie existant. Une clé d’idempotence par destinataire/inscription évite les doublons, avec reprise des tâches bloquées et tentatives espacées pour les erreurs temporaires.

## Déploiement à effectuer avant activation

1. Appliquer `supabase/sql/tour_registration_drafts_2027.sql` puis `supabase/sql/paris_registration_rules_photos.sql` (une seule fois chacun).
2. Vérifier les politiques Storage actuelles : aucune politique globale de lecture ne doit exposer le nouveau bucket `registration-photos`.
3. Déployer `send-ticket-emails` avec son nouveau module `paris-registration.ts`. Il utilise le secret de dispatch et la clé Resend billetterie déjà prévus par le dispatcher existant. Confirmer que le planning du dispatcher est actif.
4. Déployer les routes `/tour-register` et `/paris-rules-sign`, effectuer une recette avec deux comptes de test à e-mail confirmé et un compte parent, puis activer le parcours définitif seulement après fixation des tarifs et règles d’inscription restantes.
5. Le futur appel de validation doit fournir `parisDraftId` à `register()` et n’attribuer `paid`/`confirmed` qu’après paiement serveur ou validation de production.

Aucune migration, publication en production ou transmission réelle d’e-mail n’a été effectuée dans cette préparation.

## Tests

- `node tests/tour_registration.cjs`
- `node tests/paris_registration_sql.cjs` (Postgres embarqué PGlite, données fictives uniquement)
- `node tests/paris_registration_email.cjs` (envoi simulé uniquement)
- `npx tsc --noEmit`
- ESLint sur les routes et modules modifiés.
- Export Expo web vérifié. Recette visuelle/authentifiée sur une preview avec base configurée encore nécessaire avant activation.
