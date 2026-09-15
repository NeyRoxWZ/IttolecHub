'use client';

import { useEffect, useState } from 'react';
import { Users, Gamepad2, Trophy, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
  { title: 'Crée ta salle', text: 'Un code court s’affiche : tes amis le tapent et rejoignent en un clic.', icon: Users },
  { title: 'Choisis un jeu', text: 'L’hôte choisit le mini-jeu, le nombre de manches et le temps.', icon: Gamepad2 },
  { title: 'Jouez ensemble', text: 'Tout le monde joue en direct, le podium tombe à la fin.', icon: Trophy },
];

/** How long each step stays on screen before the demo moves on. */
const STEP_MS = 4800;

const PLAYERS = [
  { initial: 'L', color: '#FF4F8B', shade: '#C92D63' },
  { initial: 'N', color: '#3B6BFF', shade: '#2A4FC4' },
  { initial: 'M', color: '#1FB866', shade: '#158A4B' },
  { initial: 'S', color: '#FF8A1F', shade: '#CC6508' },
];

function Avatar({ p, size = 40, style }: { p: (typeof PLAYERS)[number]; size?: number; style?: React.CSSProperties }) {
  return (
    <span
      className="rounded-xl border-[3px] border-brand-border flex items-center justify-center font-display text-white"
      style={{ width: size, height: size, fontSize: size * 0.5, background: p.color, boxShadow: `inset 0 -4px 0 ${p.shade}`, ...style }}
    >
      {p.initial}
    </span>
  );
}

