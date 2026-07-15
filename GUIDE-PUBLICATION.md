# Juste Debout — Guide de publication (App Store & Play Store)

État : **application réelle** (backend Supabase, comptes, événements, inscriptions,
billets/QR, JD Live avec vote juges + vote public + départage, JD School, assistant IA,
gamification JD Points + palmarès/classement, écrans légaux, suppression de compte).

Ce guide couvre la mise en production. Suis les sections dans l'ordre.

---

## 0. Pré-vol backend (à faire une fois)

### a) Base de données — exécuter le schéma
Supabase → SQL Editor → coller **tout** `supabase/schema.sql` → Run. Il est **idempotent**
(relançable sans risque) et contient toutes les sections, dont les dernières :
- **16** — droits de création d'événements (admin/organisateur)
- **17** — vote du public (`public_votes`)
- **18** — palmarès (`passage_participants` + fonction `jd_leaderboard()`)
- **19** — JD Live+ (`commentaries` + temps réel, `predictions`, `ratings`, rôle `commentator`)
- **20** — Pronostics champions (`champion_predictions` + fonctions `jd_startlist` / `jd_finale_winners` / `jd_my_champion_score` / `jd_pronostiqueurs`)

### b) Edge Functions — déployer
Nécessite la CLI Supabase (`brew install supabase/tap/supabase` ou npm), puis :
```bash
cd ~/Documents/juste-debout
supabase login
supabase link --project-ref <ton-ref-projet>   # visible dans l'URL du dashboard

# Assistant IA (nécessite une clé Anthropic : console.anthropic.com)
supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxxxx
supabase functions deploy companion

# Suppression de compte (aucun secret : service_role auto-injecté)
supabase functions deploy delete-account

# Commentaire & analyse IA du direct (réutilise ANTHROPIC_API_KEY)
supabase functions deploy commentary
```

> Le rôle **commentator** se donne à un utilisateur en ajoutant `'commentator'` à
> `profiles.roles` (SQL Editor). Les rôles organizer/staff/admin ont déjà l'accès console.

### c) Authentification
Supabase → Authentication → **Confirm email = ON** (le code gère déjà la confirmation).

### d) Légal
Compléter les `[À COMPLÉTER]` dans `src/app/legal/{terms,privacy,notice}.tsx`
(dénomination sociale, adresse, SIRET, email de contact) et **faire relire par un juriste**.
Héberger la **politique de confidentialité sur une URL publique** (exigée par les stores) —
tu peux publier le même texte sur une page web simple.

---

## 1. Comptes développeur (obligatoire)

| Store | Coût | Lien | Délai |
|-------|------|------|-------|
| **Apple Developer Program** | 99 $/an | https://developer.apple.com/programs/ | 24-48 h de validation |
| **Google Play Console** | 25 $ (une fois) | https://play.google.com/console/signup | quelques heures |

Il te faut aussi un **compte Expo** (gratuit) : https://expo.dev

---

## 2. Configuration du projet (DÉJÀ FAITE)

- `app.json` : `ios.bundleIdentifier` = `com.justedebout.app`, `android.package` = `com.justedebout.app`,
  icône iOS sans alpha (`icon-ios.png`), splash, permissions caméra/photos.
- `eas.json` : profils `development`, `preview`, `production` + `submit`.
- `expo-doctor` : **20/20 checks OK**.

> Si tu veux un autre identifiant que `com.justedebout.app`, change-le dans `app.json`
> **avant** le premier build (il ne pourra plus changer après publication).

---

## 3. Build & soumission avec EAS

```bash
cd ~/Documents/juste-debout

# 1. Connexion Expo + initialisation du projet EAS (crée le projectId)
npx eas-cli login
npx eas-cli init

# 2. (option recommandée) build de test interne à installer sur ton téléphone
npx eas-cli build --profile preview --platform android   # APK direct
npx eas-cli build --profile development --platform ios    # à ouvrir dans Expo Dev Client

# 3. Builds de PRODUCTION (cloud, ~15-20 min chacun)
npx eas-cli build --profile production --platform ios
npx eas-cli build --profile production --platform android

# 4. Soumission aux stores
npx eas-cli submit --profile production --platform ios
npx eas-cli submit --profile production --platform android
```

- **iOS** : le build arrive sur **TestFlight** (test interne) ; ensuite tu soumets à la review Apple.
- **Android** : commence en **test interne**, puis promeus en **production**.
- EAS a un quota gratuit ; au-delà, file d'attente plus longue ou plan payant.

### Variables d'environnement pour le build
Les clés `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` (fichier `.env`) sont
**publiques** et embarquées. Pour qu'EAS les injecte au build, ajoute-les comme
**EAS Environment Variables** (dashboard Expo → projet → Environment variables, visibilité
« plaintext ») ou garde le `.env` — vérifie qu'elles sont bien présentes dans le build de test.

---

## 4. Fiche store — à préparer

- [ ] **Nom** : Juste Debout — **Sous-titre** court (ex. « Les danses debout »)
- [ ] **Description** (FR + EN) : événements, inscription, vote en direct, profil, JD School
- [ ] **Mots-clés** : street dance, hip-hop, house, popping, danse, événement, compétition
- [ ] **Captures d'écran** par taille (Accueil, Live/vote, Profil/palmarès, Inscription, JD School)
- [ ] **Icône** 1024×1024 (déjà en place)
- [ ] **URL politique de confidentialité** (obligatoire) + URL support
- [ ] **Catégorie** : Sports (ou Réseaux sociaux) — **Classification d'âge** (Junior = mineurs)
- [ ] **Compte de démonstration** pour les reviewers (email + mot de passe d'un compte test)

> ⚠️ **Vocabulaire** : ne pas utiliser « battle » dans les textes store. Juste Debout parle
> d'« échanges », « rencontres », « passages ».

---

## 5. Paiements (plus tard — Stripe)

Non inclus pour l'instant (volontairement, tout à la fin). Rappel de cadrage :
- **Billetterie d'événements physiques** et **services marketplace** → Stripe autorisé.
- **Biens numériques** (abonnement JD+, formations/replays payants) → **achats intégrés
  Apple/Google obligatoires** (commission 15-30 %). À arbitrer avant d'activer ces features.

---

## 6. Récap de l'état du code

Tech : **Expo SDK 57 · React Native 0.86 · Expo Router · TypeScript · Supabase**.
Vérifs projet :
```bash
node node_modules/typescript/bin/tsc --noEmit     # typage (0 erreur)
npx expo export --platform web                     # bundle web (OK)
npx expo-doctor                                     # 20/20
```

Backend & fonctions : `supabase/schema.sql`, `supabase/functions/{companion,delete-account}`.
Le mock (`src/data/mock.ts`) ne fournit plus que des constantes (liste de disciplines) —
tous les écrans affichent du réel ou un « Bientôt disponible » honnête.
