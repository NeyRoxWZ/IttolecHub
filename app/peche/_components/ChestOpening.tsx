'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, FastForward, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BRAWL } from '@/lib/ui/brawl';
import { sfx } from '@/lib/casino/sfx';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { COSMETIC_BY_ID, COSMETIC_SLOTS, RARITIES, type CosmeticSlot } from '@/lib/peche/data';
import { fmtBig } from '@/lib/peche/format';
import CosmeticIcon from './CosmeticIcon';

export interface ChestResult { cosmeticId: string; rarity: number; duplicate: boolean; refund: number }

const LOCKS = 4;
const TIER = [RARITIES[0], RARITIES[1], RARITIES[2], RARITIES[3]];

type Phase = 'locked' | 'opening' | 'open';

/**
 * The sunken chest, one at a time, centre stage.
 *
 * Four padlocks hold the lid. Each tap cracks one off: the chest jolts, sparks
 * fly, the padlock spins away. If the chest still holds, the next padlock
 * lights up in the colour of the better tier it now promises. When it gives,
 * the lid bursts open, beams of the rarity's colour sweep out, and the piece
 * rises out of the chest onto its card — a legendary flashes the whole screen
 * and rains gold. Several chests queue up; "Tout ouvrir" skips to the recap.
 */
export default function ChestOpening({
  packsLeft, equipped, onOpen, onEquip, onClose,
}: {
  packsLeft: number;
  equipped: Partial<Record<CosmeticSlot, string>>;
  onOpen: (count: number) => Promise<{ chests: ChestResult[] } | null>;
  onEquip: (cosmeticId: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const [chests, setChests] = useState<ChestResult[]>([]);
  const [index, setIndex] = useState(0);
  const [removed, setRemoved] = useState(0);
  const [phase, setPhase] = useState<Phase>('locked');
  const [jolt, setJolt] = useState(0);
  const [recap, setRecap] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const current = chests[index];
  const cosmetic = current ? COSMETIC_BY_ID.get(current.cosmeticId) : undefined;
  const tier = (current && TIER[current.rarity]) || TIER[0];

  const start = async (count: number) => {
    if (busy) return;
    setBusy(true);
    const r = await onOpen(count);
    setBusy(false);
    if (!r) return;
    setChests(r.chests); setIndex(0); setRemoved(0); setJolt(0); setPhase('locked'); setRecap(false);
    sfx.crateOpen(); vibrate(HAPTIC.MEDIUM);
  };

  const tap = () => {
    if (!current || phase !== 'locked') return;
    const next = removed + 1;
    setRemoved(next);
    setJolt((j) => j + 1);
    if (next > current.rarity) {
      setPhase('opening');
      sfx.crateOpen(); vibrate(HAPTIC.HEAVY);
      timer.current = window.setTimeout(() => {
        setPhase('open');
        if (current.rarity >= 3) { sfx.jackpot(); vibrate(HAPTIC.SUCCESS); }
        else if (current.rarity >= 2) { sfx.bigWin(); vibrate(HAPTIC.SUCCESS); }
        else { sfx.reelStop(current.rarity === 1 ? 'rare' : 'commun'); }
      }, 1150);
    } else {
      // Held: the next padlock now promises the next tier.
      sfx.reveal(); vibrate(HAPTIC.MEDIUM);
    }
  };

  const nextChest = () => {
    if (index + 1 < chests.length) { setIndex(index + 1); setRemoved(0); setJolt(0); setPhase('locked'); sfx.click(); }
    else setRecap(true);
  };

  const skipAll = () => { sfx.cashout(); setRecap(true); };
  const counts = [1, 5, 10].filter((n) => n <= packsLeft);

  return (
    <div className={cn('fixed inset-0 z-[300] overflow-hidden', phase === 'opening' && 'co-screenshake')} style={{ background: 'radial-gradient(circle at 50% 60%, #0E4A7A, #041430 70%)' }}>
      <style>{`
        @keyframes coJolt { 0%,100% { transform: translate(0,0) rotate(0) } 20% { transform: translate(-8px,2px) rotate(-4deg) } 45% { transform: translate(7px,-3px) rotate(3deg) } 70% { transform: translate(-3px,1px) rotate(-1deg) } }
        @keyframes coScreen { 0%,100% { transform: translate(0,0) } 25% { transform: translate(-6px,4px) } 50% { transform: translate(5px,-5px) } 75% { transform: translate(-4px,-2px) } }
        @keyframes coLockOff { 0% { transform: translate(0,0) rotate(0) scale(1); opacity: 1 } 100% { transform: translate(var(--lx), -160px) rotate(var(--lr)) scale(.6); opacity: 0 } }
        @keyframes coSpark { from { transform: translate(0,0) scale(1); opacity: 1 } to { transform: translate(var(--sx), var(--sy)) scale(.2); opacity: 0 } }
        @keyframes coLid { 0% { transform: rotate(0) } 40% { transform: rotate(8deg) } 100% { transform: rotate(-112deg) } }
        @keyframes coBeams { from { transform: translate(-50%,-50%) rotate(0) scale(.2); opacity: 0 } 30% { opacity: 1 } to { transform: translate(-50%,-50%) rotate(180deg) scale(1); opacity: 1 } }
        @keyframes coSpin { from { transform: translate(-50%,-50%) rotate(0) } to { transform: translate(-50%,-50%) rotate(360deg) } }
        @keyframes coRise { 0% { transform: translateY(120px) scale(.2) rotateY(180deg); opacity: 0 } 60% { transform: translateY(-20px) scale(1.08) rotateY(0); opacity: 1 } 100% { transform: translateY(0) scale(1) rotateY(0); opacity: 1 } }
        @keyframes coFlash { 0% { opacity: 0 } 15% { opacity: .95 } 100% { opacity: 0 } }
        @keyframes coRain { from { transform: translateY(-40px) rotate(0) } to { transform: translateY(110vh) rotate(720deg) } }
        @keyframes coBanner { 0% { transform: scale(3) rotate(-8deg); opacity: 0 } 70% { transform: scale(.9) rotate(2deg); opacity: 1 } 100% { transform: scale(1) rotate(-2deg); opacity: 1 } }
        @keyframes coGlow { 0%,100% { filter: drop-shadow(0 0 0 transparent) } 50% { filter: drop-shadow(0 0 14px var(--g)) } }
        @keyframes coBubble { from { transform: translateY(0); opacity: .7 } to { transform: translateY(-110vh); opacity: 0 } }
        @keyframes coFloat { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
        .co-jolt { animation: coJolt .45s ease-out; }
        .co-screenshake { animation: coScreen .35s linear 3; }
        .co-lockoff { animation: coLockOff .7s cubic-bezier(.2,.6,.4,1) forwards; }
        .co-spark { animation: coSpark .6s ease-out forwards; }
        .co-lid { transform-box: fill-box; transform-origin: 0% 100%; animation: coLid .9s cubic-bezier(.3,1.4,.5,1) forwards; }
        .co-beams { animation: coBeams 1.2s ease-out forwards, coSpin 9s linear 1.2s infinite; }
        .co-rise { animation: coRise .8s cubic-bezier(.2,.9,.3,1.2) both; }
        .co-flash { animation: coFlash .9s ease-out forwards; }
        .co-rain { animation: coRain 2.6s linear infinite; }
        .co-banner { animation: coBanner .5s cubic-bezier(.2,.9,.3,1.3) .35s both; }
        .co-glow { animation: coGlow 1.1s ease-in-out infinite; }
        .co-bubble { animation: coBubble 6s linear infinite; }
        .co-float { animation: coFloat 2.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .co-jolt, .co-screenshake, .co-lockoff, .co-spark, .co-lid, .co-beams, .co-rise, .co-flash, .co-rain, .co-banner, .co-glow, .co-bubble, .co-float { animation: none !important; }
        }
      `}</style>

      {/* Ambient bubbles */}
      {Array.from({ length: 18 }, (_, i) => (
        <span key={i} aria-hidden className="co-bubble absolute rounded-full border-2 border-white/30"
          style={{ left: `${(i * 57) % 100}%`, bottom: -30, width: 6 + (i % 4) * 5, height: 6 + (i % 4) * 5, animationDelay: `${(i * 700) % 6000}ms` }} />
      ))}

      <button onClick={onClose} aria-label="Fermer" className={cn(BRAWL.dark, 'absolute top-4 right-4 h-12 w-12 z-50')}>
        <X className="h-5 w-5" />
      </button>

      {chests.length === 0 && (
        <div className="relative h-full flex flex-col items-center justify-center gap-5 p-4">
          <div className="font-display text-5xl text-stroke text-center">Coffres engloutis</div>
          <p className="max-w-md text-center font-bold text-[#C2E4FF]">
            Chaque clic fait sauter un cadenas. Plus le coffre résiste, meilleure est la pièce.
          </p>
          <div className="flex gap-2 flex-wrap justify-center">
            {TIER.map((t, i) => (
              <span key={t.id} className="px-2.5 py-1 rounded-xl border-[3px] border-brand-border font-display text-brand-bg" style={{ background: t.color }}>
                {i + 1} cadenas · {t.label}
              </span>
            ))}
          </div>
          <div className="co-float"><ChestArt removed={0} phase="locked" /></div>
          <div className="font-display text-2xl">{packsLeft} coffre{packsLeft > 1 ? 's' : ''}</div>
          <div className="flex flex-wrap justify-center gap-2">
            {counts.map((n) => (
              <button key={n} onClick={() => start(n)} disabled={busy} className={cn(BRAWL.yellow, 'h-14 px-6 text-xl')}>
                Ouvrir {n}
              </button>
            ))}
            {packsLeft > 10 && (
              <button onClick={() => start(Math.min(20, packsLeft))} disabled={busy} className={cn(BRAWL.green, 'h-14 px-6 text-xl')}>
                Ouvrir {Math.min(20, packsLeft)}
              </button>
            )}
          </div>
        </div>
      )}

      {chests.length > 0 && !recap && current && cosmetic && (
        <div className="relative h-full flex flex-col items-center justify-center p-4">
          <div className="absolute top-5 left-1/2 -translate-x-1/2 font-display text-2xl text-stroke-sm">
            Coffre {index + 1}/{chests.length}
          </div>

          {phase !== 'locked' && (
            <>
              <div className="co-beams pointer-events-none absolute left-1/2 top-1/2 w-[900px] h-[900px] rounded-full"
                style={{ background: `repeating-conic-gradient(${tier.color}AA 0 9deg, transparent 9deg 24deg)`, WebkitMaskImage: 'radial-gradient(circle, black 18%, transparent 62%)', maskImage: 'radial-gradient(circle, black 18%, transparent 62%)' }} />
              {current.rarity >= 3 && <div className="co-flash pointer-events-none absolute inset-0 bg-[#FFF6C8]" />}
            </>
          )}
          {phase === 'open' && current.rarity >= 2 && Array.from({ length: current.rarity >= 3 ? 40 : 18 }, (_, i) => (
            <span key={i} aria-hidden className="co-rain pointer-events-none absolute top-0 border-2 border-brand-border"
              style={{ left: `${(i * 37) % 100}%`, width: 12, height: 12, borderRadius: i % 2 ? 999 : 3, background: current.rarity >= 3 ? (i % 3 ? '#FFC61A' : '#FFFFFF') : tier.color, animationDelay: `${(i * 90) % 1800}ms` }} />
          ))}

          {phase !== 'open' ? (
            <button onClick={tap} disabled={phase !== 'locked'} className="relative focus:outline-none" aria-label="Retirer un cadenas">
              <div key={jolt} className={jolt ? 'co-jolt' : ''}>
                <ChestArt removed={removed} phase={phase} glow={TIER[Math.min(removed, 3)].color} />
              </div>
              {/* Sparks and the padlock flying off, replayed on each tap */}
              {jolt > 0 && removed > 0 && (
                <div key={`fx${jolt}`} className="pointer-events-none absolute left-1/2 top-[64%]">
                  {Array.from({ length: 14 }, (_, i) => {
                    const a = (i / 14) * Math.PI * 2;
                    return (
                      <span key={i} className="co-spark absolute h-3 w-3 rounded-full border-2 border-brand-border"
                        style={{ background: i % 2 ? '#FFC61A' : '#FFFFFF', ['--sx' as string]: `${Math.cos(a) * 110}px`, ['--sy' as string]: `${Math.sin(a) * 90 - 20}px` }} />
                    );
                  })}
                  <svg className="co-lockoff absolute -left-5 -top-6" width="40" height="44" viewBox="0 0 40 44"
                    style={{ ['--lx' as string]: `${jolt % 2 ? 120 : -120}px`, ['--lr' as string]: `${jolt % 2 ? 300 : -300}deg` }}>
                    <path d="M10 18 v-8 a10 10 0 0 1 20 0 v8" fill="none" stroke="#05061A" strokeWidth="6" />
                    <rect x="4" y="16" width="32" height="26" rx="7" fill={TIER[Math.max(0, Math.min(removed - 1, 3))].color} stroke="#05061A" strokeWidth="5" />
                  </svg>
                </div>
              )}
              {phase === 'locked' && (
                <div className="mt-4 font-display text-3xl text-stroke-sm animate-pulse">
                  {removed === 0 ? 'Clique pour forcer !' : `Ça tient ! ${TIER[Math.min(removed, 3)].label} en vue…`}
                </div>
              )}
            </button>
          ) : (
            <div className="relative flex flex-col items-center">
              <div className="co-banner mb-4 px-5 py-1.5 rounded-2xl border-4 border-brand-border font-display text-4xl text-brand-bg" style={{ background: tier.color, boxShadow: '0 6px 0 #05061A' }}>
                {tier.label} !
              </div>
              <div className="co-rise w-64 rounded-[22px] border-4 border-brand-border bg-brand-card p-5 flex flex-col items-center gap-2 text-center"
                style={{ boxShadow: `0 0 0 6px ${tier.color}, 0 12px 0 #05061A` }}>
                <div className="co-glow" style={{ ['--g' as string]: tier.color }}>
                  <CosmeticIcon cosmetic={cosmetic} size={140} />
                </div>
                <div className="font-display text-3xl leading-tight">{cosmetic.name}</div>
                <div className="text-sm font-bold text-tx-secondary">{COSMETIC_SLOTS[cosmetic.slot]}</div>
                {current.duplicate && <div className="font-black text-accent-primary">Doublon · +{fmtBig(current.refund)} ₶</div>}
              </div>
              <div className="mt-6 flex gap-2 flex-wrap justify-center">
                {!current.duplicate && <EquipBtn id={cosmetic.id} slot={cosmetic.slot} equipped={equipped} onEquip={onEquip} big />}
                <button onClick={nextChest} className={cn(BRAWL.yellow, 'h-14 px-6 text-xl')}>
                  {index + 1 < chests.length ? <>Coffre suivant <ChevronRight className="h-5 w-5" /></> : 'Voir le récap'}
                </button>
              </div>
            </div>
          )}

          {chests.length > 1 && phase === 'locked' && (
            <button onClick={skipAll} className={cn(BRAWL.dark, 'absolute bottom-6 left-1/2 -translate-x-1/2 h-12 px-5 text-lg')}>
              <FastForward className="h-5 w-5" /> Tout ouvrir d’un coup
            </button>
          )}
        </div>
      )}

      {recap && (
        <div className="relative h-full flex flex-col p-4 max-w-5xl mx-auto">
          <div className="text-center font-display text-4xl text-stroke mt-2 shrink-0">Ton butin</div>
          <div className="flex-1 min-h-0 overflow-y-auto my-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[...chests].sort((a, b) => b.rarity - a.rarity).map((c, i) => {
                const cos = COSMETIC_BY_ID.get(c.cosmeticId);
                if (!cos) return null;
                const t = TIER[c.rarity];
                return (
                  <div key={i} className="co-rise rounded-[22px] border-4 border-brand-border bg-brand-card p-3 flex flex-col items-center gap-1 text-center"
                    style={{ boxShadow: `0 0 0 4px ${t.color}, 0 6px 0 #05061A`, animationDelay: `${i * 70}ms` }}>
                    <span className="px-2 py-0.5 rounded-lg border-2 border-brand-border font-display text-sm text-brand-bg" style={{ background: t.color }}>{t.label}</span>
                    <CosmeticIcon cosmetic={cos} size={80} />
                    <div className="font-display text-base leading-tight">{cos.name}</div>
                    <div className="text-[11px] font-bold text-tx-secondary">{COSMETIC_SLOTS[cos.slot]}</div>
                    {c.duplicate
                      ? <div className="text-xs font-black text-accent-primary">+{fmtBig(c.refund)} ₶</div>
                      : <EquipBtn id={cos.id} slot={cos.slot} equipped={equipped} onEquip={onEquip} />}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="shrink-0 flex justify-center gap-2 pb-2">
            {packsLeft > 0 && <button onClick={() => { setChests([]); setRecap(false); }} className={cn(BRAWL.yellow, 'h-14 px-6 text-xl')}>Encore ({packsLeft})</button>}
            <button onClick={onClose} className={cn(BRAWL.dark, 'h-14 px-6 text-xl')}>Fermer</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Reflects what is really equipped: it turns into "Équipé" as soon as the server says so. */
function EquipBtn({ id, slot, equipped, onEquip, big }: {
  id: string; slot: CosmeticSlot; equipped: Partial<Record<CosmeticSlot, string>>; onEquip: (id: string) => Promise<unknown>; big?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const on = equipped[slot] === id;
  return (
    <button
      onClick={async () => { if (on || busy) return; setBusy(true); await onEquip(id); setBusy(false); }}
      disabled={on || busy}
      className={cn(on ? BRAWL.green : BRAWL.blue, big ? 'h-14 px-6 text-xl' : 'mt-1 h-9 px-3 text-sm', on && 'disabled:opacity-100')}
    >
      {on ? <><Check className={big ? 'h-5 w-5' : 'h-4 w-4'} strokeWidth={3} /> Équipé</> : busy ? '···' : 'Équiper'}
    </button>
  );
}

/** The chest: body, lid on a hinge, a metal band with the four padlocks. */
function ChestArt({ removed, phase, glow }: { removed: number; phase: Phase; glow?: string }) {
  const opening = phase !== 'locked';
  return (
    <svg width="300" height="250" viewBox="0 0 300 250" aria-hidden="true" className="max-w-[80vw] h-auto">
      <ellipse cx="150" cy="236" rx="130" ry="12" fill="#000000" opacity="0.35" />
      {/* inner glow when open */}
      {opening && <rect x="40" y="96" width="220" height="30" fill={glow || '#FFC61A'} opacity="0.9" />}
      {/* body */}
      <rect x="30" y="110" width="240" height="118" rx="16" fill="#8E4418" stroke="#05061A" strokeWidth="8" />
      {[70, 150, 230].map((x) => <rect key={x} x={x - 7} y="110" width="14" height="118" fill="#6A3010" />)}
      <rect x="30" y="110" width="240" height="118" rx="16" fill="none" stroke="#05061A" strokeWidth="8" />
      {/* lid on its hinge */}
      <g className={opening ? 'co-lid' : ''}>
        <path d="M30 118 Q 150 20 270 118 Z" fill="#C2632B" stroke="#05061A" strokeWidth="8" strokeLinejoin="round" />
        <path d="M60 104 Q 150 40 240 104" fill="none" stroke="#E08A4A" strokeWidth="8" strokeLinecap="round" />
      </g>
      {/* band and padlocks */}
      <rect x="30" y="140" width="240" height="18" fill="#5A6A7A" stroke="#05061A" strokeWidth="6" />
      {Array.from({ length: LOCKS }, (_, i) => {
        const x = 52 + i * 54;
        if (i < removed) {
          return <circle key={i} cx={x + 20} cy="160" r="5" fill="#05061A" />;
        }
        const next = i === removed && !opening;
        return (
          <g key={i} className={next ? 'co-glow' : ''} style={next ? { ['--g' as string]: TIER[i].color } : undefined}>
            <path d={`M${x + 8} 152 v-12 a12 12 0 0 1 24 0 v12`} fill="none" stroke="#05061A" strokeWidth="7" />
            <rect x={x} y="148" width="40" height="36" rx="9" fill={TIER[i].color} stroke="#05061A" strokeWidth="6" />
            <circle cx={x + 20} cy="164" r="5" fill="#05061A" />
            <rect x={x + 18} y="166" width="4" height="10" rx="2" fill="#05061A" />
          </g>
        );
      })}
    </svg>
  );
}
