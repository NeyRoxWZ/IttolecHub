# PLAN DE CORRECTION — SITE DE JEUX MULTIJOUEUR

> **Pour l'IA** : Tu as accès au code existant. CalorieGuesser est le jeu de référence UI/UX — tous les autres jeux doivent lui ressembler exactement. Lis son code avant de toucher aux autres jeux. Traite les sections dans l'ordre.

---

## ⚠️ NOTE SUR LES APIS

Toutes les APIs listées dans ce plan sont **100% gratuites et sans limite bloquante** pour un usage normal. Aucune carte bancaire requise.

---

## 1 — INFRASTRUCTURE MULTIJOUEUR (Supabase)

C'est la base. Tout le reste en dépend.

**Problèmes à régler :**
- Un joueur qui rejoint une room ne voit pas les autres joueurs
- Un non-host peut modifier les paramètres et lancer la partie
- Le lancement d'une partie ne se propage pas à tous les joueurs
- La manche suivante ne attend pas que tous aient répondu

**Ce qu'il faut faire :**
- Regarder le schéma Supabase existant et l'adapter pour stocker : liste des joueurs par room, qui est le host, le statut de la room (`waiting` / `in_game`), la config de partie, les réponses par joueur et par manche
- Activer **Supabase Realtime** sur les tables rooms et joueurs pour que tout se synchronise en direct
- Le lancement de partie = le host met le statut à `in_game` → tous les clients redirigent automatiquement
- La manche suivante ne démarre que quand tous les joueurs ont soumis leur réponse
- Les non-hosts voient les paramètres en lecture seule (grisés), mis à jour en temps réel

---

## 2 — CHARTE GRAPHIQUE UNIFIÉE

**Référence : CalorieGuesser** (déjà implémenté et fonctionnel)

- Lire le code de CalorieGuesser
- Appliquer la même interface à **tous** les autres jeux : timer, liste joueurs, zone réponse, écran résultat de manche, écran fin de partie, couleurs, typographie, animations
- Seule la zone de contenu central change selon le jeu (image aliment → sprite Pokémon → drapeau → etc.)
- **Dark mode / Light mode** : ajouter un toggle (icône lune/soleil) dans le header, présent sur toutes les pages. Persister le choix dans `localStorage`.

---

## 3 — ANTI-RÉPÉTITION (tous les jeux)

Au lancement de chaque partie, générer la liste complète des éléments de la session (N éléments pour N manches) et les stocker. Piocher séquentiellement — jamais de répétition dans une même partie.

---

## 4 — CORRECTIONS PAR JEU

---

### CalorieGuesser
**Problème :** images des aliments ne s'affichent pas

**API :**
- **Open Food Facts** — `https://world.openfoodfacts.org/api/v2/product/{barcode}.json`
  - Champ image : `product.image_front_url`
  - Calories : `product.nutriments['energy-kcal_100g']`
  - Entièrement gratuit, +3M produits, pas de clé requise
- Fallback si image null → afficher une icône générique

---

### PokéGuesser
**Problème :** pas de sélection des générations

**API :**
- **PokéAPI** — `https://pokeapi.co/api/v2/generation/{id}/` (id de 1 à 9)
  - Retourne la liste des Pokémons de la génération
  - Image HD : `https://pokeapi.co/api/v2/pokemon/{id}/` → `sprites.other['official-artwork'].front_default`
  - Gratuit, illimité, sans clé

**À faire :** ajouter dans la config host des checkboxes Gen 1 à Gen 9. Au lancement, fetch les Pokémons des gens cochées, mélanger, stocker pour la session.

---

### FlagGuesser
**Problèmes :** drapeaux ne s'affichent pas, restart cassé

**APIs :**
- **RestCountries** — `https://restcountries.com/v3.1/all?fields=name,flags,region`
  - `flags.png` : image du drapeau
  - `name.translations.fra.common` : nom français du pays
  - Gratuit, sans clé, 250 pays
- **Filtrage par région possible :** `/region/europe`, `/region/africa`, etc.

