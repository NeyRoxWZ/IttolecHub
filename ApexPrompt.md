# PROMPT COMPLET — APEX (Idle Game)
> Remplace TerraFarm dans le projet Itollec — À copier-coller directement dans Trae / Cursor

---

## CONTEXTE

Ce jeu remplace TerraFarm sur la plateforme Itollec. Il s'intègre dans le même système de compte (Supabase, sauvegarde cloud toutes les 30 secondes, localStorage en backup). Il utilise les mêmes tables `users` et `game_saves` avec `game_slug = "apex"`. **Lire la direction artistique existante du site avant de coder quoi que ce soit.**

---

## CONCEPT GÉNÉRAL

**APEX** est un jeu idle de gestion d'empire du divertissement. Le joueur commence avec 10 000 ₶ et bâtit progressivement un empire couvrant le cinéma, la musique, les séries, les événements live, les jeux vidéo, la crypto et la bourse fictive. Chaque secteur est débloqué progressivement selon le capital cumulé. Le jeu ne propose pas de clics répétitifs : il propose des **décisions**.

**Devise :** Apex Coins (₶) — même symbole que ItollecClicker, cohérence visuelle.

**URL du jeu :** `/apex`

---

## PHILOSOPHIE DE PROGRESSION

- Investir 2 000 ₶ dans un film ne rapporte pas 200 000 ₶. Ça rapporte 2 200 à 2 800 ₶ si tout va bien.
- La progression est lente et maîtrisée. Le joueur sent qu'il avance sans s'enrichir trop vite.
- Chaque décision a du poids. Une mauvaise allocation peut stagner le joueur plusieurs minutes.
- Un événement positif ou une opportunité toutes les 5 à 15 minutes pour maintenir la dopamine.
- Le joueur doit toujours avoir UN objectif atteignable devant lui (débloquer le secteur suivant, signer un meilleur artiste, produire son premier blockbuster).
- Les grands bénéfices arrivent quand le joueur maîtrise les mécaniques (bonne pub + bon réal + bon casting = film rentable), pas au hasard.

---

## DONNÉES — NOMS GÉNÉRÉS PAR IA (pré-générés, stockés en JSON local)

**Ne pas utiliser d'API externe.** Tous les noms sont pré-générés une fois et stockés dans `/data/apex-names.json`.

### Prompt à envoyer à une IA pour générer ce fichier

> Génère un fichier JSON avec exactement ces clés :
> - `"films"` : liste de 3000 titres de films fictifs en français et en anglais, variés (action, drame, horreur, comédie, SF, romance, documentaire, animation). Style réaliste, certains sérieux, certains drôles, certains clichés volontairement.
> - `"artistes"` : liste de 3000 noms d'artistes musicaux fictifs (chanteurs, rappeurs, groupes, DJ, chanteuses). Mix de styles : rap, pop, rock, électro, variété française, jazz.
> - `"realisateurs"` : liste de 500 noms de réalisateurs fictifs.
> - `"acteurs"` : liste de 1000 noms d'acteurs et actrices fictifs.
> - `"showrunners"` : liste de 300 noms de showrunners fictifs.
> - `"studios_jv"` : liste de 200 noms de studios de jeux vidéo fictifs.
> - `"noms_series"` : liste de 1500 titres de séries fictives.
> - `"noms_jeux"` : liste de 1000 titres de jeux vidéo fictifs.
>
> **CONTRAINTE ABSOLUE** : aucun prénom, nom ou surnom ne doit apparaître dans deux catégories différentes. Chaque identité est unique et exclusive à sa catégorie. Vérifie l'unicité globale avant de retourner le JSON. Retourne uniquement le JSON brut, sans markdown, sans commentaire.

### Implémentation du tirage
Ce fichier est chargé au démarrage du jeu et mis en cache. Chaque entité (artiste, réalisateur, acteur…) est tirée aléatoirement depuis sa liste **sans remise** tant que la liste n'est pas épuisée (puis on recommence depuis le début).

