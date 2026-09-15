# IttolecHub

Site de jeux gratuits : [itollechub.com](https://itollechub.com).

- **Multijoueur** : parties entre potes par code de salle (BudgetGuessr, DrawGuessr, FlagGuessr, Infiltré, JaugeGuessr, LogoGuessr, PokeGuessr, RentGuessr, Undercover, WikiRacing, et les jeux d’ambiance Hors Sujet, Un Trait de Trop, BlindTest, Punchline, Petit Bac, Qui a dit ça ?, Surenchère, Le Dico).
- Les jeux d’ambiance partagent un moteur commun : `games/party/` (état de manche, coups des joueurs, écrans communs) et `lib/party/catalog.ts` (réglages et catégories).
- **Casino** : monnaie fictive, une vingtaine de jeux, pass, missions, boutique.
- **Pêche** : jeu idle avec Poissodex et aquarium.

## Stack

Next.js 15 (App Router), React 19, TypeScript, Tailwind 3, Supabase (base, realtime), hébergé sur Cloudflare Workers via OpenNext.

## Arborescence

| Dossier | Contenu |
| --- | --- |
| `app/` | pages et routes API (`app/api/*`) |
| `components/` | composants partagés (`components/ui` : primitives) |
| `games/` | composants des jeux multijoueur |
| `hooks/` | hooks React |
| `lib/` | logique serveur et client (`lib/casino`, `lib/peche`, `lib/seo`, `lib/supabase`) |
| `public/data/` | données des jeux (listes de mots, pays, marques, annonces…) |
| `patch-notes/` | patch notes : en attente, historique, scopes |
| `scripts/` | outils en ligne de commande |
| `supabase/` | scripts SQL (tables, policies, migrations) |
| `custom-worker.ts` | worker Cloudflare : redirection https et tâches planifiées |

## Développement

```bash
npm install
npm run dev
```

Variables dans `.env.local` : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `SESSION_SECRET`, `CRON_SECRET`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `TMDB_API_KEY`, `KRASH_SEED`. Ne jamais les commiter.

## Déploiement

```bash
npx opennextjs-cloudflare build
npx opennextjs-cloudflare deploy
```

Les secrets de prod sont des secrets Cloudflare (`npx wrangler secret put NOM`).

## Patch notes

```bash
npm run note -- <scope> <type> "Titre" "Détails"
npm run notes:status
npm run release -- 1.6.0 "Titre de la version"
```
