'use client';

import { Zap } from 'lucide-react';
import LadderGame from '../_components/LadderGame';

export default function DinoPage() {
  return <LadderGame gameSlug="dino" title="Frenly Dino" stepLabel="Obstacle" icon={Zap} bustMessage="Impact ! Le dino n'a pas esquivé." />;
}