---

## SYSTÈME DE HYPE

Chaque projet (film, série, album, jeu vidéo, événement) possède une jauge de **Hype** (0 à 100).

**La hype monte via :**
- Budget publicitaire investi avant/pendant la sortie
- Événements positifs (prix, bouche-à-oreille fictif)
- Featuring ou synergies entre secteurs

**La hype descend via :**
- Décroissance exponentielle naturelle avec le temps
- Scandales ou flops

**Effets de la hype :**
- Influence directement les revenus passifs générés
- Détermine l'intérêt et le prix proposé par les acheteurs de droits
- Visible sous forme de barre colorée (vert → orange → rouge) sur chaque carte projet

**Règles de timing :**
- Fenêtre de hype maximale : les 10 premières minutes après une sortie
- Embargo de sortie : impossible de vendre les droits de diffusion avant 30 minutes après la sortie (délai réaliste : sortie exclusive en salle/plateformes avant la revente)
- Hype morte : en dessous de 10, les acheteurs refusent les négociations ("trop vieux, plus d'intérêt commercial")

---

## SYSTÈME DE NÉGOCIATION (générique, commun à tous les secteurs)

Ce système est utilisé à chaque fois qu'un droit est vendu (diffusion, international, sync, licence…).

### Étapes

1. **Estimation affichée** : le jeu calcule et affiche le prix auquel la probabilité de vente est la plus haute (ex : 2 480 ₶ = 85% de chances). Cette estimation est visible par le joueur.
2. **Le joueur fixe son prix** : il peut demander plus (probabilité baisse) ou moins (probabilité monte). Un curseur ou un champ numérique permet l'ajustement. La probabilité se met à jour en temps réel.
3. **Lancement de la négociation** : résultat immédiat — succès ou refus.
4. **En cas de refus** :
   - L'acheteur reste disponible pour une nouvelle tentative
   - À chaque refus consécutif, sa probabilité d'accepter baisse de 8%
   - Au bout de 3 refus : l'acheteur se retire définitivement ("Nous ne sommes plus intéressés")
5. **Facteurs qui influencent le prix accepté** :
   - Hype actuelle du projet (plus elle est haute, plus les acheteurs paient)
   - Réputation du joueur dans ce secteur
   - Ancienneté du projet (décote temporelle)
   - Événements en cours (golden age = acheteurs généreux, crise = acheteurs durs)
6. **Acheteurs disponibles par projet** : 3 à 5 acheteurs fictifs, chacun avec une personnalité affichée (ex: "Offre prudente — rarement pressé", "Offre généreuse — décide vite")

---

## SECTEUR 1 — CINÉMA
### Débloqué dès le départ

### Lancer un film

Le joueur configure son film via un panneau de création :

- **Genre** : Action / Drame / Comédie / Horreur / SF / Animation / Documentaire / Romance
- **Budget de production** : min 500 ₶, pas de maximum. Plus le budget est élevé, plus le potentiel est haut, mais le risque aussi.
- **Réalisateur** : choisir dans un catalogue (tirés du JSON `realisateurs`). Niveau 1 à 5, prix croissant, influence sur le score de qualité final. Certains ont des spécialités de genre (bonus si genre correspondant).
- **Casting** : 1 à 5 acteurs (tirés du JSON `acteurs`). Chacun coûte et booste la hype potentielle et le score public.
- **Budget publicitaire** : slider de 0% à 100% du budget de production.
  - 0% : hype initiale = 5. Même un excellent film passera inaperçu.
  - 25% : hype initiale = 30. Équilibre rentable pour les petits budgets.
  - 50% : hype initiale = 55. Bon équilibre général.
  - 100% : hype initiale = 90. Très coûteux. Si le film est mauvais, la déception est visible et nuit à la réputation.
- **Avant-première** : option payante (200 ₶), boost hype initiale +15 supplémentaire.

