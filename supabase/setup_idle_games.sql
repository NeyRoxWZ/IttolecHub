-- Tables pour les jeux Idle et le système de compte Itollec

-- 1. Table des utilisateurs (users)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pseudo TEXT NOT NULL UNIQUE,
  passphrase_hash TEXT,
  discord_id TEXT UNIQUE,
  discord_username TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table des sauvegardes (game_saves)
CREATE TABLE IF NOT EXISTS game_saves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  game_slug TEXT NOT NULL,
  save_data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, game_slug)
);

-- Activer Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_saves ENABLE ROW LEVEL SECURITY;

-- Politiques RLS (à adapter selon le besoin, ici on autorise tout pour le développement)
CREATE POLICY "Public users access" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public game_saves access" ON game_saves FOR ALL USING (true) WITH CHECK (true);
