-- Schéma Supabase pour les jeux sociaux (L'Infiltré & Undercover)
-- À exécuter dans le SQL editor Supabase.

-- Types généraux
create type public.game_type as enum ('infiltre', 'undercover');

create type public.infiltre_phase as enum (
  'roles',
  'question',
  'vote1',
  'vote2',
  'end'
);

create type public.undercover_phase as enum (
  'roles',
  'clues',
  'vote',
  'mrwhite_guess',
  'end'
);

create type public.infiltre_role as enum ('MASTER', 'INFILTRATE', 'CITIZEN');
create type public.undercover_role as enum ('CIVIL', 'UNDERCOVER', 'MR_WHITE');

-- Joueurs par room et par partie
create table if not exists public.game_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_name text not null,
  game_type public.game_type not null,
  role_infiltre public.infiltre_role,
  role_undercover public.undercover_role,
  is_alive boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists game_players_room_idx on public.game_players(room_id);

-- État courant de la partie par room
create table if not exists public.game_state (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  game_type public.game_type not null,
  infiltré_phase public.infiltre_phase,
  undercover_phase public.undercover_phase,
  current_round integer not null default 1,
  current_turn_player text,
  secret_word text,
  undercover_civil_word text,
  undercover_undercover_word text,
  timer_expires_at timestamptz,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists game_state_room_type_uniq
  on public.game_state(room_id, game_type);

-- Votes (Infiltré vote 1 & 2, Undercover éliminations)
create table if not exists public.game_votes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  game_type public.game_type not null,
  phase text not null,
  voter_name text not null,
  target_name text,
  created_at timestamptz not null default now()
);

create index if not exists game_votes_room_phase_idx
  on public.game_votes(room_id, game_type, phase);

