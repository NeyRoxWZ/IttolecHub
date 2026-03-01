
alter table flag_games add column if not exists queue jsonb default '[]'::jsonb;