**Durée de production (temps réel) :**
- Court-métrage (budget < 1 000 ₶) : 2 min
- Film indépendant (1 000 – 10 000 ₶) : 5 min
- Film standard (10 000 – 100 000 ₶) : 10 min
- Blockbuster (> 100 000 ₶) : 20 min
- Saga (> 500 000 ₶) : 35 min

**Calcul du score de qualité (0–100) à la sortie :**
- Base budget (30%) + niveau réalisateur (25%) + casting (20%) + part aléatoire (25%)
- Score < 30 = flop | Score 30–60 = correct | Score 60–80 = bon | Score > 80 = succès critique

### Sources de revenus cinéma

- **Box-office passif** : génère des ₶/sec pendant 20 minutes après sortie. Montant proportionnel à hype × score qualité. Décroissance progressive.
- **Vente droits de diffusion** (disponible après 30 min post-sortie) : négociation avec 3 plateformes fictives — CinéStream, MégaVision, ArcLight. Chacune a sa personnalité de négociateur.
- **Vente droits internationaux** : 3 zones négociables séparément (Europe / Amériques / Asie). Prix influencé par réputation internationale du joueur.
- **Soumission festival** : coûte 200 ₶, résultat après 5 min. Victoire = réputation secteur +8, droits revalorisés +30%.
- **Suite / franchise** : si score qualité > 75 et box-office > seuil, option "Produire la suite" apparaît. Budget x1.5, revenus potentiels x2.5, durée de production x1.3.
- **Merchandising** : débloqué après 10 films produits. Revenu passif résiduel pendant 60 minutes post-sortie.

### Risques cinéma

- Score qualité < 30 → flop : revenus box-office ÷3, réputation cinéma -5
- Scandale acteur (événement aléatoire) → hype → 0, droits invendables 10 min
- Concurrence : si deux films du même genre sortent simultanément → revenus divisés
- Plagiat accusé (événement rare) : projet gelé 5 min, réputation -10

---

## SECTEUR 2 — MUSIQUE
### Débloqué à 50 000 ₶ cumulés

### Signer un artiste

- Catalogue d'artistes disponibles (JSON `artistes`), chacun avec : niveau de notoriété (1–5), style musical, prix de signature, durée de contrat proposée
- Le joueur peut contre-proposer une durée et un salaire mensuel (système de négociation générique)
- Un artiste non signé peut "disparaître" du catalogue si le joueur tarde trop (10 min de délai)
- Roster maximum : 5 artistes au départ, extensible via upgrades

### Projets musicaux

- **Single** (1 min réel) : faible revenu de base. 5% de chance de devenir viral → revenus ×10 pendant 3 min.
- **Album** (8 min réel) : revenu étalé sur 30 min après sortie. Nécessite au moins 2 singles sortis au préalable pour éviter le malus de qualité.
- **Tournée nationale** (10 min réel) : billetterie (selon popularité artiste × capacité salle choisie) + merchandising.
- **Tournée mondiale** (20 min réel, débloqué réputation musique niveau 3) : massif, nécessite 3 villes configurées.
- **Featuring** : associer deux artistes du roster. Boost mutuel de notoriété +10 chacun + revenu partagé sur la sortie.
- **Placement sync** : placer un morceau dans un film ou une série (synergie active si le joueur a ces secteurs débloqués). Revenu passif pendant 45 min.

### Vente de droits musique

- **Droits de streaming** : vendre à SoundWave ou BeatFlow. Revenu passif toutes les 5 min (simule les royalties). Négociation sur le taux.
- **Droits publicitaires** : vendre une chanson à une marque fictive. Paiement unique, hype artiste +15.
- **Rachat de catalogue** : vendre l'intégralité des œuvres d'un artiste → il quitte le roster. Paiement massif unique.

### Risques musique

