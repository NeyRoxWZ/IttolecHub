-- Enable Realtime for all game tables
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table game_sessions;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table game_moves;

-- ==========================================
-- UNDERCOVER TABLES
-- ==========================================

create table if not exists undercover_games (
  room_id uuid references rooms(id) on delete cascade primary key,
  phase text default 'setup',
  civil_word text,
  undercover_word text,
  current_speaker_id uuid,
  current_clue_round int default 1,
  winner text, -- 'CIVILS' or 'IMPOSTORS'
  eliminated_player_id uuid,
  skip_votes text[] default array[]::text[],
  timer_start_at timestamptz,
  timer_duration_seconds int,
  created_at timestamptz default now()
);

create table if not exists undercover_players (
  room_id uuid references rooms(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  role text, -- 'CIVIL', 'UNDERCOVER', 'MR_WHITE'
  is_alive boolean default true,
  primary key (room_id, player_id)
);

create table if not exists undercover_clues (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references rooms(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  text text not null,
  round_number int,
  created_at timestamptz default now()
);

create table if not exists undercover_votes (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references rooms(id) on delete cascade,
  voter_id uuid references players(id) on delete cascade,
  target_id uuid references players(id) on delete cascade,
  created_at timestamptz default now()
);

alter publication supabase_realtime add table undercover_games;
alter publication supabase_realtime add table undercover_players;
alter publication supabase_realtime add table undercover_clues;
alter publication supabase_realtime add table undercover_votes;

-- ==========================================
-- INFILTRE TABLES
-- ==========================================

create table if not exists infiltre_games (
  room_id uuid references rooms(id) on delete cascade primary key,
  phase text default 'setup',
  secret_word text,
  category text,
  master_id uuid,
  finder_id uuid,
  winner text, -- 'CITIZENS', 'INFILTRE', 'NONE'
  timer_start_at timestamptz,
  timer_duration_seconds int,
  created_at timestamptz default now()
);

create table if not exists infiltre_players (
  room_id uuid references rooms(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  role text, -- 'MASTER', 'INFILTRE', 'CITIZEN'
  is_alive boolean default true,
  primary key (room_id, player_id)
);

create table if not exists infiltre_questions (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references rooms(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  text text not null,
  answer text, -- 'OUI', 'NON', 'NE_SAIS_PAS', null
  created_at timestamptz default now()
);

create table if not exists infiltre_votes (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references rooms(id) on delete cascade,
  voter_id uuid references players(id) on delete cascade,
  target_id uuid references players(id) on delete cascade,
  vote_phase text, -- 'FINDER' or 'INFILTRE'
  created_at timestamptz default now()
);

alter publication supabase_realtime add table infiltre_games;
alter publication supabase_realtime add table infiltre_players;
alter publication supabase_realtime add table infiltre_questions;
alter publication supabase_realtime add table infiltre_votes;

-- ==========================================
-- FLAGGUESSER TABLES
-- ==========================================

create table if not exists flag_games (
  room_id uuid references rooms(id) on delete cascade primary key,
  phase text default 'setup', -- setup, playing, round_results, podium
  current_round int default 1,
  total_rounds int default 10,
  region text default 'all',
  mode text default 'mcq', -- mcq, text
  timer_seconds int default 20,
  timer_start_at timestamptz,
  current_flag jsonb, -- { name, code, flagUrl, options: [] }
  queue jsonb, -- Array of upcoming flags
  scores jsonb default '{}'::jsonb, -- Backup scores
  created_at timestamptz default now()
);

-- Add queue column if it doesn't exist (for migration)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'flag_games' and column_name = 'queue') then
    alter table flag_games add column queue jsonb;
  end if;
end $$;

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

-- RentGuessr Tables

create table if not exists rent_games (
  room_id uuid references rooms(id) on delete cascade primary key,
  phase text default 'setup', -- setup, playing, round_results, podium
  current_round int default 1,
  total_rounds int default 5,
  timer_seconds int default 30,
  timer_start_at timestamptz,
  current_property jsonb, -- { id, city, postal_code, photo_url, price_per_month, surface_m2, nb_rooms, nb_bedrooms, property_type, latitude, longitude }
  queue jsonb, -- Queue of upcoming properties
  scores jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists rent_players (
  room_id uuid references rooms(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  score int default 0,
  last_guess int, -- The rent guessed
  guess_diff_percent float,
  guess_time_ms int,
  has_guessed boolean default false,
  primary key (room_id, player_id)
);

alter publication supabase_realtime add table rent_games;
alter publication supabase_realtime add table rent_players;

-- AirbnbGuessr Tables

create table if not exists airbnb_games (
  room_id uuid references rooms(id) on delete cascade primary key,
  phase text default 'setup', -- setup, playing, round_results, podium
  current_round int default 1,
  total_rounds int default 5,
  timer_seconds int default 30,
  timer_start_at timestamptz,
  current_listing jsonb, -- { id, city, neighbourhood, photo_url, price_per_night, accommodates, bedrooms, room_type }
  queue jsonb, -- Queue of upcoming listings
  scores jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists airbnb_players (
  room_id uuid references rooms(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  score int default 0,
  last_guess int, -- The price guessed
  guess_diff_percent float,
  guess_time_ms int,
  has_guessed boolean default false,
  primary key (room_id, player_id)
);

alter publication supabase_realtime add table airbnb_games;
alter publication supabase_realtime add table airbnb_players;

-- LogoGuessr Tables

create table if not exists logo_games (
  room_id uuid references rooms(id) on delete cascade primary key,
  phase text default 'setup', -- setup, playing, round_results, podium
  current_round int default 1,
  total_rounds int default 5,
  category text default 'all',
  difficulty text default 'mix',
  timer_seconds int default 15, -- 5s * 3 steps
  timer_start_at timestamptz,
  current_logo jsonb, -- { name, slug, sector, difficulty }
  queue jsonb, -- Queue of upcoming logos
  scores jsonb default '{}'::jsonb,
  found_count int default 0,
  created_at timestamptz default now()
);

create table if not exists logo_players (
  room_id uuid references rooms(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  score int default 0,
  has_found boolean default false,
  find_rank int default 0,
  find_time_ms int default 0,
  last_guess text,
  primary key (room_id, player_id)
);

alter publication supabase_realtime add table logo_games;
alter publication supabase_realtime add table logo_players;
