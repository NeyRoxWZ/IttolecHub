'use client';

import { Flag } from 'lucide-react';
import ImageGuessGame, { type GuessCard, type ImageGuessConfig } from './party/ImageGuessGame';

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
  question: 'À quel pays est ce drapeau ?',
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
  ratio: 3 / 2,
  frameClass: 'bg-[#DDE3FF]',
  renderMedia: (card, { playing }) => (
    <img src={String(card.flagUrl)} alt={playing ? 'Drapeau à deviner' : `Drapeau : ${card.reveal}`} draggable={false} className="h-full w-full select-none object-contain p-[5%] drop-shadow" />
  ),
};

export default function FlagGuesser({ roomCode }: { roomCode: string }) {
  return <ImageGuessGame roomCode={roomCode} config={CONFIG} />;
}
