# PROMPT COMPLET — ITOLLEC IDLE GAMES
> À copier-coller directement dans Trae / Cursor

---

## CONTEXTE GÉNÉRAL DU PROJET

Tu travailles sur **Itollec**, une plateforme de jeux en ligne déployée sur **Vercel** (frontend Next.js) et **Supabase** (base de données PostgreSQL). Le site propose :
- Des jeux **Multijoueur** (existants — ne pas toucher)
- Des jeux **Idle** (à créer — c'est l'objet de ce prompt)

Tu dois créer deux jeux Idle complets, beaux, aboutis, mobiles et connectés à un système de compte. **Analyse la direction artistique existante du site avant de coder quoi que ce soit.** Adapte les assets, couleurs et styles en cohérence avec le reste du site.

---

## SYSTÈME DE COMPTE (commun aux deux jeux)

### Connexion Discord (OAuth2)
- Bouton "Se connecter avec Discord" sur la page d'accueil
- OAuth2 Discord via Supabase Auth (provider Discord)
- À la connexion : récupérer `username` Discord comme pseudo par défaut
- Avatar = avatar Discord

### Connexion par Passphrase (alternative sans Discord)
- L'utilisateur choisit un pseudo (unique, sensible à la casse)
- Le système génère **6 mots aléatoires** en français courant (lisibles, mémorisables — style Diceware)
- Ces 6 mots sont hashés (bcrypt) et stockés en base avec le pseudo
- Pour se connecter : entrer le pseudo exact + les 6 mots dans l'ordre
- Bouton "Régénérer mes mots" sur la page profil (uniquement si connecté)
- **IMPORTANT** : ne jamais stocker les mots en clair. Stocker uniquement le hash bcrypt.

