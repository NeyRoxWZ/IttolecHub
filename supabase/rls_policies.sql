
-- RLS Policies
alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.game_sessions enable row level security;

-- Allow read access to all for now (development mode)
-- In production, we should restrict based on room_id
create policy "Allow public read access to rooms" on public.rooms for select using (true);
create policy "Allow public insert access to rooms" on public.rooms for insert with check (true);
create policy "Allow public update access to rooms" on public.rooms for update using (true);
create policy "Allow public delete access to rooms" on public.rooms for delete using (true);

create policy "Allow public read access to players" on public.players for select using (true);
create policy "Allow public insert access to players" on public.players for insert with check (true);
create policy "Allow public update access to players" on public.players for update using (true);
create policy "Allow public delete access to players" on public.players for delete using (true);

create policy "Allow public read access to game_sessions" on public.game_sessions for select using (true);
create policy "Allow public insert access to game_sessions" on public.game_sessions for insert with check (true);
create policy "Allow public update access to game_sessions" on public.game_sessions for update using (true);
create policy "Allow public delete access to game_sessions" on public.game_sessions for delete using (true);