- Artiste qui part si salaire < marché ou réputation musicale du joueur chute sous un seuil
- Bad buzz (événement) : notoriété artiste -30, taux de streaming revu à la baisse
- Album précipité (< 2 singles sortis avant) : malus qualité -20
- Conflit entre deux artistes du roster (événement aléatoire) : les deux perdent 10 de notoriété

---

## SECTEUR 3 — SÉRIES & STREAMING
### Débloqué à 200 000 ₶ cumulés

### Produire une série

- **Paramètres** : genre, nombre de saisons prévues (1 à 5), épisodes par saison (6 / 12 / 24), budget par épisode
- **Showrunner** : niveau 1 à 5 (JSON `showrunners`), influence sur la qualité globale
- **Durée de production** : 3 min par épisode (saison 6 épisodes = 18 min réels)

### Diffusion

- **Vendre à une plateforme** : avant production (moins bien payé mais zéro risque) ou après (mieux payé mais risque du flop). Négociation standard.
- **Sortie mondiale simultanée** vs **sortie par territoire** : deux stratégies avec impacts différents sur la hype et les revenus.

### Renouvellement

- Si une saison dépasse un score seuil : la plateforme propose un renouvellement (nouveau contrat à négocier).
- Refuser le renouvellement = produire la suite en autonomie, financement 100% à la charge du joueur.

### Sa propre plateforme streaming

- Débloquée à 2 000 000 ₶ cumulés, coûte 500 000 ₶ à lancer.
- Génère des abonnés selon la quantité et la qualité du catalogue.
- Revenus passifs toutes les 5 min (abonnements fictifs) mais frais d'hébergement fixes (drain passif).
- Nécessite un minimum de contenu pour ne pas perdre des abonnés.

### Risques séries

- Annulation après saison 1 si score < 40 → perte sèche du budget restant prévu
- Trop de séries simultanées sans assez de showrunners → qualité globale divisée
- Concurrent sort une série similaire en même temps → hype divisée
- Cyberattaque (événement) : plateforme offline 2 min, -30% abonnés temporairement

---

## SECTEUR 4 — ÉVÉNEMENTS LIVE
### Débloqué à 500 000 ₶ cumulés

### Types d'événements

- **Concert unique** : salle (petite / moyenne / grande / stade), un artiste du roster, billetterie + merch
- **Festival** : plusieurs artistes, coût élevé (terrain + scènes + sécurité). Peut devenir annuel (revenu récurrent toutes les 30 min en jeu).
- **Cérémonie de remise de prix** : débloqué réputation globale niveau 3. Crée un événement annuel fictif → boost réputation + billetterie + droits TV.
- **Tournée multi-villes** : artiste dans 3 à 5 villes, chaque ville rapporte séparément.
- **Événement corporatif** : commandé par une entreprise fictive. Revenu garanti, zéro hype pour l'artiste.

### Vente de droits événements

- **Droits TV / diffusion live** : négocier avec une chaîne fictive pour diffuser en direct.
- **Sponsoring** : démarcher des marques fictives, chacune propose un montant selon la taille de l'événement.
- **Revente des enregistrements** : après l'événement, vendre la captation à une plateforme.

### Risques événements

- Météo catastrophique (plein air) : concert annulé → remboursement 80% des billets
- Artiste absent (maladie / scandale) : annulation ou remplacement d'urgence (l'Agent peut proposer un remplaçant payant)
- Surbooking : trop d'événements simultanés → pénalité logistique sur tous (-15% revenus)

---

## SECTEUR 5 — JEUX VIDÉO
### Débloqué à 5 000 000 ₶ cumulés

### Financer un studio

- Racheter un studio fictif (JSON `studios_jv`) : prix selon leur niveau (inconnu / indé / AA / AAA)
- Ou créer son propre studio (long et cher, mais 100% contrôlé)

### Produire un jeu

- **Paramètres** : genre (RPG / FPS / mobile / simulation / indé / MMO), budget de développement, budget marketing
- **Modèle économique à choisir** :
  - Pay-once → revenu unique à la sortie
  - F2P + microtransactions → revenu passif long terme
  - Abonnement → revenu mensuel stable mais acquisition lente
