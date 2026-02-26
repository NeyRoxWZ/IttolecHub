# Document complet – Diagnostic, reconstruction et stabilisation du projet

## Contexte technique
- Framework : Next.js 14
- Base de données et temps réel : Supabase (PostgreSQL + Realtime)
- Hébergement : Vercel
- IDE AI utilisé : Trae (ByteDance) avec GPT
- Le projet est un hub de mini-jeux multijoueurs en ligne avec rooms, leaderboard, synchronisation en temps réel

---

## ÉTAT DES LIEUX – Ce qui ne fonctionne pas

1. Erreur 400 en boucle sur les requêtes PATCH vers Supabase (rooms, game_sessions)
2. Les images ne s'affichent pas dans les jeux (Pokémon, drapeaux, aliments)
3. L'UI des jeux a perdu ses éléments essentiels : timer, rounds, leaderboard, liste des joueurs ayant répondu
4. L'Undercover ne lance pas la partie
5. L'Infiltré ne fonctionne pas
6. Pas de responsive mobile sur les jeux
7. La synchronisation multijoueur est cassée depuis qu'elle a été ajoutée

---

## DIAGNOSTIC RACINE – Pourquoi ça tourne en boucle

La cause fondamentale est que les corrections précédentes ont été faites de manière fragmentée, fichier par fichier, sans vision d'ensemble. Résultat : des composants qui s'appellent mutuellement avec des états instables, des useEffect avec des dépendances qui se re-déclenchent en boucle infinie, et une architecture de synchronisation qui n'a pas été pensée de façon cohérente dès le départ.

**Vercel n'est PAS le problème.** Vercel héberge parfaitement Next.js avec Supabase Realtime. Le problème est dans le code.

---

## PHASE 1 – AUDIT COMPLET AVANT TOUTE MODIFICATION

Avant d'écrire une seule ligne de code, effectue les actions suivantes dans l'ordre :

### 1.1 – Cartographie de l'architecture existante

Ouvre et lis attentivement ces fichiers dans cet ordre :
- Tous les fichiers dans `/app/` pour comprendre les routes
- Tous les fichiers dans `/games/` pour voir les composants de jeu
- Tous les fichiers dans `/components/` pour voir les composants partagés
- Tous les fichiers dans `/lib/` ou `/utils/` pour voir les helpers Supabase
- Le fichier où le client Supabase est instancié (cherche `createClient`)

Dresse une liste de :
- Chaque table Supabase utilisée dans le code (cherche `from('...')`)
- Chaque channel Realtime ouvert (cherche `supabase.channel(`)
- Chaque `useEffect` qui fait un appel Supabase
- Chaque `setInterval` présent dans le code

### 1.2 – Identifier la source exacte du 400

Dans CHAQUE appel Supabase qui fait un UPDATE ou PATCH, ajoute temporairement ce log :
```js
const { data, error } = await supabase.from('rooms').update(payload).eq('id', id)
if (error) console.error('ERREUR SUPABASE:', error.message, error.details, error.hint, 'PAYLOAD:', JSON.stringify(payload))
```
Lance l'app, reproduis l'erreur, et note le message exact. C'est le seul moyen de savoir ce qui bloque.

### 1.3 – Exécuter ce SQL dans Supabase pour voir toutes les tables et colonnes

```sql
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;
```

Compare chaque colonne retournée avec ce que le code envoie dans les payloads. Toute clé dans un payload qui ne correspond pas à une colonne existante génère un 400.

---

## PHASE 2 – SQL COMPLET À EXÉCUTER EN UNE FOIS

Exécute ce bloc SQL complet dans Supabase SQL Editor. Il crée les tables manquantes, supprime toutes les restrictions RLS, et configure le Realtime.

```sql
-- ============================================================
-- RESET COMPLET RLS – TOUT PUBLIC
-- ============================================================

-- ROOMS
ALTER TABLE rooms DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rooms_select" ON rooms;
DROP POLICY IF EXISTS "rooms_insert" ON rooms;
DROP POLICY IF EXISTS "rooms_update" ON rooms;
DROP POLICY IF EXISTS "rooms_delete" ON rooms;
DROP POLICY IF EXISTS "gs_all" ON rooms;

-- PLAYERS
ALTER TABLE players DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "players_select" ON players;
DROP POLICY IF EXISTS "players_insert" ON players;
DROP POLICY IF EXISTS "players_update" ON players;
DROP POLICY IF EXISTS "players_delete" ON players;

-- GAME_SESSIONS (créer si manquante)
CREATE TABLE IF NOT EXISTS game_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  game_type TEXT NOT NULL,
  state JSONB DEFAULT '{}',
  current_round INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE game_sessions DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gs_select" ON game_sessions;
DROP POLICY IF EXISTS "gs_insert" ON game_sessions;
DROP POLICY IF EXISTS "gs_update" ON game_sessions;
DROP POLICY IF EXISTS "gs_delete" ON game_sessions;

-- REALTIME SUR TOUTES LES TABLES
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE rooms, players, game_sessions;

-- COLONNES MANQUANTES (ADD IF NOT EXISTS)
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'waiting';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS game_type TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS host_last_seen_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS mr_white_enabled BOOLEAN DEFAULT true;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS vote_duration_seconds INTEGER DEFAULT 60;
ALTER TABLE players ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE players ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_host BOOLEAN DEFAULT false;
```

