-- Badge OG : une distinction posée sur le compte lui-même (pas sur le pseudo),
-- pour qu'elle suive le joueur quand il change de pseudo.
--
-- is_og            : le compte fait partie des OG (réservé, posé à la main ici).
-- og_badge_visible : le joueur choisit d'afficher ou de masquer sa distinction.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_og boolean NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS og_badge_visible boolean NOT NULL DEFAULT true;

-- Les OG de la première heure.
UPDATE public.users
SET is_og = true
WHERE lower(pseudo) IN ('axlr04', 'matheo', 'lennybar');

-- Le site lit la liste des OG à chaque chargement : un index pour ne pas
-- balayer toute la table.
CREATE INDEX IF NOT EXISTS users_is_og_idx ON public.users (is_og) WHERE is_og;
