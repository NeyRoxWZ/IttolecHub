-- Tables dédiées pour le jeu Undercover (Zéro JSON pour l'état)

-- 1. État global de la partie Undercover
create table if not exists undercover_games (
  room_id uuid references rooms(id) on delete cascade primary key,
  phase text default 'setup', -- 'setup', 'roles', 'clues', 'discussion', 'vote', 'results', 'game_over'
  civil_word text,
  undercover_word text,
  current_speaker_id uuid references players(id),
  current_clue_round int default 1,
  created_at timestamptz default now()
);

-- 2. Rôles et état des joueurs
create table if not exists undercover_players (
  room_id uuid references rooms(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  role text not null, -- 'CIVIL', 'UNDERCOVER', 'MR_WHITE'
  is_alive boolean default true,
  primary key (room_id, player_id)
);

-- 3. Indices (Clues)
create table if not exists undercover_clues (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references rooms(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  text text not null,
  round_number int default 1,
  created_at timestamptz default now()
);

-- 4. Votes
create table if not exists undercover_votes (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references rooms(id) on delete cascade,
  voter_id uuid references players(id) on delete cascade,
  target_id uuid references players(id) on delete cascade, -- null si vote blanc/skip ?
  created_at timestamptz default now()
);

-- Activation du Realtime
alter publication supabase_realtime add table undercover_games;
alter publication supabase_realtime add table undercover_players;
alter publication supabase_realtime add table undercover_clues;
alter publication supabase_realtime add table undercover_votes;
