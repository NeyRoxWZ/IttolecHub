-- DrawGuessr Tables

create table if not exists draw_games (
  room_id uuid references rooms(id) on delete cascade primary key,
  phase text default 'setup', -- setup, playing, round_results, podium
  current_round int default 1,
  total_rounds int default 5,
  difficulty text default 'mix',
  timer_seconds int default 90,
  timer_start_at timestamptz,
  current_word jsonb, -- { word, category, difficulty }
  current_drawer_id uuid, -- ID of the player currently drawing
  queue jsonb, -- Queue of words
  scores jsonb default '{}'::jsonb,
  found_count int default 0,
  created_at timestamptz default now()
);

create table if not exists draw_players (
  room_id uuid references rooms(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  score int default 0,
  has_guessed boolean default false,
  guess_rank int default 0,
  guess_time_ms int default 0,
  primary key (room_id, player_id)
);

alter publication supabase_realtime add table draw_games;
alter publication supabase_realtime add table draw_players;
