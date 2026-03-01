-- WikiGuessr Tables

create table if not exists wiki_games (
  room_id uuid references rooms(id) on delete cascade primary key,
  phase text default 'setup', -- setup, playing, round_results, podium
  current_round int default 1,
  total_rounds int default 5,
  category text default 'all',
  timer_seconds int default 60,
  timer_start_at timestamptz,
  current_article jsonb, -- { title, extract_obfuscated, extract_original, image_url, ... }
  scores jsonb default '{}'::jsonb,
  found_count int default 0, -- Track how many players found the answer in this round
  created_at timestamptz default now()
);

create table if not exists wiki_players (
  room_id uuid references rooms(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  score int default 0,
  has_found boolean default false,
  find_rank int default 0, -- 1st, 2nd, 3rd...
  find_time_ms int default 0,
  primary key (room_id, player_id)
);

alter publication supabase_realtime add table wiki_games;
alter publication supabase_realtime add table wiki_players;