---

## PHASE 3 – ARCHITECTURE DE SYNCHRONISATION À IMPLÉMENTER

Le problème de fond est que la synchronisation a été ajoutée sans architecture claire. Voici l'architecture exacte à implémenter une fois pour toutes, de façon cohérente sur TOUS les jeux.

### 3.1 – Principe général

Il y a UN seul channel Realtime par room. Toute la communication passe par ce channel. On utilise deux mécanismes Supabase :
- **Postgres Changes** : pour réagir aux changements de la table `rooms` et `game_sessions`
- **Broadcast** : pour les événements temps réel rapides (réponses des joueurs, timer, etc.)

### 3.2 – Structure du channel (à créer dans un hook partagé `useGameRoom`)

```
useGameRoom(roomId, playerId)
├── Écoute rooms -> UPDATE (changement de status, settings, game_type)
├── Écoute game_sessions -> INSERT/UPDATE (état du jeu en cours)
├── Broadcast "player_answer" -> quand un joueur répond
├── Broadcast "game_start" -> quand l'hôte lance
├── Broadcast "next_round" -> passage à la manche suivante
└── Broadcast "game_end" -> fin de partie avec scores
```

### 3.3 – Flux d'une partie (à respecter pour TOUS les jeux)

1. L'hôte configure les settings dans la room (stockés dans `rooms.settings` en JSONB)
2. L'hôte clique "Lancer" → UPDATE `rooms.status = 'started'` + INSERT dans `game_sessions`
3. Tous les clients écoutent le changement de `rooms.status` → redirect automatique vers la page de jeu
4. La page de jeu écoute `game_sessions` pour l'état courant (question en cours, round, timer)
5. Chaque réponse d'un joueur → Broadcast "player_answer" + UPDATE score dans `players`
6. Quand tous ont répondu OU timer expiré → l'hôte (et l'hôte seulement) passe au round suivant
7. Fin de partie → affichage leaderboard basé sur les scores dans `players`

### 3.4 – Règle critique pour éviter les boucles infinies

Dans CHAQUE useEffect qui fait un appel Supabase :
- Ne jamais mettre un objet ou tableau créé inline dans les dépendances
- Utiliser `useRef` pour stocker le channel et le cleanup correctement
- Toujours retourner une fonction de cleanup qui appelle `supabase.removeChannel(channel)`
- Ajouter un flag `isMounted` pour éviter les setState après démontage

```js
useEffect(() => {
  let isMounted = true
  const channel = supabase.channel(`room-${roomId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
      (payload) => { if (isMounted) setRoom(payload.new) }
    )
    .subscribe()

  return () => {
    isMounted = false
    supabase.removeChannel(channel)
  }
}, [roomId]) // roomId seulement, jamais d'objet inline
```

---

## PHASE 4 – CORRECTIONS PAR JEU

### 4.1 – APIs à utiliser (toutes gratuites, sans clé API)

| Jeu | API | Endpoint |
|-----|-----|----------|
| PokéGuesser | PokéAPI | `https://pokeapi.co/api/v2/pokemon/{id}` – image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/{id}.png` |
| FlagGuesser | RestCountries | `https://restcountries.com/v3.1/all?fields=name,flags,cca2` |
| PopulationGuesser | RestCountries | `https://restcountries.com/v3.1/all?fields=name,population,flags` |
| CaloriGuesser | Open Food Facts | `https://world.openfoodfacts.org/cgi/search.pl?action=process&json=1&page_size=20&search_terms={aliment}` – image dans `product.image_url` |
| LyricsGuesser | Lyrics.ovh | `https://api.lyrics.ovh/v1/{artiste}/{titre}` |
| RymGuesser | Datamuse | `https://api.datamuse.com/words?rel_rhy={mot}&max=10` |

### 4.2 – Règle pour les images

