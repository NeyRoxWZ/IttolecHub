# 📋 Bug Report & Corrections — FoodGuessr Games
> Document généré le 27/02/2026 — Concis, logique, exhaustif

---

## ⚠️ Problèmes COMMUNS à TOUS les jeux

| # | Problème | Comportement attendu |
|---|---|---|
| C1 | Quand tous les joueurs ont répondu, ça ne passe pas automatiquement à la manche suivante | Dès que le dernier joueur répond → passer immédiatement à la manche suivante sans attendre le timer |
| C2 | Si un joueur n'est pas sur la page au changement de manche → il voit la réponse de la manche précédente | Synchronisation temps-réel : chaque joueur reçoit les données de la manche actuelle au moment où il charge/recharge la page |
| C3 | Fin de partie / dernière manche → rien ne se passe, pas de leaderboard | Après la dernière manche → afficher le leaderboard final automatiquement |
| C4 | Pas de leaderboard | Implémenter un leaderboard de fin de partie (score, rang, pseudo) |
| C5 | Pas de retour à la room | Bouton **"Retour à la room"** → revient dans le lobby pour rechoisir un jeu |
| C6 | Bouton **"Quitter"** → renvoie vers la page d'accueil du site | |
| C7 | Valider alors que tout le monde n'a pas répondu passe quand même la manche | Seul le timer ou la validation de TOUS les joueurs peut passer la manche |

---

## 🎵 RhymeGuessr

| # | Problème | Correction |
|---|---|---|
| R1 | On peut soumettre le mot identique à celui avec lequel on doit rimer | Validation côté serveur : rejeter toute réponse dont le mot soumis === mot cible (insensible à la casse, trim, sans accents) |
| R2 | Fin de dernière manche → rien ne se passe | Cf. C3 — Leaderboard + boutons retour/quitter |
| R3 | Pas de leaderboard | Cf. C4 |
| R4 | Pas de retour à la room | Cf. C5 / C6 |

**Règle R1 — Détail technique :**
```js
// Normalisation avant comparaison
function normalize(str) {
  return str.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
if (normalize(answer) === normalize(targetWord)) {
  // Rejeter : "Tu ne peux pas utiliser le mot cible lui-même !"
}
```

---

## 💰 PriceGuessr

| # | Problème | Correction |
|---|---|---|
| P1 | Pas de photo du produit | Ajouter un champ `image_url` dans le JSON des produits, afficher l'image dans la carte du round |
| P2 | Interface en anglais | Traduire 100% en français : labels, boutons, messages d'erreur, placeholders |
| P3 | Soumettre une réponse n'affiche rien / pas de feedback | Afficher confirmation "Réponse envoyée ✓" + bloquer le champ input après soumission |
| P4 | On peut entrer un nombre négatif | Validation : `min="0"` sur l'input + vérification serveur, rejeter les valeurs < 0 |
| P5 | Joueur pas sur la page → voit la réponse de la manche précédente | Cf. C2 |
| P6 | Fin de partie ne fonctionne pas | Cf. C3 / C4 / C5 / C6 |

---

## 🥗 CaloriesGuessr

| # | Problème | Correction |
|---|---|---|
| CA1 | "Chargement du plat..." à l'infini | L'appel API Open Food Facts échoue silencieusement. Ajouter un timeout (ex: 5s) + fallback sur un JSON local de plats hardcodés si l'API ne répond pas |
| CA2 | Pas de gestion d'erreur visible | Afficher "Impossible de charger le plat, passage au suivant..." et skip auto après 3s |

**Solution recommandée pour CA1 :**
- Pré-fetcher les N plats nécessaires au démarrage de la partie (pas round par round)
- Fallback JSON local avec ~50 plats + calories si Open Food Facts timeout

---

## 🏳️ FlagGuessr

| # | Problème | Correction |
|---|---|---|
| F1 | Premier drapeau s'affiche, mais valider passe au suivant même si tout le monde n'a pas répondu | Cf. C7 — bloquer la validation tant que tous les joueurs n'ont pas soumis OU que le timer n'est pas écoulé |
| F2 | "Chargement du drapeau..." à l'infini après le premier | L'appel REST Countries échoue après le 1er round. Pré-fetcher tous les drapeaux au démarrage de la partie (batch fetch) et les stocker en mémoire |

