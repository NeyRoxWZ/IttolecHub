-- FICHIER SQL DE RESET COMPLET ET RECRÉATION
-- ATTENTION : CE SCRIPT SUPPRIME TOUTES LES DONNÉES EXISTANTES !
-- À exécuter dans le SQL Editor de Supabase.

BEGIN;

--------------------------------------------------------------------------------
-- 1. NETTOYAGE (DROP ALL)
--------------------------------------------------------------------------------

-- Supprimer les tables dans l'ordre inverse des dépendances
DROP TABLE IF EXISTS public.game_votes CASCADE;
DROP TABLE IF EXISTS public.game_state CASCADE;
DROP TABLE IF EXISTS public.game_players CASCADE;
DROP TABLE IF EXISTS public.game_sessions CASCADE;
DROP TABLE IF EXISTS public.players CASCADE;
DROP TABLE IF EXISTS public.rooms CASCADE;

-- Supprimer les types énumérés
DROP TYPE IF EXISTS public.game_type CASCADE;
DROP TYPE IF EXISTS public.infiltre_role CASCADE;
DROP TYPE IF EXISTS public.undercover_role CASCADE;
DROP TYPE IF EXISTS public.infiltre_phase CASCADE;
DROP TYPE IF EXISTS public.undercover_phase CASCADE;

--------------------------------------------------------------------------------
-- 2. RECRÉATION DES TYPES
--------------------------------------------------------------------------------

CREATE TYPE public.game_type AS ENUM ('infiltre', 'undercover');
CREATE TYPE public.infiltre_role AS ENUM ('MASTER', 'INFILTRATE', 'CITIZEN');
CREATE TYPE public.undercover_role AS ENUM ('CIVIL', 'UNDERCOVER', 'MR_WHITE');
CREATE TYPE public.infiltre_phase AS ENUM ('roles', 'question', 'vote1', 'vote2', 'end');
CREATE TYPE public.undercover_phase AS ENUM ('roles', 'clues', 'vote', 'mrwhite_guess', 'end');

--------------------------------------------------------------------------------
-- 3. RECRÉATION DES TABLES AVEC RLS PERMISSIVE
--------------------------------------------------------------------------------

-- TABLE: rooms
CREATE TABLE public.rooms (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text UNIQUE NOT NULL,
  host_id text,
  status text NOT NULL DEFAULT 'waiting',
  game_type text,
  settings jsonb DEFAULT '{}'::jsonb,
  host_last_seen_at timestamptz DEFAULT now(),
  mr_white_enabled boolean DEFAULT true,
  vote_duration_seconds integer DEFAULT 60,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rooms_policy_all" ON public.rooms FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;


-- TABLE: players
CREATE TABLE public.players (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid REFERENCES public.rooms(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_host boolean DEFAULT false,
  score integer DEFAULT 0,
  joined_at timestamptz DEFAULT now(),
  avatar text,
  last_seen_at timestamptz DEFAULT now(),
  UNIQUE(room_id, name)
);

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "players_policy_all" ON public.players FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;


-- TABLE: game_sessions (Generic Games: PokeGuessr, etc.)
CREATE TABLE public.game_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid REFERENCES public.rooms(id) ON DELETE CASCADE,
  current_round integer DEFAULT 1,
  total_rounds integer DEFAULT 5,
  round_data jsonb DEFAULT '{}'::jsonb,
  answers jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'round_active',
  created_at timestamptz DEFAULT now(),
  UNIQUE(room_id)
);

ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "game_sessions_policy_all" ON public.game_sessions FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_sessions;


-- TABLE: game_players (Social Games: Infiltré, Undercover)
CREATE TABLE public.game_players (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  player_name text NOT NULL,
  game_type public.game_type NOT NULL,
  role_infiltre public.infiltre_role,
  role_undercover public.undercover_role,
  is_alive boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "game_players_policy_all" ON public.game_players FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_players;


-- TABLE: game_state (Social Games State)
CREATE TABLE public.game_state (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  game_type public.game_type NOT NULL,
  infiltré_phase public.infiltre_phase,
  undercover_phase public.undercover_phase,
  current_round integer NOT NULL DEFAULT 1,
  current_turn_player text,
  secret_word text,
  undercover_civil_word text,
  undercover_undercover_word text,
  timer_expires_at timestamptz,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.game_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "game_state_policy_all" ON public.game_state FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_state;


-- TABLE: game_votes (Social Games Votes)
CREATE TABLE public.game_votes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  game_type public.game_type NOT NULL,
  phase text NOT NULL,
  voter_name text NOT NULL,
  target_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.game_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "game_votes_policy_all" ON public.game_votes FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_votes;


--------------------------------------------------------------------------------
-- 4. PERMISSIONS GLOBALES
--------------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

COMMIT;