**À faire :** corriger le restart (reset complet de l'état local + régénérer la liste des drapeaux). Ajouter paramètres host : région, nombre de manches, timer.

---

### PopulationGuesser
**Problèmes :** manches qui passent sans rien afficher, pas de visuels

**APIs :**
- **Teleport API** — `https://api.teleport.org/api/urban_areas/` (gratuit, sans clé)
  - Photos : `/urban_areas/slug:{slug}/images/`
  - Données : `/urban_areas/slug:{slug}/details/` → population, qualité de vie
  - ~260 grandes villes mondiales
- Pour compléter avec plus de villes : utiliser un dataset JSON statique (ex: `simplemaps/world-cities` sur GitHub, licence gratuite) pour les petites villes hors Teleport

**À faire :** afficher nom de la ville + pays + photo avant de demander la population. Score basé sur la proximité de la réponse. Corriger la progression des manches.

---

### LyricsGuesser
**Problème :** artistes francophones (PLK, etc.) non trouvés

**APIs :**
- **lyrics.ovh** — `https://api.lyrics.ovh/v1/{artiste}/{titre}` (gratuit, sans clé)
  - Bonne couverture des artistes francophones
  - Retourne les paroles complètes directement
- **Fallback — Genius API** — `https://api.genius.com/search?q={artiste}` (gratuit avec clé gratuite)
  - Base de données massive, quasi-exhaustive
  - L'API ne donne pas les paroles directement → scraping de la page Genius nécessaire pour les récupérer

**À faire :** essayer lyrics.ovh en premier, fallback Genius si non trouvé. Normaliser les noms (minuscules, sans accents) pour la recherche.

---

### RimeGuesser
**Problèmes :** certaines rimes valides refusées. Faire rimer des **phrases** (pas des mots isolés).

**Nouveau concept :** afficher une phrase → le joueur propose une phrase dont le dernier mot rime avec le dernier mot de la phrase affichée.

**APIs :**
- **Datamuse API** — `https://api.datamuse.com/words?rel_rhy={mot}` (gratuit, sans clé, illimité)
  - Retourne les mots qui riment parfaitement
  - `rel_nry={mot}` pour les rimes approximatives
- Validation : extraire le dernier mot de la phrase du joueur → vérifier s'il est dans la liste Datamuse

**À faire :** créer une banque de phrases en français (fichier JSON statique, 200+ phrases), implémenter la validation phonétique avec Datamuse en fallback sur une comparaison des 3 dernières lettres.

---

### L'Infiltré
**Problèmes :** host non détecté, rôle affiché avant distribution, flow de jeu incomplet

**Rappel des règles :**
- 1 mot secret choisi
- Majorité = Citoyens (connaissent le mot)
- 1 joueur = Infiltré (ne connaît PAS le mot)
- Les citoyens posent des questions Oui/Non au host pour faire deviner le mot
- L'infiltré essaie de se fondre dans la masse
- But : identifier l'infiltré

**À faire :**
- Corriger la détection host (lire comment CalorieGuesser ou la room le gère et répliquer)
- Ne jamais afficher de rôle avant que le host ait cliqué "Distribuer les rôles"
- Implémenter le flow complet : Lobby → Distribution des rôles (privés par joueur) → Phase questions → Vote → Résultat → Manche suivante
- Chaque joueur voit uniquement son propre rôle
- Paramètres host : catégorie du mot, difficulté, timer, nombre de manches
- Utiliser le fichier `infiltre.json` (déjà généré, 959 mots) comme source de mots

---

### Undercover
**Problèmes :** même bug host que L'Infiltré

**Rappel des règles :**
- Majorité = Civils (reçoivent Mot 1)
- 1 joueur = Undercover (reçoit Mot 2, très proche du Mot 1)
- 1 joueur optionnel = Mister White (ne reçoit aucun mot)
- Chacun donne un indice à voix haute pour se justifier

**À faire :**
- Même correction host que L'Infiltré
- Flow complet : Lobby → Distribution (mots privés) → Tour d'indices → Vote → Résultat
- **Paramètres simplifiés :** toujours exactement 1 undercover (pas de choix), toggle On/Off pour activer Mister White
- Utiliser le fichier `undercover.json` (déjà généré, 522 paires) comme source de paires de mots

---

### CompleteGuesser — SUPPRIMER
Supprimer entièrement : fichiers, routes, références dans la nav et la home.

---

## 5 — PAGE D'ACCUEIL (Refonte)

La page actuelle est à refaire entièrement. Elle doit être moderne, donner envie de jouer, et être parfaitement responsive mobile.

**Structure :**
1. **Navbar** : logo + toggle dark/light + burger menu sur mobile
2. **Hero** : titre accrocheur, sous-titre, boutons "Créer une Room" et "Rejoindre une Room"
3. **Grille des jeux** : une card par jeu avec nom, icône, description en 1 ligne (sans CompleteGuesser)
4. **Comment jouer** : 3 étapes visuelles (Créer → Inviter → Jouer)
5. **Footer** : logo, liens, mentions légales

**Jeux à afficher dans la grille :**
CalorieGuesser 🍔 · PokéGuesser ⚡ · FlagGuesser 🏳️ · PopulationGuesser 🏙️ · LyricsGuesser 🎵 · RimeGuesser ✍️ · L'Infiltré 🕵️ · Undercover 🎭

**Mobile :**
- Burger menu obligatoire (les boutons actuels sont cassés sur mobile)
- CTA hero en colonne sur mobile
- Cards en 1 colonne mobile, 2 tablet, 3-4 desktop
- Boutons minimum 44px de hauteur

---

## 6 — CHECKLIST FINALE

- [ ] Supabase Realtime actif, joueurs visibles dans la room
- [ ] Host détecté correctement sur tous les jeux
- [ ] Non-hosts : lecture seule, mise à jour en temps réel
- [ ] Lancement de partie synchronisé pour tous
- [ ] Manche suivante = tous les joueurs ont répondu
- [ ] Aucune répétition d'élément dans une session
- [ ] Tous les jeux = interface identique à CalorieGuesser
- [ ] Dark/Light mode partout, persisté
- [ ] CalorieGuesser : images affichées
- [ ] PokéGuesser : sélection générations 1-9
- [ ] FlagGuesser : drapeaux affichés, restart corrigé
- [ ] PopulationGuesser : villes + photos, manches correctes
- [ ] LyricsGuesser : artistes FR trouvés
- [ ] RimeGuesser : validation par phrases
- [ ] L'Infiltré : flow complet fonctionnel
- [ ] Undercover : flow complet, toggle Mister White
- [ ] CompleteGuesser : supprimé
- [ ] Page d'accueil refaite
- [ ] Tout fonctionne sur mobile
