-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Rooms table
create table if not exists public.rooms (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,
  host_id text, -- storing the socket/client ID or player ID
  status text not null default 'waiting', -- 'waiting', 'in_game', 'finished'
  game_type text not null,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Players table
create table if not exists public.players (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid references public.rooms(id) on delete cascade,
  name text not null,
  is_host boolean default false,
  score integer default 0,
  joined_at timestamptz default now(),
  unique(room_id, name) -- Prevent duplicate names in a room
);

-- Game State table (to track progress)
create table if not exists public.game_sessions (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid references public.rooms(id) on delete cascade,
  current_round integer default 1,
  total_rounds integer default 5,
  round_data jsonb default '{}'::jsonb, -- Store current question/image
  answers jsonb default '{}'::jsonb, -- Store player answers: { "playerId": { "answer": "...", "time": 123 } }
  status text default 'round_active', -- 'round_active', 'round_results', 'game_over'
  created_at timestamptz default now()
);

-- Enable Realtime for these tables
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.game_sessions;
