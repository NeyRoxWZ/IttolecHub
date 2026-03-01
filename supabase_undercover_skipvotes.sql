-- Ajouter la colonne skip_votes à la table undercover_games
alter table undercover_games add column if not exists skip_votes uuid[] default '{}';
