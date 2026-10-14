# Inscriptions danseurs 2027 — préparation

Route préparée : `/tour-register`. Pas de lien public ajouté au menu, pas d'ouverture des inscriptions, pas de paiement, pas d'e-mail de confirmation envoyé. Le bouton sauvegarde exclusivement un brouillon privé, jamais une inscription définitive.

## Périmètre validé par Vanessa le 14 octobre 2026

| Étape | Jour de compétition | Disciplines | JDT |
|---|---|---|---|
| Chongqing | 20 décembre 2026 | Locking, Popping, House, Hip Hop | Oui |
| Tokyo | 4 janvier 2027 | Locking, Popping, House, Hip Hop | Non |
| Milan | 13 février 2027 | Locking, Popping, House, Hip Hop | Oui |
| Pays-Bas | 27 février 2027 | Locking, Popping, House, Hip Hop | Non |
| Liège | 6 mars 2027 | Locking, Popping, House, Hip Hop | Non |
| Londres | 7 mars 2027 | Hip Hop, Popping, Afro, Krump | Non |
| Paris prélims | 11–12 mars 2027 | Classic + Afro, Dancehall, Electro, Krump | Oui |

Paris finales : 13–14 mars 2027, Stade Pierre de Coubertin. Adresse des prélims à communiquer. JDT solo all styles, 6–14 ans inclus au 13 mars 2027, naissance du 14 mars 2012 au 13 mars 2021 inclus. Toutes les autres disciplines : 2 vs 2.

## Installation et recette

Appliquer `supabase/sql/tour_registration_drafts_2027.sql` avant de déployer la route. Le SQL ne modifie ni les anciennes inscriptions ni les billets. Les brouillons sont privés au compte qui les crée (RLS SELECT/INSERT/UPDATE), sans accès anonyme ni visibilité pour les organisateurs. Une sauvegarde remplace le brouillon du même compte, de la même édition et de la même discipline. Le formulaire permet de reprendre ce brouillon. Aucun stockage local persistant des données des mineurs.

Tester : choisir Londres (seulement 4 catégories, aucun JDT), Milan (JDT visible), les quatre dates de naissance limites, une date impossible, un binôme incomplet, une autorisation parentale manquante. Vérifier un compte connecté et un compte déconnecté, puis l'absence de lecture/modification du brouillon d'un autre compte.

## Suite avant inscription définitive

- Fixer tarifs/devise par édition, gratuité éventuelle, dates d'ouverture/clôture et jauges.
- Décider des inscriptions multiples et des partenaires différents : les brouillons n'autorisent aucune participation définitive.
- Relier chaque étape à un événement canonique et son organisateur : le catalogue live contient des doublons Milan et Paris, deux anciennes dates Paris, et ne contient pas encore Londres/Pays-Bas. Ne pas réaffecter les billets sans audit.
- Ajouter serveur de validation et paiement par organisateur, statut confirmé, confirmation e-mail, espace organisateur/export/contrôle de présence et parcours des qualifiés internationaux.
- Finaliser les libellés multilingues et intégrer la route dans le menu après recette.

Cette étape est une préparation testable des formulaires et de leurs brouillons ; elle ne prétend pas réaliser les fonctions ci-dessus.