**Solution recommandée pour F2 :**
```js
// Au lancement de la partie, fetch tout en une fois
const res = await fetch("https://restcountries.com/v3.1/all?fields=name,flags");
const countries = await res.json();
// Shuffle + stocker dans state, piocher localement à chaque round
```

---

## 🌍 PopulationGuessr

| # | Problème | Correction |
|---|---|---|
| PO1 | Premier pays OK, valider → passe à une autre manche sans pays visible | Même cause que F1/F2 : fetch non-persistant. Pré-fetcher au démarrage |
| PO2 | Le pays disparaît après validation mais revient au reload | État du round mal synchronisé. Conserver le pays actuel dans le state serveur jusqu'à la fin du timer |
| PO3 | Entrer un nombre et valider → ne fonctionne pas | Vérifier que l'event listener submit est bien rattaché et que la valeur du slider/input est bien lue avant envoi |
| PO4 | Valider alors que tout le monde n'a pas fini → passe quand même | Cf. C7 |

---

## 🎶 LyricsGuessr

| # | Problème | Correction |
|---|---|---|
| L1 | Impossible d'ajouter plusieurs artistes | Permettre un champ multi-artistes (tags input) dans les paramètres de la room |
| L2 | Image de la cover ne s'affiche pas | Utiliser l'API **iTunes Search API** pour récupérer la cover : `https://itunes.apple.com/search?term={artiste}+{titre}&entity=song&limit=1` → champ `artworkUrl100` (100% gratuit, sans clé) |
| L3 | La même chanson revient plusieurs fois | Maintenir une liste des chansons déjà jouées côté serveur, exclure les doublons |
| L4 | Fin de dernière manche → rien ne se passe | Cf. C3 / C4 / C5 / C6 |
| L5 | Toujours les mêmes sons, Lyrics.ovh pas assez fourni | **Changer d'API → utiliser `lrclib.net`** : `https://lrclib.net/api/search?q={titre}` — gratuite, sans clé, base énorme (paroles synchronisées), CORS OK |

**Nouvelle API LyricsGuessr — lrclib.net :**
```
GET https://lrclib.net/api/search?q=eminem+lose+yourself
→ Retourne : trackName, artistName, albumName, plainLyrics, syncedLyrics
```
- Pas de clé requise
- Supporte FR, EN, ES, etc.
- Très large catalogue

---

## 🕵️ Infiltré — Règles corrigées + Bugs

### Règles correctes du jeu

**Rôles :**
- **Maître du Jeu (MJ)** : Connaît le mot secret. Répond uniquement par "Oui", "Non" ou "Je ne sais pas" aux questions des autres joueurs.
- **Citoyens** : Doivent deviner le mot secret en posant des questions au MJ. Gagnent s'ils trouvent le mot.
- **L'Infiltré** : Connaît aussi le mot secret. Son but est d'**empêcher** les Citoyens de le trouver en détournant subtilement les questions, sans se faire repérer.

**Déroulement :**
1. Distribution aléatoire des rôles (MJ, Citoyens, Infiltré)
2. Seuls MJ et Infiltré connaissent le mot secret
3. Les Citoyens posent des questions au MJ à tour de rôle
4. L'Infiltré joue comme un Citoyen mais tente discrètement de saboter
5. À tout moment, les joueurs peuvent voter pour éliminer un suspect

**Conditions de victoire :**

| Résultat | Gagnant |
|---|---|
| Les Citoyens devinent le mot secret | Citoyens |
| L'Infiltré est éliminé par vote | Citoyens |
| Le mot n'est pas trouvé ET l'Infiltré n'est pas éliminé | Infiltré |
| L'Infiltré fait éliminer un Citoyen à sa place | Infiltré |

### Bugs Infiltré

| # | Problème | Correction |
|---|---|---|
| I1 | Le but du jeu implémenté est incorrect | Réimplémenter selon les règles ci-dessus |
| I2 | La partie ne fonctionne pas / ne démarre pas | Déboguer le flux de démarrage, vérifier la distribution des rôles et l'affichage du mot secret au MJ + Infiltré uniquement |

---

## 🥷 Undercover — Règles corrigées + Bugs

### Règles complètes

