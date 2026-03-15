-- Migration: Add round_id to all game tables
-- Run this in Supabase SQL Editor to add round_id to existing tables

-- ==========================================
-- UNDERCOVER
-- ==========================================
ALTER TABLE undercover_games ADD COLUMN IF NOT EXISTS round_id text;
ALTER TABLE undercover_players ADD COLUMN IF NOT EXISTS round_id text;
ALTER TABLE undercover_clues ADD COLUMN IF NOT EXISTS round_id text;
ALTER TABLE undercover_votes ADD COLUMN IF NOT EXISTS round_id text;

-- Drop old primary key and add new one with round_id
DO $$ 
BEGIN
    -- Handle players
    IF (SELECT COUNT(*) FROM information_schema.table_constraints 
        WHERE constraint_name = 'undercover_players_pkey') > 0 THEN
        ALTER TABLE undercover_players DROP CONSTRAINT undercover_players_pkey;
    END IF;
    ALTER TABLE undercover_players ADD PRIMARY KEY (room_id, round_id, player_id);
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS undercover_players_round_idx ON undercover_players(room_id, round_id);
CREATE INDEX IF NOT EXISTS undercover_clues_round_idx ON undercover_clues(room_id, round_id);
CREATE INDEX IF NOT EXISTS undercover_votes_round_idx ON undercover_votes(room_id, round_id);

-- ==========================================
-- INFILTRE
-- ==========================================
ALTER TABLE infiltre_games ADD COLUMN IF NOT EXISTS round_id text;
ALTER TABLE infiltre_players ADD COLUMN IF NOT EXISTS round_id text;
ALTER TABLE infiltre_questions ADD COLUMN IF NOT EXISTS round_id text;
ALTER TABLE infiltre_votes ADD COLUMN IF NOT EXISTS round_id text;

-- Drop old primary key and add new one with round_id
DO $$ 
BEGIN
    IF (SELECT COUNT(*) FROM information_schema.table_constraints 
        WHERE constraint_name = 'infiltre_players_pkey') > 0 THEN
        ALTER TABLE infiltre_players DROP CONSTRAINT infiltre_players_pkey;
    END IF;
    ALTER TABLE infiltre_players ADD PRIMARY KEY (room_id, round_id, player_id);
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS infiltre_players_round_idx ON infiltre_players(room_id, round_id);
CREATE INDEX IF NOT EXISTS infiltre_questions_round_idx ON infiltre_questions(room_id, round_id);
CREATE INDEX IF NOT EXISTS infiltre_votes_round_idx ON infiltre_votes(room_id, round_id);

-- ==========================================
-- FLAGGUESSR
-- ==========================================
ALTER TABLE flag_games ADD COLUMN IF NOT EXISTS round_id text;

-- ==========================================
-- WIKIGUESSR
-- ==========================================
ALTER TABLE wiki_games ADD COLUMN IF NOT EXISTS round_id text;

-- ==========================================
-- BUDGETGUESSR
-- ==========================================
ALTER TABLE budget_games ADD COLUMN IF NOT EXISTS round_id text;

-- ==========================================
-- POKEGUESSR
-- ==========================================
ALTER TABLE poke_games ADD COLUMN IF NOT EXISTS round_id text;

-- ==========================================
-- RENTGUESSR
-- ==========================================
ALTER TABLE rent_games ADD COLUMN IF NOT EXISTS round_id text;

-- ==========================================
-- AIRBNBGUESSR
-- ==========================================
ALTER TABLE airbnb_games ADD COLUMN IF NOT EXISTS round_id text;

-- ==========================================
-- LOGOGUESSR
-- ==========================================
ALTER TABLE logo_games ADD COLUMN IF NOT EXISTS round_id text;

-- ==========================================
-- DRAWGUESSR (if not already added)
-- ==========================================
ALTER TABLE draw_games ADD COLUMN IF NOT EXISTS round_id text;
ALTER TABLE draw_strokes ADD COLUMN IF NOT EXISTS round_id text;

-- Create index for draw_strokes
CREATE INDEX IF NOT EXISTS draw_strokes_round_id_idx ON draw_strokes(round_id);
