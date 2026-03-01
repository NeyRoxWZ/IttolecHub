-- BudgetGuessr Tables

create table if not exists budget_games (
  room_id uuid references rooms(id) on delete cascade primary key,
  phase text default 'setup', -- setup, playing, round_results, podium
  current_round int default 1,
  total_rounds int default 5,
  decade text default 'all',
  difficulty text default 'normal',
  timer_seconds int default 30,
  timer_start_at timestamptz,
  current_movie jsonb, -- { title, poster_path, budget, release_date, genres, ... }
  queue jsonb, -- Queue of upcoming movies
  scores jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists budget_players (
  room_id uuid references rooms(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  score int default 0,
  last_guess bigint, -- The budget guessed
  guess_diff_percent float,
  guess_time_ms int,
  has_guessed boolean default false,
  primary key (room_id, player_id)
);

alter publication supabase_realtime add table budget_games;
alter publication supabase_realtime add table budget_players;