- **Durée** : 10 à 40 min réels selon l'ambition et le budget

### Vente de droits jeux vidéo

- **Accord de distribution** : vendre les droits de distribution à un éditeur fictif
- **Rachat du studio** : un concurrent veut racheter. Accepter = cash massif + perte du studio. Refuser = garder mais rater le cash.
- **Port sur console** : adapter à une plateforme fictive (coût + temps) → nouveau marché

### Risques jeux vidéo

- Bug majeur à la sortie : réputation studio -20, ventes ÷2 pendant 5 min
- Jeu similaire sort simultanément chez un concurrent → hype divisée
- Studio en grève (événement) : projet gelé 5 min

---

## SECTEUR 6 — CRYPTO
### Débloqué à 100 000 ₶ cumulés

### Cryptomonnaies disponibles (fictives)

| Nom | Inspiration | Caractéristiques |
|-----|-------------|-----------------|
| BitApex | Bitcoin | Valeur élevée, fluctuations fortes |
| EtherGlobe | Ethereum | Valeur moyenne, stable |
| DogeStar | Dogecoin | Valeur faible, très volatile (x10 ou /5 en 2 min) |
| ApexStable | Stablecoin | Valeur fixe 1 ₶, zéro risque, zéro gain |

Nouvelles cryptos débloquées progressivement selon la progression globale.

### Mécaniques crypto

