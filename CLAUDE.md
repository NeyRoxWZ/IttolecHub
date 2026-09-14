# IttolecHub — consignes pour Claude Code

## Patch notes : à tenir à jour pendant le travail

Après chaque changement **visible par les joueurs** (nouvelle fonction, jeu modifié, rééquilibrage, bug corrigé, élément retiré), ajoute une entrée en attente :

```bash
npm run note -- <scope> <type> "Titre" "Détails"
```

- **Une entrée par changement distinct.** Pas une entrée par fichier, pas une entrée fourre-tout.
- **Écrit pour les joueurs, en français** : ce qui change pour eux, pas comment c'est codé. « Encaisser ne fait plus perdre au Dino », pas « fix race condition dans resolveObstacle ».
- `Détails` est facultatif : une ou deux phrases quand le titre ne suffit pas.
- Rien d'invisible pour un joueur : pas de refactor, pas de nettoyage, pas de changement d'outillage.
- **Ne lance jamais `npm run release`** sauf si l'utilisateur le demande explicitement : c'est lui qui décide quand une version sort.
- `npm run notes:status` montre ce qui est en attente.

### Scopes

La liste fait foi dans `patch-notes/scopes.json`. En résumé :
- `site` — accueil, profil, comptes, pages générales
- `casino` — le casino dans son ensemble (pass, boutique, missions, cagnotte, entre potes…)
- un jeu du casino : `slots`, `blackjack`, `wheel`, `rocket`, `mines`, `plinko`, `hilo`, `grattage`, `poulet`, `tower`, `keno`, `caisses`, `coinflip`, `dino`, `chevaux`, `bonneteau`, `stade`, `baccarat`, `rps`, `craps`
- `clicker` — ItollecClicker (jeu retiré : scope gardé seulement pour l'historique des patch notes)
- `krash` — Krash (jeu retiré : scope gardé seulement pour l'historique des patch notes)
- `peche` — Pêche (bêta, ouvert à tous), catégorie à part
- `solo` — ce qui touche tous les jeux solo à la fois
- multijoueur : `budgetguessr`, `drawguessr`, `flagguessr`, `infiltre`, `jaugeguessr`, `logoguessr`, `pokeguessr`, `rentguessr`, `undercover`, `wikiracing`

Un nouveau jeu doit être ajouté à `patch-notes/scopes.json` avant d'y attacher des notes.

### Types

`nouveau`, `amelioration`, `equilibrage`, `correctif`, `retrait`.

### Publier une version (sur demande uniquement)

```bash
npm run release -- 1.2.0 "Titre de la version"
```

La version est facultative : sans elle, la version mineure de `package.json` est incrémentée. Le script déplace les entrées en attente dans `patch-notes/releases.json` (historique complet, lu par le site) et vide `patch-notes/unreleased.json`. Il faut ensuite commiter et pousser. Les joueurs voient la nouvelle version une fois, en modale, sur les écrans solo, et tout l'historique sur `/patch-notes`.