### Table Supabase — `users`
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pseudo TEXT NOT NULL UNIQUE,
  passphrase_hash TEXT,
  discord_id TEXT UNIQUE,
  discord_username TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW()
);
```

### Table Supabase — `game_saves`
```sql
CREATE TABLE game_saves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  game_slug TEXT NOT NULL,
  save_data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, game_slug)
);
```

### Sauvegarde cloud
- Sauvegarde automatique toutes les **30 secondes** via `upsert` sur `game_saves`
- Sauvegarde locale (`localStorage`) en backup entre deux syncs
- Au chargement : charger depuis Supabase si connecté, sinon depuis localStorage
- **Résolution de conflit : la sauvegarde avec `updated_at` le plus récent gagne**
- Si non connecté : jouer en local, avertissement discret affiché
- Indicateur visuel : icône nuage + "Sauvegardé il y a X secondes"

### Page Profil (`/profil`)
- Avatar (Discord ou initiale générée avec couleur unique)
- Pseudo affiché + bouton "Modifier le pseudo"
- Méthode de connexion affichée (Discord ou Passphrase)
- Si Passphrase : bouton "Afficher mes 6 mots" (masqués par défaut) + bouton "Régénérer" (avec confirmation)
- Statistiques globales : temps de jeu total, date d'inscription, trophée et succes des jeux (classé par jeux)
- Résumé de progression par jeu
- Bouton "Se déconnecter"

### Navigation globale
- Header discret : logo Itollec, pseudo connecté + avatar, lien profil, déconnexion
- Si non connecté : boutons "Se connecter" / "Créer un compte"
- Le pseudo utilisé en multijoueur = le pseudo du compte (non modifiable en jeu)

---

## JEU 1 — ITOLLECCLICKER 👑
### Thème : Empire Napoléonien

**Devise :** Livres Tournois (₶)
**Ambiance :** Empire français, 1800-1815. Gravures, parchemins, or et bleu impérial.
**Style visuel :** Illustrations vectorielles fines, style gravure ancienne. Pas de pixels. Pas de cubes. Dégradés chauds, pas d'émoji (crème, or, bordeaux, bleu nuit impérial). Police serif élégante pour les titres, sans-serif lisible pour les chiffres.

---

### BÂTIMENTS (19 niveaux de progression)

Chaque bâtiment a : nom, description immersive (flavor text), production de base (₶/sec), coût initial, multiplicateur de coût x1.15 par unité achetée.

| # | Nom | Équivalent Cookie Clicker | ₶/sec base | Coût initial |
|---|-----|--------------------------|------------|-------------|
| 1 | La Plume | Cursor | 0.1 | 15 ₶ |
| 2 | La Paysanne | Grandma | 1 | 100 ₶ |
| 3 | Le Champ de Blé | Farm | 8 | 1 100 ₶ |
| 4 | La Carrière de Pierre | Mine | 47 | 12 000 ₶ |
| 5 | La Forge Impériale | Factory | 260 | 130 000 ₶ |
| 6 | Le Trésor Royal | Bank | 1 400 | 1 400 000 ₶ |
| 7 | La Cathédrale Notre-Dame | Temple | 7 800 | 20 000 000 ₶ |
| 8 | L'Académie des Sciences | Wizard Tower | 44 000 | 330 000 000 ₶ |
| 9 | La Flotte Marchande | Shipment | 260 000 | 5 100 000 000 ₶ |
| 10 | L'Atelier de l'Alchimiste | Alchemy Lab | 1 600 000 | 75 000 000 000 ₶ |
| 11 | Le Réseau de Courriers | Portal | 10 000 000 | 1 000 000 000 000 ₶ |
| 12 | Le Cabinet des Stratèges | Time Machine | 65 000 000 | 14 000 000 000 000 ₶ |
| 13 | L'Observatoire Impérial | Antimatter Condenser | 430 000 000 | 170 000 000 000 000 ₶ |
| 14 | La Galerie des Glaces | Prism | 2 900 000 000 | 2 100 000 000 000 000 ₶ |
| 15 | L'Oracle de Joséphine | Chancemaker | 21 000 000 000 | 26 000 000 000 000 000 ₶ |
| 16 | La Bibliothèque Nationale | Fractal Engine | 150 000 000 000 | 310 000 000 000 000 000 ₶ |
| 17 | Le Cabinet Noir | Javascript Console | 1 100 000 000 000 | 71 000 000 000 000 000 000 ₶ |
| 18 | L'Empire Céleste | Idleverse | 8 300 000 000 000 | 12 000 000 000 000 000 000 000 ₶ |
| 19 | La Légion d'Honneur Suprême | Cortex Baker | 64 000 000 000 000 | 1 000 000 000 000 000 000 000 000 ₶ |

Chaque bâtiment débloque des **synergies** avec d'autres bâtiments (bonus de production croisé).

---

### UPGRADES (Décrets Impériaux)

Minimum **500 upgrades** réparties en catégories :

**Décrets de Production** (boostent les bâtiments)
- Chaque bâtiment a 10 paliers d'upgrade (x2 production) déclenchés à 1, 5, 25, 50, 100, 150, 200, 250, 300, 400 unités possédées

**Décrets de Clic** (boostent le clic manuel)
- Série de 15 upgrades qui doublent la valeur du clic
- Ex : "Poigne Impériale", "Sablier d'Or", "Main de Fer"...

**Décrets Croisés** (synergies entre bâtiments)
- Ex : "Accord Commercial" → La Flotte Marchande booste Le Trésor Royal de +5%
- 30+ synergies différentes

**Décrets Spéciaux** (débloqués via achievements ou événements)
- "Code Civil" : +10% global
- "Concordat" : La Cathédrale produit pendant le sommeil
- "Blocus Continental" : x3 pendant 30 secondes

---

### MÉCANIQUE DE CLIC

- Clic sur le Grand Sceau Impérial central = gain de ₶
- Valeur de base : 1 ₶/clic
- Upgrades augmentent la valeur
- Animation au clic : particules dorées, son de pièce (désactivable)
- **Combo de clic** : 20 clics en 5 secondes → x2 temporaire, retombe après 3 sec d'inactivité

---

### DÉCRET IMPÉRIAL (Golden Cookie)

- Sceau doré animé qui apparaît aléatoirement toutes les 5-15 minutes
- Visible 13 secondes avant de disparaître
- Effets possibles (aléatoires) :
  - "Frenzy" → x7 production pendant 77 secondes
  - "Lucky!" → +13% des ₶ produites dans les 2 dernières heures
  - "Click Frenzy" → x777 valeur de clic pendant 13 secondes
  - "Cursed Finger" → stop production auto, mais clic = production totale par clic
  - "Chain" → déclenche 3 à 5 sceaux consécutifs
  - "Pledge" → +10% global pendant 10 minutes
  - "Dragon Harvest" → x2 production pendant 30 secondes

---

### LES RÉVOLUTIONNAIRES (Wrinklers)

- Figures révolutionnaires (Marat, Robespierre...) apparaissent autour du sceau
- Chaque révolutionnaire absorbe 5% de la production mais accumule x1.1 ce qu'il absorbe
- 3 clics dessus → il est éliminé et libère tout (+10% bonus)
- Maximum 12 révolutionnaires simultanément

---

### PRESTIGE — "L'Exil et le Retour"

- Seuil très élevé atteint → option "Abdiquer" disponible
- L'abdication remet le jeu à zéro mais octroie des **Médailles Impériales** (monnaie persistante)
- Médailles pour acheter des upgrades permanentes inter-resets
- Exemples : "Les Cent-Jours" (+10% prod par niveau prestige), "Sainte-Hélène" (garder 1% des ₶)
- Niveau de prestige affiché sur le profil

---

### SUCCÈS / TROPHÉES (Médailles)

Minimum **200 achievements** :
- Catégories : Production totale, Clics, Bâtiments, Décrets, Sceaux, Révolutionnaires, Temps de jeu, Prestige
- Exemples :
  - "Premier Consul" — Atteindre 1 000 ₶ produites
  - "Victoire d'Austerlitz" — Avoir 100 Forges Impériales
  - "Grand Chambellan" — Cliquer 10 000 fois
  - "L'Aigle s'envole" — Premier prestige
  - "Waterloo" — Réinitialiser après 1 trillion de ₶
- Chaque achievement actif donne +1% de production globale

---

### ÉVÉNEMENTS SAISONNIERS

- **Noël Impérial** (décembre) : cadeaux sur l'écran, bonus de production
- **Anniversaire d'Austerlitz** (2 décembre) : x2 global pendant 24h
- **Les Cent-Jours** (mi-mars à mi-juin) : upgrade spéciale disponible temporairement

---

### MINI-JEUX INTERNES (débloqués selon progression)

**La Forge** (débloquée à 15 Forges Impériales)
Gestion d'ouvriers : allouer des ressources pour booster la production temporairement.

**Le Grand Jeu** (débloqué à 15 Cabinets des Stratèges)
Choisir des stratégies diplomatiques qui modifient la production pendant une durée.

**L'Oracle** (débloqué à 15 Oracles de Joséphine)
Pari sur l'avenir : risquer des ₶ pour potentiellement les tripler.

---

### STATISTIQUES AFFICHÉES EN JEU

- ₶ actuelles | Production par seconde (PPS)
- ₶ totales produites depuis le début | ₶ dépensées
- Nombre de clics totaux | Bâtiments possédés (par type)
- Sceaux cliqués | Révolutionnaires éliminés
- Temps de jeu total | Niveau de prestige

---

### INTERFACE ITOLLECCLICKER

- **Gauche** : Grand Sceau Impérial cliquable + particules + révolutionnaires autour
- **Centre/Droite** : liste des bâtiments (grisés si inabordables), compteur possédé
- **Panneau droit** : upgrades disponibles (icônes avec tooltip)
- **Haut** : barre de stats + menus (achievements, stats, options, sauvegarde)
- **Notifications flottantes** : achievement, décret, synergie découverte
- **Mobile** : layout vertical, bâtiments en bas, sceau en haut, swipe entre panneaux

---

## PAGES À CRÉER

| URL | Description |
|-----|-------------|
| `/` | Accueil : présentation + section Multijoueur (existant) + section Idle (cartes jeux) |
| `/connexion` | Connexion Discord ou passphrase |
| `/creer-compte` | Choix pseudo + génération 6 mots + confirmation |
| `/profil` | Page profil utilisateur complète |
| `/itollec-clicker` | Jeu ItollecClicker complet inline |

---

## CONTRAINTES TECHNIQUES

- **Stack** : Next.js + Supabase + Tailwind CSS
- **Déploiement** : Vercel
- **Zéro API payante, zéro abonnement tiers**
- **Zéro image externe** : tous les visuels en SVG inline ou CSS pur
- **Responsive** : mobile-first, testé iPhone SE (375px) et desktop 1440px
- **Moteur de jeu** : `requestAnimationFrame`, pas de `setInterval`
- **Nombres** : affichés en notation courte au-delà de 1 000 000 (1M, 1B, 1T, 1Qa...)
- **Accessibilité** : labels ARIA, contrastes AA minimum

---

## CONSIGNES VISUELLES

1. Analyser les fichiers du projet existant avant de commencer
2. Reprendre la palette, la typographie et les espacements du site
3. **ItollecClicker** : style gravure/parchemin — palette or, bleu impérial, bordeaux, crème
4. Aucun emoji dans l'UI des jeux (sauf dans les achievements où c'est voulu)
5. Animations fluides (CSS transitions + `requestAnimationFrame`)
6. Pas de cubes, pas de carrés grossiers : formes organiques, illustrations fines

---

## ORDRE DE DÉVELOPPEMENT SUGGÉRÉ

1. Système de compte (Discord OAuth + passphrase + tables Supabase)
2. Moteur de sauvegarde cloud (sync 30s + résolution conflits)
3. Page Profil complète
4. ItollecClicker — moteur de jeu (production, clics, bâtiments de base)
5. ItollecClicker — upgrades + achievements
6. ItollecClicker — Décrets Impériaux + Révolutionnaires + Prestige
7. ItollecClicker — mini-jeux internes + événements saisonniers
8. Navigation globale + header connexion + cohérence DA
9. Tests mobile et pc + optimisation performance
