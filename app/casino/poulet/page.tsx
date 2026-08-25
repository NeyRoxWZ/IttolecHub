'use client';

import { Egg } from 'lucide-react';
import LadderGame from '../_components/LadderGame';

export default function PouletPage() {
  return <LadderGame gameSlug="poulet" title="Frenly Poulet" stepLabel="Voie" icon={Egg} bustMessage="Écrasé ! Le poulet n'a pas survécu." />;
}
