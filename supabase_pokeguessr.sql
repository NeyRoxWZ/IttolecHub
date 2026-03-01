-- PokeGuessr Tables

create table if not exists poke_games (
  room_id uuid references rooms(id) on delete cascade primary key,
  phase text default 'setup', -- setup, playing, round_results, podium
  current_round int default 1,
  total_rounds int default 5,
  difficulty text default 'normal', -- easy, normal, hard
  generations int[] default '{1}',
  timer_seconds int default 30,
  timer_start_at timestamptz,
  current_pokemon jsonb, -- { id, names: {fr, en...}, imageUrl, generation }
  queue jsonb, -- Queue of upcoming pokemon IDs
  scores jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists poke_players (
  room_id uuid references rooms(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  score int default 0,
  has_guessed boolean default false,
  guess_rank int default 0,
  guess_time_ms int default 0,
  last_guess text,
  is_correct boolean default false,
  primary key (room_id, player_id)
);

alter publication supabase_realtime add table poke_games;
alter publication supabase_realtime add table poke_players;
