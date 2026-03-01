-- Tables dédiées pour le jeu L'Infiltré (Infiltre)

-- 1. État global de la partie Infiltré
create table if not exists infiltre_games (
  room_id uuid references rooms(id) on delete cascade primary key,
  phase text default 'setup', -- 'setup', 'roles', 'playing', 'voting_finder', 'voting_infiltre', 'results'
  secret_word text,
  category text,
  master_id uuid references players(id),
  finder_id uuid references players(id), -- Le joueur qui a trouvé le mot (pour le 1er vote)
  timer_start_at timestamptz,
  timer_duration_seconds int,
  winner text, -- 'CITIZENS', 'INFILTRE'
  created_at timestamptz default now()
);

-- 2. Rôles et état des joueurs
create table if not exists infiltre_players (
  room_id uuid references rooms(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  role text not null, -- 'MASTER', 'INFILTRE', 'CITIZEN'
  is_alive boolean default true,
  primary key (room_id, player_id)
);

-- 3. Questions posées
create table if not exists infiltre_questions (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references rooms(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  text text not null,
  answer text, -- 'OUI', 'NON', 'NE_SAIS_PAS', NULL (pas encore répondu)
  created_at timestamptz default now()
);

-- 4. Votes (Tour 1 et Tour 2)
create table if not exists infiltre_votes (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references rooms(id) on delete cascade,
  voter_id uuid references players(id) on delete cascade,
  target_id uuid references players(id) on delete cascade, -- Pour qui on vote (accuse d'être Infiltré)
  vote_phase text not null, -- 'FINDER' (vote sur celui qui a trouvé) ou 'INFILTRE' (2ème vote général)
  created_at timestamptz default now()
);

-- Activation Realtime
alter publication supabase_realtime add table infiltre_games;
alter publication supabase_realtime add table infiltre_players;
alter publication supabase_realtime add table infiltre_questions;
alter publication supabase_realtime add table infiltre_votes;
