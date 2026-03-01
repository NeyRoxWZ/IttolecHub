-- Mise à jour de la table undercover_games avec les champs manquants
alter table undercover_games add column if not exists winner text;
alter table undercover_games add column if not exists eliminated_player_id uuid references players(id);
