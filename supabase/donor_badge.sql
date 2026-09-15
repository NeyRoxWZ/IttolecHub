-- Badge Donateur, et un choix afficher/masquer par badge.
--
-- is_donor      : le compte a fait un don (posé à la main).
-- hidden_badges : les badges que le joueur a choisi de masquer ('og', 'founder', 'donor').
--                 Remplace le seul interrupteur og_badge_visible, gardé pour l'historique.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_donor boolean NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS hidden_badges text[] NOT NULL DEFAULT '{}';

-- Ceux qui avaient masqué leur distinction la gardent masquée.
UPDATE public.users SET hidden_badges = ARRAY['og', 'founder'] WHERE og_badge_visible = false;

-- Publiques comme les autres colonnes de badge.
GRANT SELECT (is_donor, hidden_badges) ON public.users TO anon, authenticated;

CREATE INDEX IF NOT EXISTS users_is_donor_idx ON public.users (is_donor) WHERE is_donor;

-- Donner le badge à un joueur :
-- UPDATE public.users SET is_donor = true WHERE lower(pseudo) = lower('PseudoExact');
