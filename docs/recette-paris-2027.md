# Juste Debout Paris 2027 — recette du 8 octobre 2026

## Déployé

Commit application : f4fa1a461de4247b33ac7b2ef3112e3f6d98a9d2.
Black Card personnalisée, QR du billet, avantages repris des éditions précédentes, contrôle explicite par événement.
Finales configurées : 13 et 14 mars 2027. Workshops et soirées doivent être rattachés aux événements du calendrier lorsqu'ils sont publiés ; aucun événement fictif n'a été créé en production.

## Tests de concurrence isolés

PostgreSQL 18, Vercel Sandbox temporaire arrêté après les tests. Fonctions de réservation et triggers extraits de Supabase, schémas de colonnes reproduits sans données clients. Il ne s'agit pas d'un test de charge de Stripe ni de l'infrastructure de production.
20 requêtes simultanées par scénario ; pour la dernière place, 1 acceptée et 19 refusées. Scénarios : stock Standard, capacité quotidienne Standard, cumul VIP 1 jour/week-end (112), stock Black Card (56). Vérification du nombre de commandes : aucune commande orpheline après refus.
Voir tests/concurrency_results.json. Le script exige JD_ALLOW_ISOLATED_RECIPE=1, refuse PGHOST et utilise seulement le socket PostgreSQL local d'un environnement jetable.

## Tests serveur en transactions annulées

Scanner interdit sans rôle autorisé ; utilisateur incapable de s'attribuer admin/scanner ; capacités 100/100/6000/6000 ; billet trop tôt refusé ; premier scan accepté ; second scan refusé ; billet annulé refusé ; tableau de bord actualisé.
QR annuel sur un autre événement explicitement inclus : accepté après utilisation du billet original ; événement non inclus, carte expirée et second passage refusés. Aucune carte ni aucun scan fictif conservé.

## Recette web sur le domaine définitif

HTTPS et application chargés. Pages ticket-success, ticket-cancel et shop-success lisibles, sans HTML brut ; sans session de paiement, elles n'affirment pas que le paiement est confirmé. Bandeau d'installation visible. Animation validée par Vanessa.

## Vérifications restant sur appareil réel

Caméra iPhone, enchaînement de scans, coupure/rétablissement du réseau et installation sur écran d'accueil. La connexion staff doit être utilisée ; ne pas scanner un véritable billet pour une simulation.
Les pass 3 et 4 jours restent désactivés. Aucun paiement réel nouveau effectué.
