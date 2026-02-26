-- FICHIER SQL COMPLET POUR DÉSACTIVER RLS ET ACTIVER REALTIME SUR TOUTES LES TABLES DU PROJET
-- À exécuter dans le SQL Editor de Supabase en une seule fois.

BEGIN;

--------------------------------------------------------------------------------
-- 1. Table : rooms
--------------------------------------------------------------------------------
-- S'assurer que la table existe (au cas où)
CREATE TABLE IF NOT EXISTS public.rooms (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text UNIQUE NOT NULL,
  host_id text,
  status text NOT NULL DEFAULT 'waiting',
  game_type text,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Désactiver RLS (ou l'activer pour pouvoir appliquer des policies permissives, 
-- mais ici on veut être sûr que tout passe. Le plus simple pour "tout autoriser" via l'API 
-- est d'activer RLS et de mettre une policy TRUE pour tout le monde, car si RLS est désactivé, 
-- l'accès via l'API client peut être restreint selon la config Supabase.
-- La méthode recommandée pour "tout public" est ENABLE RLS + Policy FOR ALL USING (true).
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Supprimer toutes les policies existantes pour repartir de zéro
DROP POLICY IF EXISTS "Enable read access for all users" ON public.rooms;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.rooms;
DROP POLICY IF EXISTS "Enable update for all users" ON public.rooms;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.rooms;
DROP POLICY IF EXISTS "rooms_policy_all" ON public.rooms;

-- Créer une policy unique ultra-permissive
CREATE POLICY "rooms_policy_all"
ON public.rooms
FOR ALL
USING (true)
WITH CHECK (true);

-- Activer Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;


--------------------------------------------------------------------------------
-- 2. Table : players
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.players (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid REFERENCES public.rooms(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_host boolean DEFAULT false,
  score integer DEFAULT 0,
  joined_at timestamptz DEFAULT now(),
  avatar text,
  last_seen_at timestamptz,
  UNIQUE(room_id, name)
);

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.players;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.players;
DROP POLICY IF EXISTS "Enable update for all users" ON public.players;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.players;
DROP POLICY IF EXISTS "players_policy_all" ON public.players;

CREATE POLICY "players_policy_all"
ON public.players
FOR ALL
USING (true)
WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.players;


--------------------------------------------------------------------------------
-- 3. Table : game_sessions
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.game_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid REFERENCES public.rooms(id) ON DELETE CASCADE,
  current_round integer DEFAULT 1,
  total_rounds integer DEFAULT 5,
  round_data jsonb DEFAULT '{}'::jsonb,
  answers jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'round_active',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.game_sessions;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.game_sessions;
DROP POLICY IF EXISTS "Enable update for all users" ON public.game_sessions;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.game_sessions;
DROP POLICY IF EXISTS "game_sessions_policy_all" ON public.game_sessions;
DROP POLICY IF EXISTS "gs_all" ON public.game_sessions;

CREATE POLICY "game_sessions_policy_all"
ON public.game_sessions
FOR ALL
USING (true)
WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.game_sessions;


--------------------------------------------------------------------------------
-- 4. Table : game_players (Utilisée dans social_games.sql)
--------------------------------------------------------------------------------
-- Types enum nécessaires si pas déjà créés
DO $$ BEGIN
    CREATE TYPE public.game_type AS ENUM ('infiltre', 'undercover');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.infiltre_role AS ENUM ('MASTER', 'INFILTRATE', 'CITIZEN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.undercover_role AS ENUM ('CIVIL', 'UNDERCOVER', 'MR_WHITE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.game_players (
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

DROP POLICY IF EXISTS "game_players_policy_all" ON public.game_players;

CREATE POLICY "game_players_policy_all"
ON public.game_players
FOR ALL
USING (true)
WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.game_players;


--------------------------------------------------------------------------------
-- 5. Table : game_state (Utilisée dans social_games.sql)
--------------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE public.infiltre_phase AS ENUM ('roles', 'question', 'vote1', 'vote2', 'end');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.undercover_phase AS ENUM ('roles', 'clues', 'vote', 'mrwhite_guess', 'end');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.game_state (
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

DROP POLICY IF EXISTS "game_state_policy_all" ON public.game_state;

CREATE POLICY "game_state_policy_all"
ON public.game_state
FOR ALL
USING (true)
WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.game_state;


--------------------------------------------------------------------------------
-- 6. Table : game_votes (Utilisée dans social_games.sql)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.game_votes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  game_type public.game_type NOT NULL,
  phase text NOT NULL,
  voter_name text NOT NULL,
  target_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.game_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "game_votes_policy_all" ON public.game_votes;

CREATE POLICY "game_votes_policy_all"
ON public.game_votes
FOR ALL
USING (true)
WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.game_votes;

--------------------------------------------------------------------------------
-- 7. Nettoyage et vérification finale
--------------------------------------------------------------------------------
-- On s'assure que tout le monde peut accéder au schéma public
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

COMMIT;
