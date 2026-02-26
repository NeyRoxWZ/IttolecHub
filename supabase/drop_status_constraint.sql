
-- Drop potential status constraint that might block updates
alter table public.rooms drop constraint if exists rooms_status_check;

-- Ensure no other constraints block 'in_game' or 'closed' values
-- We leave status column without check constraint for flexibility