- **Achat / vente en temps réel** : cours généré algorithmiquement en local (random walk + bruit, pas d'API externe)
- **Impact marché** : acheter massivement fait monter le cours, vendre massivement fait descendre. Le joueur influence le marché lui-même.
- **Graphique de cours** : SVG simple en temps réel, ligne qui monte et descend. Affiche les 5 dernières minutes.
- **Mining passif** : option payante, génère de petites quantités de crypto passivement
- **Portefeuille visible** : liste des cryptos détenues + valeur actuelle + % de variation depuis l'achat

### Événements crypto

- "Bull run" : toutes les cryptos +30% pendant 3 min
- "Crash" : toutes les cryptos -40% en 30 secondes
- "Régulation fictive" : une crypto suspendue temporairement (10 min)
- "Whale event" : un acteur fictif achète ou vend massivement, le cours s'emballe

---

## SECTEUR 7 — BOURSE
### Débloqué à 10 000 000 ₶ cumulés

### Entreprises cotées fictives

| Société | Secteur lié | Comportement |
|---------|-------------|--------------|
| CinéGlobe Corp | Cinéma | Réagit aux sorties de films du joueur |
| SoundWave Inc | Musique | Réagit aux succès musicaux du joueur |
| PrimeVision | Streaming | Réagit au nombre d'abonnés de sa plateforme |
| LiveNation-like | Événements | Réagit à la fréquence des événements |
| PixelForge | Jeux vidéo | Réagit aux sorties de jeux |
| ApexMedia Holdings | Global | Lié à la réputation globale du joueur |
| TechStream | Infrastructure | Stable, dividendes réguliers |
| GlobalAds Corp | Publicité | Réagit aux budgets pub investis |

### Mécaniques bourse

- Cours influencés par : actions du joueur dans les secteurs liés + événements aléatoires + "résultats trimestriels" fictifs (toutes les 20 min)
- **Dividendes** : certaines actions paient toutes les 10 min si cours > seuil
- **Rachat d'entreprise** : à très haute fortune, possibilité de racheter une société → bonus permanent sur le secteur lié
- **Analyse de marché** : outil payant qui révèle la tendance probable du prochain événement (information partielle, pas garantie)

---

## 🕴️ L'AGENT — Conseiller exclusif

Personnage récurrent qui apparaît toutes les 8 à 20 minutes avec une proposition exclusive. **90 secondes** pour décider. Passé ce délai, la proposition disparaît définitivement.

### Comportement adaptatif

- Si le joueur refuse 3 fois de suite → l'Agent fait une pause plus longue (30 min) avant de revenir
- Si le joueur accepte souvent → l'Agent propose de meilleurs deals progressivement
- L'Agent est toujours visible dans l'interface quand actif (jamais silencieux)

### Exemples de propositions

- "Un réalisateur niveau 5 est disponible 5 minutes — 8 000 ₶"
- "Un artiste inconnu veut te rejoindre pour 200 ₶/mois — sa prochaine sortie sera virale (garanti)"
- "Fuite interne : DogeStar va crasher dans 3 min — info vérifiée à 80%"
- "Un concurrent veut co-produire ton prochain film — il paie 50% du budget, prend 40% des revenus"
- "Une chaîne veut acheter tes 3 meilleurs films d'un coup — offre groupée"
- "Ton artiste [X] menace de partir — tu peux le retenir avec une prime de 5 000 ₶"
- "Un festival sans tête d'affiche cherche un remplaçant en urgence — cachets ×3"

---

## ⚡ ÉVÉNEMENTS ALÉATOIRES

Un événement toutes les 5 à 12 minutes. Durée affichée clairement sur une bannière non bloquante.

### Événements positifs

- Golden Age of Cinema : revenus cinéma ×1.5 pendant 5 min
- Festival viral : hype de tous les artistes actifs +20 pendant 3 min
- Boom des abonnements : plateforme streaming +30% abonnés
- DogeStar moon : valeur ×5 pendant 90 secondes
- Résultats record : cours bourse d'un secteur +20%
- Bonne presse : réputation globale +5

### Événements négatifs

- Grève à Hollywood : tous les projets cinéma suspendus 3 min
- Crise économique : tous les revenus -20% pendant 5 min
- Scandale industrie : réputation globale -5
- Cyberattaque : plateforme streaming offline 2 min
- Crypto winter : toutes les cryptos -30% pendant 4 min

### Événements à choix

- Journaliste veut faire un reportage : Accepter = réputation +10 mais concurrents informés de tes revenus / Refuser = statu quo
- Offre de partenariat concurrent fictif : Accepter = risque partagé + revenus partagés / Refuser = 100% risque + 100% gain

---

## 📊 SYSTÈME DE RÉPUTATION

Cinq jauges sectorielles (Cinéma / Musique / Streaming / Événements / Jeux Vidéo) + une jauge Globale (moyenne pondérée).

**Effets de la réputation haute :**
- Meilleurs contrats disponibles spontanément
- Artistes et réalisateurs acceptent des tarifs réduits
- Acheteurs de droits plus généreux en négociation
- Déblocage de projets "prestige" inaccessibles aux débutants

**Effets de la réputation basse :**
- Moins de contrats disponibles
- Partenaires méfiants, propositions moins généreuses

**Monte via :** succès des projets, prix remportés, contrats bien négociés
**Descend via :** flops répétés, scandales, contrats non honorés, projets annulés

---

## 🏆 PRESTIGE — "NOUVEAU SOMMET"

Débloqué à 100 000 000 ₶ cumulés totaux.

Le joueur peut "prendre sa retraite" : l'empire est vendu, tout repart à zéro sauf les **Apex Stars** (monnaie prestige) et les upgrades permanentes achetées avec elles.

### Calcul des Apex Stars

- Basé sur le capital total cumulé, le nombre de secteurs débloqués, les succès obtenus
- Formule non-linéaire : les premiers prestiges rapportent peu, les suivants sont plus généreux

### Upgrades permanentes inter-prestige

| Upgrade | Coût | Effet |
|---------|------|-------|
| Premier Réseau | 5 ★ | Commencer avec 25 000 ₶ au lieu de 10 000 ₶ |
| Réputation Héritée | 8 ★ | Toutes les jauges de réputation commencent à 10 |
| L'Agent de Confiance | 6 ★ | L'Agent revient deux fois plus vite |
| Négociateur Né | 10 ★ | +5% de probabilité de succès sur toutes les négociations |
| Mémoire du Marché | 12 ★ | Cours crypto légèrement prédictibles |
| Tête de Réseau | 15 ★ | Roster max artistes +3 dès le départ |
| Hype Machine | 20 ★ | Hype initiale de tous les projets +10 |

Le niveau de prestige est visible sur la page profil du joueur.

---

## 🎯 SUCCÈS (150 minimum)

Chaque succès actif donne +0.5% de production globale.

### Catégories et exemples

**Production**
- "Premier clap" — Produire son premier film
- "Trilogie" — Produire 3 suites du même film
- "Chart-topper" — Avoir un single viral
- "Binge-worthy" — Produire une série renouvelée 3 fois
- "AAA" — Produire un jeu avec un budget > 1 000 000 ₶

**Négociation**
- "Négociateur" — Vendre des droits 50% au-dessus du prix estimé
- "Sans pitié" — Pousser un acheteur à son maximum 10 fois
- "Deal du siècle" — Vendre un catalogue complet > 500 000 ₶

**Finance**
- "To the Moon" — Faire ×10 sur DogeStar
- "Crash Survivor" — Survivre à un crypto crash sans vendre
- "Actionnaire" — Détenir des actions dans 5 sociétés simultanément

**Empire**
- "Mogul" — Atteindre 1 000 000 ₶
- "Titan" — Atteindre 50 000 000 ₶
- "Empire" — Avoir tous les secteurs débloqués simultanément
- "Légende" — Effectuer un premier prestige

**Divers**
- "Agent Double" — Accepter 50 propositions de l'Agent
- "Insubmersible" — Survivre à 5 événements négatifs consécutifs sans perdre de réputation
- "Palme d'Or" — Gagner un festival avec un film
- "L'Aigle" — Avoir 10 artistes dans son roster simultanément

---

## 📱 INTERFACE — ORGANISATION PRÉCISE

### Desktop (1440px+)

```
┌─────────────────────────────────────────────────────────┐
│ HEADER : Logo APEX | ₶ actuels | ₶/min | Rép. globale   │
│          | Icône profil | Menu options                   │
├──────────────┬──────────────────────────┬───────────────┤
│ COLONNE G.   │ COLONNE CENTRALE         │ COLONNE D.    │
│ 260px        │ flexible                 │ 260px         │
│              │                          │               │
│ Portefeuille │ [CINÉMA][MUSIQUE]        │ Réputation    │
│ crypto       │ [SÉRIES][EVENTS][JV]     │ (5 jauges)    │
│              │                          │               │
│ Portefeuille │ ─── Projets en cours ──  │ Contrats      │
│ bourse       │ [Carte projet + barre]   │ disponibles   │
│              │ [Carte projet + barre]   │ (3–5 cartes)  │
│ L'Agent      │                          │               │
│ (quand actif)│ ─── Projets terminés ─── │ Succès        │
│              │ [Droits à vendre]        │ récents       │
│ Événement    │                          │               │
│ en cours     │ [+ Lancer un projet]     │ Stats rapides │
└──────────────┴──────────────────────────┴───────────────┘
```

### Mobile (375px — iPhone SE)

```
┌─────────────────────────────────┐
│ HEADER sticky                   │
│ ₶ actuels | ₶/min | ☰ menu     │
├─────────────────────────────────┤
│ ONGLETS sticky (scrollables)    │
│ [CINÉ][MUSIC][SÉRIES][EVENTS]   │
│ [JV][CRYPTO]                    │
├─────────────────────────────────┤
│                                 │
│  CONTENU scrollable vertical    │
│  → Projets en cours             │
│    [Carte compacte]             │
│    [Carte compacte]             │
│  → Projets terminés             │
│    [Actions disponibles]        │
│                                 │
├─────────────────────────────────┤
│ BOUTON STICKY BAS               │
│ [+ Lancer un projet]            │
└─────────────────────────────────┘

FAB (bouton flottant bas-droit) → ouvre Bottom Sheet :
  → Contrats disponibles
  → Réputation (5 jauges)
  → L'Agent (si actif)
  → Stats globales
```

### Règles UI absolues

- Jamais plus de 3 niveaux de profondeur de navigation
- Chaque action principale accessible en max 2 taps sur mobile
- Les barres de progression des projets en cours sont toujours visibles sans scroll
- Les notifications (Agent, événement, succès) apparaissent en **toast non bloquant** en haut de l'écran
- Seules les décisions urgentes (Agent, choix événement) ouvrent un modal — jamais pour des informations passives
- Textes lisibles sans zoom sur iPhone SE : taille minimum 14px
- Les secteurs non débloqués sont visibles en grisé avec le capital requis affiché → motivation constante
- Un indicateur "₶/min" toujours visible dans le header → le joueur voit l'effet de ses décisions en temps réel

---

## CONTRAINTES TECHNIQUES

- **Stack** : Next.js + Supabase + Tailwind CSS (même que le reste du projet Itollec)
- **Déploiement** : Vercel
- **Zéro API payante, zéro service tiers**
- **Moteur de jeu** : `requestAnimationFrame`, pas de `setInterval`
- **Cours crypto et bourse** : générés algorithmiquement en local (random walk + légère tendance)
- **Données noms** : fichier `apex-names.json` chargé une fois au démarrage, mis en cache mémoire
- **Sauvegarde cloud** : toutes les 30 secondes via `upsert` sur `game_saves` avec `game_slug = "apex"`
- **Résolution de conflit** : la sauvegarde avec `updated_at` le plus récent gagne
- **Sauvegarde locale** : `localStorage` en backup entre deux syncs cloud
- **Affichage des grands nombres** : notation courte (1K / 50K / 1M / 4.2B / 1T…)
- **Zéro image externe** : tous les visuels en SVG inline ou CSS pur
- **Accessibilité** : labels ARIA sur tous les éléments interactifs, contrastes AA minimum
- **Responsive** : mobile-first, testé iPhone SE (375px) et desktop 1440px

---

## ORDRE DE DÉVELOPPEMENT RECOMMANDÉ

**Phase 1 — Fondations**
1. Charger et mettre en cache `apex-names.json`, implémenter le tirage sans remise par catégorie
2. Moteur économique : revenus passifs, calcul hype, décroissance temporelle, affichage ₶/min
3. Système de négociation générique (réutilisable pour tous les secteurs)

**Phase 2 — Premier secteur jouable**
4. Secteur Cinéma complet (production + négociation + box-office + droits)
5. Intégration sauvegarde cloud (Supabase) + localStorage backup
6. Interface desktop de base (3 colonnes) + navigation onglets

**Phase 3 — Expansion des secteurs**
7. Secteur Musique
8. Secteur Séries & Streaming (sans la plateforme propre dans un premier temps)
9. Secteur Événements Live

**Phase 4 — Systèmes transversaux**
10. Système de réputation (5 jauges + globale)
11. L'Agent (apparitions + propositions)
12. Événements aléatoires (positifs + négatifs + choix)

**Phase 5 — Secteurs avancés**
13. Secteur Crypto (cours + graphique SVG + portefeuille)
14. Secteur Jeux Vidéo
15. Bourse fictive
16. Plateforme streaming propre (extension secteur 3)

**Phase 6 — Méta-jeu**
17. Système de succès (150 achievements)
18. Système de prestige (Apex Stars + upgrades permanentes)

**Phase 7 — Finitions**
19. Interface mobile complète (bottom sheet + FAB + onglets sticky)
20. Optimisation performance (requestAnimationFrame, pas de re-renders inutiles)
21. Tests iPhone SE + Desktop 1440px
22. Intégration profil Itollec (stats, niveau prestige affiché)
23. Cohérence direction artistique avec le reste du site