/** Step 1: the code pops in letter by letter, then friends slide into the room. */
function CreateRoom() {
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex gap-1.5">
        {['A', 'B', 'C', '1', '2', '3'].map((c, i) => (
          <span
            key={i}
            className="htp-pop h-12 w-10 rounded-xl bg-white border-[3px] border-brand-border text-brand-bg font-display text-3xl flex items-center justify-center shadow-[0_4px_0_#05061A]"
            style={{ animationDelay: `${i * 110}ms` }}
          >
            {c}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2">
        {PLAYERS.map((p, i) => (
          <span key={p.initial} className="htp-slide" style={{ animationDelay: `${900 + i * 380}ms` }}>
            <Avatar p={p} />
          </span>
        ))}
      </div>
      <span className="htp-fade text-xs font-black uppercase tracking-widest text-tx-secondary" style={{ animationDelay: '2500ms' }}>
        4 joueurs dans la salle
      </span>
    </div>
  );
}

/** Step 2: the host's pick moves down the list and lands, the settings pop in. */
function PickGame() {
  const games = ['PokéGuessr', 'RentGuessr', 'Undercover'];
  const [active, setActive] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setActive((a) => Math.min(a + 1, 2)), 900);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="w-full max-w-[280px] flex flex-col gap-2">
      {games.map((g, i) => (
        <div
          key={g}
          className={cn(
            'h-11 px-3 rounded-xl border-[3px] border-brand-border flex items-center justify-between font-display text-lg transition-all duration-300',
            i === active
              ? 'bg-accent-primary text-brand-bg shadow-[inset_0_-4px_0_#D98E00,0_4px_0_#05061A] scale-105'
              : 'bg-brand-card text-tx-secondary'
          )}
        >
          {g}
          {i === active && <Crown className="h-5 w-5" />}
        </div>
      ))}
      <div className="flex gap-2 mt-1">
        {['5 manches', '30 s'].map((s, i) => (
          <span
            key={s}
            className="htp-pop flex-1 h-9 rounded-xl bg-accent-info border-[3px] border-brand-border text-white font-display flex items-center justify-center shadow-[inset_0_-4px_0_#2F5BD0]"
            style={{ animationDelay: `${2100 + i * 250}ms` }}
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Step 3: podium columns rise, the players land on top, confetti falls. */
function Podium() {
  const places = [
    { p: PLAYERS[1], height: 70, score: '2 000', delay: 150 },
    { p: PLAYERS[0], height: 112, score: '2 500', delay: 0 },
    { p: PLAYERS[2], height: 48, score: '1 700', delay: 300 },
  ];
  return (
    <div className="relative w-full h-full flex items-end justify-center gap-3 pb-1">
      {Array.from({ length: 14 }, (_, i) => (
        <span
          key={i}
          className="htp-confetti absolute top-0 h-2.5 w-1.5 rounded-sm"
          style={{
            left: `${6 + ((i * 41) % 88)}%`,
            background: ['#FFC61A', '#FF4F8B', '#33D17A', '#5B8CFF'][i % 4],
            animationDelay: `${600 + (i % 7) * 180}ms`,
            animationDuration: `${1600 + (i % 5) * 220}ms`,
          }}
        />
      ))}
      {places.map(({ p, height, score, delay }, i) => (
        <div key={p.initial} className="flex flex-col items-center gap-1.5">
          <span className="htp-pop" style={{ animationDelay: `${delay + 650}ms` }}>
            <Avatar p={p} size={i === 1 ? 44 : 36} />
          </span>
          <div
            className="htp-rise w-16 rounded-t-xl border-[3px] border-b-0 border-brand-border flex items-start justify-center pt-1.5 font-display text-2xl text-white"
            style={{ height, animationDelay: `${delay}ms`, background: i === 1 ? '#FFC61A' : '#2B3170', color: i === 1 ? '#0E1030' : '#FFFFFF' }}
          >
            {i === 1 ? 1 : i === 0 ? 2 : 3}
          </div>
          <span className="htp-fade text-xs font-black text-tx-secondary tabular-nums" style={{ animationDelay: `${delay + 900}ms` }}>{score}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * The home page's "how to play": a small animated mock-up of each step that
 * plays through by itself, with tabs to jump to one.
 */
export default function HowToPlayDemo({ className }: { className?: string }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setStep((s) => (s + 1) % STEPS.length), STEP_MS);
    return () => clearTimeout(t);
  }, [step]);

  const current = STEPS[step];

  return (
    <div className={cn('flex flex-col', className)}>
      <style>{`
        @keyframes htpPop { 0% { opacity: 0; transform: translateY(12px) scale(.4); } 70% { opacity: 1; transform: translateY(0) scale(1.12); } 100% { opacity: 1; transform: none; } }
        @keyframes htpSlide { from { opacity: 0; transform: translateX(-28px) rotate(-12deg); } to { opacity: 1; transform: none; } }
        @keyframes htpFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes htpRise { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        @keyframes htpConfetti { 0% { opacity: 0; transform: translateY(-10px) rotate(0); } 15% { opacity: 1; } 100% { opacity: 0; transform: translateY(230px) rotate(540deg); } }
        @keyframes htpProgress { from { width: 0; } to { width: 100%; } }
        .htp-pop { opacity: 0; animation: htpPop 480ms cubic-bezier(.2,.9,.3,1.3) forwards; }
        .htp-slide { opacity: 0; animation: htpSlide 420ms cubic-bezier(.2,.9,.3,1.2) forwards; }
        /* Transforms need a box; flex tiles already have one and must keep centring. */
        .htp-pop:not(.flex), .htp-slide:not(.flex) { display: inline-block; }
        .htp-fade { opacity: 0; animation: htpFade 400ms ease-out forwards; }
        .htp-rise { transform-origin: bottom; transform: scaleY(0); animation: htpRise 650ms cubic-bezier(.2,.9,.3,1.15) forwards; }
        .htp-confetti { opacity: 0; animation: htpConfetti 1800ms ease-in infinite; }
        .htp-progress { animation: htpProgress linear forwards; }
        @media (prefers-reduced-motion: reduce) {
          .htp-pop, .htp-slide, .htp-fade, .htp-rise { animation: none; opacity: 1; transform: none; }
          .htp-confetti { display: none; }
          .htp-progress { animation: none; width: 100%; }
        }
      `}</style>

      <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Étapes">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <button
              key={s.title}
              type="button"
              role="tab"
              aria-selected={i === step}
              onClick={() => setStep(i)}
              className={cn(
                'h-12 rounded-xl border-[3px] border-brand-border flex items-center justify-center gap-1.5 font-display text-base transition-transform active:translate-y-[3px]',
                i === step
                  ? 'bg-accent-primary text-brand-bg shadow-[inset_0_-4px_0_#D98E00,0_4px_0_#05061A]'
                  : 'bg-[#2B3170] text-white shadow-[inset_0_-4px_0_#1A1F52,0_4px_0_#05061A]'
              )}
            >
              <Icon className="h-4 w-4" /> {i + 1}
            </button>
          );
        })}
      </div>

      {/* Fixed size: the card must not grow or shrink between steps. On a home page locked to one screen it takes the room left instead. */}
      <div className="mt-4 short:mt-3 relative h-[250px] shrink-0 fit:h-auto fit:flex-1 fit:min-h-[130px] rounded-2xl bg-brand-inner border-[3px] border-brand-border overflow-hidden flex items-center justify-center p-4 shadow-[inset_0_4px_0_#0B0E2A]">
        <div key={step} className="w-full h-full flex items-center justify-center">
          {step === 0 && <CreateRoom />}
          {step === 1 && <PickGame />}
          {step === 2 && <Podium />}
        </div>
      </div>

      <div className="mt-3 h-2.5 rounded-full bg-brand-bg border-2 border-brand-border overflow-hidden">
        <div key={step} className="htp-progress h-full bg-accent-success" style={{ animationDuration: `${STEP_MS}ms` }} />
      </div>

      <div className="mt-3 h-[88px] shrink-0 overflow-hidden">
        <div className="font-display text-2xl leading-tight truncate">
          <span className="text-accent-primary">{step + 1}.</span> {current.title}
        </div>
        <p className="text-sm font-bold text-tx-secondary">{current.text}</p>
      </div>
    </div>
  );
}
