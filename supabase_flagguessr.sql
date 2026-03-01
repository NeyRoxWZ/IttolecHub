
-- Enable Realtime
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table game_sessions;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table game_moves;

-- FlagGuessr Tables

create table if not exists flag_games (
  room_id uuid references rooms(id) on delete cascade primary key,
  phase text default 'setup', -- setup, playing, round_results, podium
  current_round int default 1,
  total_rounds int default 10,
  region text default 'all',
  mode text default 'mcq', -- mcq, text
  timer_seconds int default 20,
  timer_start_at timestamptz,
  current_flag jsonb, -- { name, code, options: [] }
  scores jsonb default '{}'::jsonb, -- Backup scores or round scores
  created_at timestamptz default now()
);

create table if not exists flag_players (
  room_id uuid references rooms(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  score int default 0,
  last_answer text,
  has_answered boolean default false,
  answer_time_ms int,
  primary key (room_id, player_id)
);

alter publication supabase_realtime add table flag_games;
alter publication supabase_realtime add table flag_players;
