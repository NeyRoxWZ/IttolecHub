-- ==========================================
-- ITTOLEC HUB - UNDERCOVER COMPLETE SQL SETUP
-- ==========================================

-- 1. MISE À JOUR TABLE PLAYERS (Gestion du statut Prêt)
-- Ajoute une colonne pour suivre l'état 'Prêt' de chaque joueur individuellement
alter table players add column if not exists is_ready boolean default false;

-- 2. TABLE GAME MOVES (Event Sourcing / Concurrence)
-- Stocke les actions (indices, votes) séquentiellement pour éviter les conflits
create table if not exists game_moves (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references rooms(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  action_type text not null, -- 'clue', 'vote', 'skip_vote', 'guess', etc.
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Index pour performance
create index if not exists idx_game_moves_room_id on game_moves(room_id);

-- 3. TABLES SPÉCIFIQUES UNDERCOVER

-- A. État global de la partie
create table if not exists undercover_games (
  room_id uuid references rooms(id) on delete cascade primary key,
  phase text default 'setup', -- 'setup', 'roles', 'clues', 'discussion', 'vote', 'results', 'game_over'
  civil_word text,
  undercover_word text,
  current_speaker_id uuid references players(id),
  current_clue_round int default 1,
  winner text, -- 'CIVIL', 'UNDERCOVER', 'MR_WHITE'
  eliminated_player_id uuid references players(id),
  created_at timestamptz default now()
);

-- B. Rôles et état des joueurs pour la manche en cours
create table if not exists undercover_players (
  room_id uuid references rooms(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  role text not null, -- 'CIVIL', 'UNDERCOVER', 'MR_WHITE'
  is_alive boolean default true,
  primary key (room_id, player_id)
);

-- C. Historique des Indices (Clues)
create table if not exists undercover_clues (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references rooms(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  text text not null,
  round_number int default 1,
  created_at timestamptz default now()
);

-- D. Historique des Votes
create table if not exists undercover_votes (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references rooms(id) on delete cascade,
  voter_id uuid references players(id) on delete cascade,
  target_id uuid references players(id) on delete cascade,
  created_at timestamptz default now()
);

-- 4. ACTIVATION DU TEMPS RÉEL (REALTIME)
-- Permet aux clients de recevoir les mises à jour instantanément

-- Vérification et ajout à la publication supabase_realtime
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'game_moves') then
    alter publication supabase_realtime add table game_moves;
  end if;
  
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'undercover_games') then
    alter publication supabase_realtime add table undercover_games;
  end if;
  
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'undercover_players') then
    alter publication supabase_realtime add table undercover_players;
  end if;
  
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'undercover_clues') then
    alter publication supabase_realtime add table undercover_clues;
  end if;
  
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'undercover_votes') then
    alter publication supabase_realtime add table undercover_votes;
  end if;
end;
$$;

-- 5. POLITIQUES DE SÉCURITÉ (RLS) - OPTIONNEL / PAR DÉFAUT PUBLIC
-- Si vous activez RLS, décommentez ceci :
/*
alter table game_moves enable row level security;
create policy "Public access" on game_moves for all using (true) with check (true);

alter table undercover_games enable row level security;
create policy "Public access" on undercover_games for all using (true) with check (true);
-- Idem pour les autres tables...
*/