Toutes les images externes doivent être configurées dans `next.config.js` pour être autorisées par Next.js Image Optimization :

```js
images: {
  remotePatterns: [
    { hostname: 'raw.githubusercontent.com' },
    { hostname: 'flagcdn.com' },
    { hostname: 'images.openfoodfacts.org' },
    { hostname: 'static.openfoodfacts.org' },
  ]
}
```

Si une image ne charge pas, utiliser une balise `<img>` standard au lieu de `<Image>` de Next.js pour éviter les problèmes de domaine non autorisé.

### 4.3 – PokéGuesser

- Récupérer les Pokémon via PokéAPI selon la génération choisie dans settings
- Afficher l'image official-artwork (pas le sprite pixel)
- Générations : Gen1 #1-151, Gen2 #152-251, Gen3 #252-386, Gen4 #387-493, Gen5 #494-649, Gen6 #650-721, Gen7 #722-809
- Le sélecteur de génération est dans les paramètres de room côté hôte, stocké dans `rooms.settings.generation`

### 4.4 – FlagGuesser & PopulationGuesser

Ces deux fichiers doivent être **réécrits entièrement from scratch** car ils ont des erreurs de syntaxe non récupérables (JSX commenté mal fermé, accolades manquantes). Pour les réécrire :
- Copier exactement la structure d'un jeu qui fonctionne (ex: PokéGuesser)
- Remplacer uniquement la logique métier (drapeaux / population) en gardant la même architecture de composant
- Utiliser RestCountries pour les données

### 4.5 – Undercover & L'Infiltré

**Problèmes à corriger dans l'ordre :**

1. Détecter l'hôte : `const isHost = room?.host_id === currentPlayerId`
2. Si `isHost === true` → afficher le bouton "Lancer la partie", jamais le message d'attente
3. Les paramètres (Mr. White on/off, durée vote, nombre de manches) doivent être dans les settings de la room, configurables avant de lancer
4. Au clic sur "Lancer" :
   - Broadcast un événement "countdown" sur le channel de la room
   - Tous les clients affichent un compteur 3, 2, 1 (avec setInterval de 1 seconde)
   - Après le 1 → distribuer les rôles (calculé côté hôte, envoyé via Broadcast à chaque joueur individuellement avec son rôle)
5. La distribution des rôles doit se faire côté hôte uniquement pour éviter les incohérences

---

## PHASE 5 – UI/UX – ÉLÉMENTS OBLIGATOIRES DANS CHAQUE JEU

Chaque page de jeu DOIT afficher ces éléments, sans exception :

**En haut :**
- Numéro de manche actuelle / total des manches (ex: "Manche 2/5")
- Timer avec countdown visuel (barre de progression ou chiffre)
- Nom du jeu

**Au centre :**
- Le contenu du jeu (image, question, drapeau, etc.) clairement visible
- Zone de réponse (input ou boutons de choix)

**Sur le côté ou en bas :**
- Liste des joueurs avec indicateur "a répondu" / "en attente"
- Scores en temps réel

**À la fin de chaque manche :**
- Affichage de la bonne réponse
- Delta de points gagnés par chaque joueur
- Transition automatique vers la manche suivante après 3 secondes

**À la fin de la partie :**
- Leaderboard final avec classement, pseudo, score total
- Bouton "Rejouer" (remet la room en status 'waiting') et "Quitter"

---

## PHASE 6 – RESPONSIVE MOBILE

Chaque composant de jeu doit fonctionner à partir de 375px de largeur.

Règles à appliquer :
- Utiliser des classes Tailwind responsive : `flex-col md:flex-row`, `text-sm md:text-base`, etc.
- Les images de jeu : `w-full max-w-sm mx-auto` sur mobile
- Les boutons : hauteur minimum 44px, width 100% sur mobile
- Le timer et le score : toujours visibles en haut, même sur petit écran
- Tester mentalement chaque layout à 375px avant de valider

---

## PHASE 7 – VÉRIFICATION FINALE

Après toutes les corrections, dans cet ordre :

1. `npm run build` → corriger toutes les erreurs TypeScript jusqu'à 0 erreur
2. Tester en local avec deux onglets (simuler hôte + joueur)
3. Vérifier dans la console navigateur : 0 erreur 400, 0 erreur 406, 0 boucle infinie de requêtes
4. Vérifier que le channel Realtime se connecte (doit voir "Realtime connected" ou équivalent dans les logs)
5. Tester le flow complet : créer room → rejoindre → configurer → lancer → jouer → voir leaderboard
6. Deploy sur Vercel et retester en production avec deux appareils différents
