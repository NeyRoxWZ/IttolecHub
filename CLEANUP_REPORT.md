# Rapport de Nettoyage du Codebase (CLEANUP_REPORT.md)

## 1. Analyse de l'existant

Une analyse complète du projet a révélé la présence de nombreux fichiers obsolètes suite aux récentes refontes (migration vers Supabase Realtime, suppression des anciens jeux, etc.).

### 1.1 Fichiers de Données Obsolètes
Les fichiers suivants sont des reliquats de jeux supprimés ou d'anciennes versions :
- `locations_game.json` (Ancien jeu de localisation, remplacé ou supprimé)
- `marques-mondiales.json` (Ancien jeu de logos, supprimé)

### 1.2 Scripts SQL Redondants
La configuration de la base de données est fragmentée en de multiples fichiers SQL. Le fichier `setup_all_games.sql` semble consolider l'ensemble des besoins actuels. Les fichiers suivants sont donc redondants :
- `supabase_budgetguessr.sql`
- `supabase_drawguessr.sql`
- `supabase_flagguessr.sql`
- `supabase_infiltre.sql`
- `supabase_pokeguessr.sql`
- `supabase_schema.sql`
- `supabase_undercover*.sql` (plusieurs fichiers)
- `supabase_wikiguessr.sql`
- `cleanup_old_games.sql`
- `update_flag_sql.sql`

### 1.3 Routes API Inutilisées
- `app/api/games/country/` : Non référencé. Le jeu "FlagGuessr" utilise désormais `app/api/games/flag/`.

### 1.4 Documentation et Plans Obsolètes
- `plan_correction_v2.md`
- `plan_reconstruction_complet.md`
- `InstructionGame.md`

## 2. Plan de Nettoyage

L'objectif est de ne conserver que :
1.  Le code source actif (`app/`, `games/`, `hooks/`, `lib/`, `components/`).
2.  Les fichiers de configuration essentiels (`next.config.js`, `tailwind.config.js`, etc.).
3.  Un unique fichier de référence pour la base de données (`setup_all_games.sql`).
4.  Les fichiers de données utilisés par les API actives (`infiltre.json`, `undercover.json`, `mots_a_dessiner.json`).

## 3. Actions Prévues

1.  **Suppression** des fichiers JSON obsolètes.
2.  **Suppression** des scripts SQL fragmentés.
3.  **Suppression** du dossier API `country`.
4.  **Archivage/Suppression** des fichiers de planification obsolètes.
5.  **Validation** par build (`npm run build`).

Ce nettoyage permettra d'alléger le projet et d'éviter toute confusion pour les développements futurs.
