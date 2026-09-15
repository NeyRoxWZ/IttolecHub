'use client';

import { Flag } from 'lucide-react';
import ImageGuessGame, { type GuessCard, type ImageGuessConfig } from './party/ImageGuessGame';
import { MediaFrame } from './party/ui';

async function loadDeck(settings: Record<string, any>, rounds: number): Promise<GuessCard[]> {
  const region = encodeURIComponent(String(settings.region || 'all'));
  const res = await fetch(`/api/games/flag?count=${rounds}&region=${region}`);
  if (!res.ok) return [];
  const list: { name: string; code: string; flagUrl: string }[] = await res.json();
  return list.map((c) => ({ id: c.code, answers: [c.name], reveal: c.name, flagUrl: c.flagUrl }));
}

const CONFIG: ImageGuessConfig = {
  gameType: 'flagguessr',
  title: 'FlagGuessr',
  tagline: 'À quel pays est ce drapeau ?',
  icon: Flag,
  swatch: { fill: '#3B6BFF', shade: '#2A4FC4' },
  defaultTime: 15,
  defaultRounds: 10,
  flavor: 'Les globe-trotteurs.',
  placeholder: 'Nom du pays…',
  rules: [
    'Un drapeau s’affiche.',
    'Tape le nom du pays en français. Une petite faute passe.',
    'Tu peux proposer autant de fois que tu veux.',
    'Plus tu trouves vite, plus tu marques. Bonus pour le premier.',
  ],
  loadDeck,
  renderMedia: (card, { playing }) => (
    <MediaFrame className="mx-auto aspect-[3/2] max-w-xl p-4 sm:p-6">
      <img src={String(card.flagUrl)} alt={playing ? 'Drapeau à deviner' : `Drapeau : ${card.reveal}`} draggable={false} className="h-full w-full select-none object-contain drop-shadow" />
    </MediaFrame>
  ),
};

export default function FlagGuesser({ roomCode }: { roomCode: string }) {
  return <ImageGuessGame roomCode={roomCode} config={CONFIG} />;
}