**Setup :**
- 3 à 20 joueurs
- Une paire de mots secrets proches (ex : "chat" / "chien")
- Personne ne sait s'il est Civil ou Undercover au départ

**Les 3 rôles :**
- **Civils** : Reçoivent tous le même mot. Doivent éliminer tous les Undercovers.
- **Undercovers (Infiltrés)** : Reçoivent l'autre mot de la paire. Doivent survivre sans se faire repérer.
- **Mr. White** : Ne reçoit aucun mot. Doit improviser et tenter de deviner le mot des Civils.

**Les 3 phases (répétées en boucle) :**

1. **Phase de Description** — Chaque joueur décrit son mot avec UN seul mot ou une courte phrase. Mr. White improvise. Objectif : trouver ses alliés sans trahir le mot.
2. **Phase de Discussion** — Débat libre, construction d'alliances, identification des suspects. Mr. White en profite pour glaner des indices.
3. **Phase d'Élimination** — Vote. Le joueur avec le plus de votes est éliminé. **Si Mr. White est éliminé → il peut tenter de deviner le mot des Civils. S'il réussit : il gagne immédiatement.**

Ces 3 phases se répètent jusqu'à victoire.

**Conditions de victoire :**

| Résultat | Gagnant |
|---|---|
| Tous les Undercovers éliminés (sans que Mr. White devine le mot) | Civils |
| Les Undercovers sont en égalité numérique avec les Civils | Undercovers |
| Mr. White est éliminé et devine correctement le mot des Civils | Mr. White |
| Mr. White survit jusqu'à la fin | Mr. White |

### Bugs Undercover

| # | Problème | Correction |
|---|---|---|
| U1 | "Démarrage de la mission..." en boucle, sans erreur visible | Ajouter des logs côté serveur sur le flux de démarrage. Vérifier : (a) que le JSON des mots est bien chargé, (b) que la distribution des rôles se termine, (c) que l'événement socket "game:start" est bien émis |
| U2 | Règles du jeu implémentées incorrectement | Réimplémenter selon les règles complètes ci-dessus (3 rôles, 3 phases, conditions de victoire détaillées) |

**Checklist debug U1 :**
```
[ ] Le JSON des paires de mots est bien importé et non vide
[ ] La fonction de distribution des rôles retourne bien MJ + Civils + Mr. White
[ ] L'événement socket "room:start" → "game:ready" est bien émis à tous les clients
[ ] Le client écoute bien l'événement "game:ready" et redirige vers la page de jeu
[ ] Pas de race condition entre la création de la room et le démarrage
```

---

## ✅ Checklist globale de corrections prioritaires

### 🔴 Critique (bloquant)
- [ ] C1 — Auto-passage de manche quand tous ont répondu
- [ ] C2 — Sync état du round pour les joueurs hors page
- [ ] C3 — Leaderboard de fin de partie
- [ ] CA1 — CaloriesGuessr : infinite loading → batch fetch + fallback JSON
- [ ] F2 — FlagGuessr : infinite loading → batch fetch au démarrage
- [ ] PO1/PO2 — PopulationGuessr : pays qui disparaît → batch fetch
- [ ] U1 — Undercover : "Démarrage de la mission..." bloqué
- [ ] I1/I2 — Infiltré : règles incorrectes + partie non fonctionnelle

### 🟠 Important (expérience dégradée)
- [ ] C5/C6 — Boutons "Retour à la room" et "Quitter" sur tous les jeux
- [ ] P1 — PriceGuessr : photos produits manquantes
- [ ] P2 — PriceGuessr : 100% FR
- [ ] P4 — PriceGuessr : bloquer les valeurs négatives
- [ ] L5 — LyricsGuessr : changer pour lrclib.net
- [ ] L2 — LyricsGuessr : cover via iTunes API
- [ ] L3 — LyricsGuessr : anti-doublon chansons
- [ ] R1 — RhymeGuessr : interdire le mot cible en réponse

### 🟡 Mineur (polish)
- [ ] L1 — LyricsGuessr : multi-artistes
- [ ] P3 — PriceGuessr : feedback "Réponse envoyée ✓"
- [ ] C7 — Tous les jeux : bloquer validation si tout le monde n'a pas répondu

---
*FoodGuessr Bug Report v1.0 — 27/02/2026*
