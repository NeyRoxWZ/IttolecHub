'use client';

import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import ImageGuessGame, { type GuessCard, type ImageGuessConfig } from './party/ImageGuessGame';
import { MediaFrame } from './party/ui';

const SIZE = 320;
const GRID = 8;

async function loadDeck(_settings: Record<string, any>, rounds: number): Promise<GuessCard[]> {
  const res = await fetch(`/api/games/logo?count=${rounds}`);
  if (!res.ok) return [];
  const list: { name: string; domain: string; logoUrl: string }[] = await res.json();
  return list.map((l) => ({ id: l.domain, answers: [l.name, l.domain.split('.')[0]], reveal: l.name, logoUrl: l.logoUrl }));
}

/** Same shuffle on every screen for the same logo: the tiles open in the same order for everyone. */
function tileOrder(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const tiles = Array.from({ length: GRID * GRID }, (_, i) => i);
  for (let i = tiles.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 13), 2246822519) >>> 0;
    const j = h % (i + 1);
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles;
}

/** The logo, revealed as the clock runs: blur fades (easy), tiles open (medium) or pixels shrink (hard). */
function LogoMedia({ url, name, playing, progress, mode }: { url: string; name: string; playing: boolean; progress: number; mode: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [failed, setFailed] = useState(false);
  const useCanvas = playing && (mode === 'medium' || mode === 'hard');

  useEffect(() => {
    setImg(null);
    setFailed(false);
    const i = new window.Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => setImg(i);
    i.onerror = () => setFailed(true);
    i.src = url;
  }, [url]);

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!useCanvas || !ctx || !img) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, SIZE, SIZE);
    if (mode === 'hard') {
      const block = Math.max(1, Math.round(48 * (1 - progress)));
      const small = document.createElement('canvas');
      small.width = small.height = Math.max(1, Math.floor(SIZE / block));
      const sctx = small.getContext('2d');
      if (!sctx) return;
      sctx.drawImage(img, 0, 0, small.width, small.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(small, 0, 0, SIZE, SIZE);
    } else {
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      const open = Math.floor(progress * GRID * GRID);
      const cell = SIZE / GRID;
      ctx.fillStyle = '#151942';
      for (const t of tileOrder(url).slice(open)) ctx.fillRect((t % GRID) * cell, Math.floor(t / GRID) * cell, cell + 1, cell + 1);
    }
  }, [useCanvas, img, mode, progress, url]);

  return (
    <MediaFrame className="mx-auto aspect-square max-w-[min(100%,300px)] bg-white p-4">
      {failed ? (
        <div className="flex h-full w-full items-center justify-center font-display text-6xl text-brand-bg">{playing ? '?' : name.slice(0, 2).toUpperCase()}</div>
      ) : useCanvas ? (
        <canvas ref={canvas} width={SIZE} height={SIZE} className="h-full w-full" style={{ imageRendering: mode === 'hard' ? 'pixelated' : 'auto' }} />
      ) : (
        <img
          src={url}
          alt={playing ? 'Logo à deviner' : `Logo : ${name}`}
          draggable={false}
          className="h-full w-full select-none object-contain"
          style={playing && mode === 'easy' ? { filter: `blur(${Math.round(18 * (1 - progress))}px)` } : undefined}
        />
      )}
    </MediaFrame>
  );
}

const CONFIG: ImageGuessConfig = {
  gameType: 'logoguessr',
  title: 'LogoGuessr',
  tagline: 'Reconnais la marque.',
  icon: ImageIcon,
  swatch: { fill: '#FF4F8B', shade: '#C92D63' },
  defaultTime: 15,
  defaultRounds: 5,
  flavor: 'Les experts des marques.',
  placeholder: 'Nom de la marque…',
  rules: [
    'Un logo se dévoile petit à petit : flou, en cases ou pixelisé selon la difficulté.',
    'Tape le nom de la marque. Une petite faute passe.',
    'Tu peux proposer autant de fois que tu veux.',
    'Plus tu trouves vite, plus tu marques. Bonus pour le premier.',
  ],
  loadDeck,
  renderMedia: (card, { playing, progress, settings }) => (
    <LogoMedia url={String(card.logoUrl)} name={card.reveal} playing={playing} progress={progress} mode={String(settings.difficulty || 'easy')} />
  ),
};

export default function LogoGuessr({ roomCode }: { roomCode: string }) {
  return <ImageGuessGame roomCode={roomCode} config={CONFIG} />;
}
