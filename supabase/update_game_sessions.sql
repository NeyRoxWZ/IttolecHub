
-- Update game_sessions table to match new requirements if needed
-- (The table structure in generic_game.sql seems mostly compatible, but we'll ensure RLS is open)

alter table public.game_sessions enable row level security;

-- Drop existing policy if any to avoid conflicts
drop policy if exists "gs_all" on public.game_sessions;

-- Create permissive policy for development
create policy "gs_all" on public.game_sessions for all using (true);

-- Ensure Realtime is enabled
alter publication supabase_realtime add table public.game_sessions;
