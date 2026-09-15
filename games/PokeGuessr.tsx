'use client';

import { Zap } from 'lucide-react';
import { shuffle } from '@/lib/party/text';
import ImageGuessGame, { type GuessCard, type ImageGuessConfig } from './party/ImageGuessGame';

const GENERATIONS: Record<number, [number, number]> = {
  1: [1, 151], 2: [152, 251], 3: [252, 386], 4: [387, 493], 5: [494, 649], 6: [650, 721], 7: [722, 809], 8: [810, 905], 9: [906, 1025],
};

async function loadDeck(settings: Record<string, any>, rounds: number): Promise<GuessCard[]> {
  const raw = Array.isArray(settings.gens) ? settings.gens : String(settings.gens || '1').split(',');
  const gens = raw.map(Number).filter((g: number) => GENERATIONS[g]);
  const ids: number[] = [];
  for (const g of gens.length ? gens : [1]) {
    const [from, to] = GENERATIONS[g];
    for (let i = from; i <= to; i++) ids.push(i);
  }
  const cards = await Promise.all(
    shuffle(ids).slice(0, rounds + 3).map(async (id) => {
      try {
        const res = await fetch(`/api/games/pokemon?id=${id}`);
        if (!res.ok) return null;
        const p = await res.json();
        const fr = p.names?.fr || p.names?.en;
        const en = p.names?.en;
        return {
          id: p.id,
          answers: Array.from(new Set(Object.values(p.names || {}).map(String))),
          reveal: fr,
          detail: en && en !== fr ? `En anglais : ${en}` : undefined,
          imageUrl: p.imageUrl,
        } as GuessCard;
      } catch {
        return null;
      }
    }),
  );
  return cards.filter((c): c is GuessCard => !!c).slice(0, rounds);
}

const CONFIG: ImageGuessConfig = {
  gameType: 'pokeguessr',
  title: 'PokéGuessr',
  tagline: 'Quel est ce Pokémon ?',
  question: 'Quel est ce Pokémon ?',
  icon: Zap,
  swatch: { fill: '#FF8A1F', shade: '#CC6508' },
  defaultTime: 30,
  defaultRounds: 5,
  flavor: 'Les meilleurs dresseurs.',
  placeholder: 'Nom du Pokémon…',
  rules: [
    'Un Pokémon apparaît : flou, en ombre ou à l’envers selon le mode.',
    'Tape son nom, en français ou en anglais. Une petite faute passe.',
    'Tu peux proposer autant de fois que tu veux.',
    'Plus tu trouves vite, plus tu marques. Bonus pour le premier.',
  ],
  loadDeck,
  ratio: 1,
  // A light backdrop: the black silhouette has to stand out.
  frameClass: 'bg-[radial-gradient(circle_at_50%_45%,#FFFFFF_0%,#DDE3FF_55%,#9FA9E8_100%)]',
  renderMedia: (card, { playing, settings }) => {
    const mode = settings.difficulty || 'normal';
    const style = !playing ? {} : mode === 'easy' ? { filter: 'blur(14px)' } : mode === 'hard' ? { filter: 'brightness(0)', transform: 'rotate(180deg)' } : { filter: 'brightness(0)' };
    return (
      <img
        src={String(card.imageUrl)}
        alt={playing ? 'Pokémon à deviner' : card.reveal}
        draggable={false}
        onContextMenu={(e) => e.preventDefault()}
        className="h-full w-full select-none object-contain p-[6%] transition-[filter,transform] duration-700"
        style={style}
      />
    );
  },
};

export default function PokeGuessr({ roomCode }: { roomCode: string }) {
  return <ImageGuessGame roomCode={roomCode} config={CONFIG} />;
}
