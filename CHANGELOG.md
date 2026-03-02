# Changelog - Nettoyage du Codebase

## [1.0.0] - 2026-03-02

### Supprimé
- **Fichiers de données inutiles :**
  - `locations_game.json` (Reliquat d'un ancien jeu de localisation)
  - `marques-mondiales.json` (Reliquat d'un ancien jeu de logos)
- **Scripts SQL redondants (consolidés dans `setup_all_games.sql`) :**
  - `supabase_budgetguessr.sql`
  - `supabase_drawguessr.sql`
  - `supabase_flagguessr.sql`
  - `supabase_infiltre.sql`
  - `supabase_pokeguessr.sql`
  - `supabase_schema.sql`
  - `supabase_undercover*.sql` (tous les fichiers fragmentés)
  - `supabase_wikiguessr.sql`
  - `cleanup_old_games.sql`
  - `update_flag_sql.sql`
- **Routes API obsolètes :**
  - `app/api/games/country/` (Remplacé par `app/api/games/flag/`)
- **Documentation et plans obsolètes :**
  - `InstructionGame.md`
  - `plan_correction_v2.md`
  - `plan_reconstruction_complet.md`

### Consolidé
- La configuration complète de la base de données (Tables, RLS, Realtime) est désormais centralisée dans le fichier `setup_all_games.sql`.

### Validé
- Le projet compile avec succès (`npm run build`).
- Toutes les routes API restantes correspondent aux jeux actifs.
