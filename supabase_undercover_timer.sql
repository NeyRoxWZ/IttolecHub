-- Ajouter les colonnes pour le timer serveur
alter table undercover_games add column if not exists timer_start_at timestamptz;
alter table undercover_games add column if not exists timer_duration_seconds int;
