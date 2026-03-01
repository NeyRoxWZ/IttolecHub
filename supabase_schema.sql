-- Table pour stocker les actions de jeu de manière séquentielle et robuste
-- Cela évite les conflits d'écriture (Race Conditions) quand plusieurs joueurs jouent en même temps
create table if not exists game_moves (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references rooms(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  action_type text not null, -- ex: 'clue', 'vote', 'skip_vote', 'ready'
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Active le temps réel pour que les clients reçoivent les actions instantanément
alter publication supabase_realtime add table game_moves;

-- Index pour les performances
create index if not exists idx_game_moves_room_id on game_moves(room_id);

-- (Optionnel) Nettoyage automatique des vieux moves (via extension pg_cron si dispo, sinon manuel)
-- policy RLS (si activé) : tout le monde peut lire/écrire dans sa room
-- alter table game_moves enable row level security;
-- create policy "Public access" on game_moves for all using (true) with check (true);
