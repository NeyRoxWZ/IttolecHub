'use client';

import { DollarSign } from 'lucide-react';
import EstimateGame, { type EstimateCard, type EstimateConfig } from './party/EstimateGame';
import { MediaFrame } from './party/ui';

const millions = (v: number) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v / 1_000_000)} M$`;

async function loadDeck(_settings: Record<string, any>, rounds: number): Promise<EstimateCard[]> {
  const res = await fetch(`/api/games/budget?count=${rounds}`);
  if (!res.ok) return [];
  const movies: { id: number; title: string; poster_path: string | null; release_date: string; genres: string[]; budget: number }[] = await res.json();
  return movies.map((m) => ({ id: m.id, value: m.budget, title: m.title, poster: m.poster_path, year: m.release_date, genres: m.genres }));
}

/** Poster on the left, title and details on the right: fits any height it is given. */
function MovieCard({ card }: { card: EstimateCard }) {
  return (
    <MediaFrame className="flex h-full min-h-0 w-full gap-3 bg-brand-card p-2 sm:p-3">
      <div className="h-full min-h-0 shrink-0 overflow-hidden rounded-xl border-[3px] border-brand-border bg-brand-inner" style={{ aspectRatio: '2 / 3' }}>
        {card.poster ? <img src={String(card.poster)} alt={`Affiche de ${card.title}`} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center p-2 text-center text-sm font-bold text-tx-muted">Pas d’affiche</div>}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
        <p className="text-[11px] font-black uppercase tracking-widest text-tx-secondary">Budget du film</p>
        <h2 className="font-display text-2xl leading-tight [overflow-wrap:anywhere] sm:text-3xl">{String(card.title)}</h2>
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-md border-2 border-brand-border bg-brand-inner px-2 font-display text-sm">{String(card.year)}</span>
          {(card.genres as string[] | undefined)?.slice(0, 3).map((g) => (
            <span key={g} className="rounded-md border-2 border-brand-border bg-accent-primary px-2 font-display text-sm text-brand-bg">{g}</span>
          ))}
        </div>
      </div>
    </MediaFrame>
  );
}

const CONFIG: EstimateConfig = {
  gameType: 'budgetguessr',
  title: 'BudgetGuessr',
  tagline: 'Combien a coûté ce film ?',
  question: 'Combien a coûté ce film ?',
  icon: DollarSign,
  swatch: { fill: '#1FB866', shade: '#158A4B' },
  defaultTime: 30,
  defaultRounds: 5,
  flavor: 'Les producteurs de la soirée.',
  placeholder: 'En millions de dollars',
  prefix: <span className="font-display">M$</span>,
  unitOf: (typed) => typed * 1_000_000,
  format: millions,
  rules: [
    'Un film s’affiche avec son affiche, son année et ses genres.',
    'Estime son budget en millions de dollars. Tu peux changer d’avis jusqu’à la fin.',
    'Moins de 5 % d’écart : 1000 points, puis 700, 400 et 200.',
    '200 points de bonus si tu réponds dans les 10 premières secondes.',
  ],
  loadDeck,
  renderCard: (card) => <MovieCard card={card} />,
};

export default function BudgetGuesser({ roomCode }: { roomCode: string }) {
  return <EstimateGame roomCode={roomCode} config={CONFIG} />;
}
