
-- Add last_seen_at to players for presence system
alter table public.players add column if not exists last_seen_at timestamptz default now();

-- Update RLS if needed (already public in rls_policies.sql, but ensuring update is allowed)
-- create policy "Allow public update access to players" on public.players for update using (true);
