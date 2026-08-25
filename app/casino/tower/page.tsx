'use client';

import { Building2 } from 'lucide-react';
import LadderGame from '../_components/LadderGame';

export default function TowerPage() {
  return <LadderGame gameSlug="tower" title="Frenly Tower" stepLabel="Étage" icon={Building2} bustMessage="Piège ! Tu es tombé." />;
}
