'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Disc3, Music, Volume2, VolumeX, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { BRAWL } from '@/lib/ui/brawl';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { isCloseEnough, normalize } from '@/lib/party/text';
import { addScores, listSetting, numSetting, useHostStep, usePartyGame, type Scores } from './party/usePartyGame';
import { AnswerInput, Column, Columns, MediaFrame, PartyShell, PlayerChips, Podium, PromptCard, ResultsScreen, RevealBanner, Screen, SetupScreen, type RoundRow } from './party/ui';

const SWATCH = { fill: '#8B3DFF', shade: '#6526C9' };
const LEAD_IN = 3;
const RESULTS_TIME = 9;
const VOLUME_KEY = 'itollec_blindtest_volume';

type Song = { id: number; title: string; artist: string; cover: string; preview: string; catLabel?: string };
type Part = 'title' | 'artist';
type Find = { pid: string; part: Part; sec: number };

/** A short three-note chime: proof the sound works, and it unlocks audio on phones. */
function playChime(volume: number) {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = 'triangle';
      const t = ctx.currentTime + i * 0.14;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.25 * volume, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.32);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {}
}

export default function BlindTest({ params }: { params: { code: string } }) {
  const party = usePartyGame(params.code, 'blindtest');
  const { round, phase, settings, playerId, active, roundNo, totalRounds, gid } = party;
  const listenTime = [15, 20, 30].includes(Number(settings.listenTime)) ? Number(settings.listenTime) : 30;
  const mode: 'both' | Part = settings.answerMode === 'title' || settings.answerMode === 'artist' ? settings.answerMode : 'both';
  const need: Part[] = mode === 'both' ? ['title', 'artist'] : [mode];
  const simple = settings.scoring !== 'speed';

  const song: Song | undefined = round.song;
  const startsAt: number = round.starts_at || 0;
  const now = party.serverTime();
  const countdown = Math.max(0, Math.ceil((startsAt - now) / 1000));

  /* ---------------- audio ---------------- */
  const audio = useRef<HTMLAudioElement | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    audio.current = new Audio();
    audio.current.preload = 'auto';
    try { const v = localStorage.getItem(VOLUME_KEY); if (v !== null && Number(v) >= 0 && Number(v) <= 1) setVolume(Number(v)); } catch {}
    return () => { audio.current?.pause(); if (audio.current) audio.current.src = ''; audio.current = null; };
  }, []);
  useEffect(() => {
    if (audio.current) audio.current.volume = muted ? 0 : volume;
    try { localStorage.setItem(VOLUME_KEY, String(volume)); } catch {}
  }, [volume, muted]);

  useEffect(() => {
    const a = audio.current;
    if (!a || !song?.preview) return;
    a.pause();
    a.src = song.preview;
    a.load();
  }, [song?.id, song?.preview]);

  // Everyone starts the song at the same moment; late arrivals jump in at the right spot.
  useEffect(() => {
    const a = audio.current;
    if (!a || !song) return;
    if (phase !== 'listen' && phase !== 'results') { a.pause(); return; }
    if (now >= startsAt && a.paused && !a.ended && a.src) {
      const offset = (now - startsAt) / 1000;
      if (offset < 29) {
        try { a.currentTime = Math.max(0, offset); } catch {}
        a.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
      }
    }
  });

  // A tap unlocks the sound, joining the song where everyone else is.
  const resume = () => {
    const a = audio.current;
    if (!a) return;
    const offset = (party.serverTime() - startsAt) / 1000;
    if (offset > 0 && offset < 29) { try { a.currentTime = offset; } catch {} }
    a.play().then(() => setBlocked(false)).catch(() => toast.error('Le navigateur bloque le son. Vérifie qu’il n’est pas coupé.'));
  };

  const soundControl = (
    <div className="flex shrink-0 items-center gap-2 rounded-xl border-[3px] border-brand-border bg-brand-inner px-2 py-1.5">
      <button onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Remettre le son' : 'Couper le son'}>
        {muted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5 text-accent-success" />}
      </button>
      <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => { setVolume(Number(e.target.value)); setMuted(false); }} className="min-w-0 flex-1 accent-[#33D17A]" aria-label="Volume" />
      <button onClick={() => playChime(muted ? 0 : volume)} className="shrink-0 text-xs font-black uppercase tracking-widest text-tx-secondary hover:text-white">Tester</button>
    </div>
  );

  /* ---------------- guesses ---------------- */
  const [draft, setDraft] = useState('');
  const [miss, setMiss] = useState(0);
  const [localFound, setLocalFound] = useState<{ key: string; parts: Part[] }>({ key: '', parts: [] });
  const roundKey = `${gid}:${roundNo}`;
  useEffect(() => { setDraft(''); setMiss(0); }, [roundKey]);

  const foundBy: Record<string, Partial<Record<Part, string>>> = {};
  for (const m of party.movesIn('listen', 'found')) {
    const part = m.payload?.part as Part;
    if (!need.includes(part)) continue;
    (foundBy[m.player_id] ||= {})[part] ||= m.created_at;
  }
  const myParts = new Set<Part>([...(localFound.key === roundKey ? localFound.parts : []), ...(Object.keys(foundBy[playerId || ''] || {}) as Part[])]);
  const doneAll = need.every((p) => myParts.has(p));

  const guess = () => {
    if (!song) return;
    const text = draft.trim();
    const pieces = [text, ...text.split(/\s[-–]\s|\s+par\s+|\s*\/\s*/i)].filter(Boolean);
    const hits: Part[] = [];
    for (const part of need) {
      if (myParts.has(part)) continue;
      const answer = part === 'title' ? song.title : song.artist;
      const a = normalize(answer);
      if (pieces.some((p) => isCloseEnough(p, answer) || (normalize(p).length >= 4 && a.startsWith(normalize(p)) && normalize(p).length >= a.length * 0.7))) hits.push(part);
    }
    setDraft('');
    if (!hits.length) { setMiss((n) => n + 1); vibrate(HAPTIC.SOFT); return; }
    setLocalFound({ key: roundKey, parts: Array.from(myParts).concat(hits) });
    for (const part of hits) party.act('found', { part });
    vibrate(HAPTIC.MEDIUM);
  };

  /* ---------------- host ---------------- */
  const fetchSong = async (s: Song): Promise<Song> => {
    const data = await fetch(`/api/games/blindtest?track=${s.id}`).then((r) => r.json()).catch(() => null);
    return data?.song?.preview ? { ...s, preview: data.song.preview } : s;
  };
  const roundFor = (s: Song) => {
    const starts = party.serverTime() + LEAD_IN * 1000;
    return { phase: 'listen', song: s, starts_at: starts, ends_at: starts + listenTime * 1000 };
  };

  const start = async () => {
    playChime(volume);
    const count = numSetting(settings, 'rounds', 10, 1, 30);
    const cats = listSetting(settings, 'categories').join(',');
    const data = await fetch(`/api/games/blindtest?count=${count}&categories=${cats}`).then((r) => r.json()).catch(() => null);
    const songs: Song[] = data?.songs || [];
    if (!songs.length) { toast.error('Impossible de charger les musiques. Réessaie.'); return; }
    await party.startGame(songs.map(({ preview: _p, ...s }) => s), roundFor(songs[0]), songs.length);
  };

  const allFound = active.length > 0 && active.every((p) => need.every((part) => foundBy[p.id]?.[part]));
  useHostStep(party, `${roundKey}:listen-end`, phase === 'listen' && (party.expired || allFound), async () => {
    const gains: Scores = {};
    const list: Find[] = [];
    for (const part of need) {
      const ordered = Object.entries(foundBy).filter(([, f]) => f[part]).sort((a, b) => a[1][part]!.localeCompare(b[1][part]!));
      ordered.forEach(([pid, f], i) => {
        const sec = Math.max(0, (Date.parse(f[part]!) - startsAt) / 1000);
        const pts = simple ? 1 : 60 + Math.round(40 * Math.max(0, 1 - sec / listenTime)) + (i === 0 ? 20 : 0);
        gains[pid] = (gains[pid] || 0) + pts;
        list.push({ pid, part, sec: Math.round(sec * 10) / 10 });
      });
    }
    await party.setRound({ phase: 'results', song, starts_at: startsAt, finds: list, gains, scores: addScores(party.scores, gains), ends_at: party.deadline(RESULTS_TIME) });
  });

  const next = useHostStep(party, `${roundKey}:next`, phase === 'results' && party.expired, async () => {
    const deck: Song[] = party.deck || [];
    if (roundNo >= totalRounds || !deck[roundNo]) return party.endGame();
    await party.goToRound(roundNo + 1, roundFor(await fetchSong(deck[roundNo])));
  });

  const finds: Find[] = round.finds || [];
  const partLabel = (p: Part) => (p === 'title' ? 'Titre' : 'Artiste');

  return (
    <PartyShell party={party} title="BlindTest" maxTime={phase === 'listen' ? listenTime + LEAD_IN : RESULTS_TIME}>
      {phase === 'setup' && (
        <SetupScreen
          party={party} title="BlindTest" tagline="Un extrait, trouve le titre et l’artiste." icon={Music} swatch={SWATCH} minPlayers={1} onStart={start}
          rules={[
            'Un extrait de chanson se lance en même temps chez tout le monde.',
            mode === 'both' ? 'Tape le titre et l’artiste, dans l’ordre que tu veux, en une ou deux fois.' : mode === 'title' ? 'Tape le titre de la chanson.' : 'Tape le nom de l’artiste.',
            'Pas besoin des accents ni des majuscules, une petite faute passe.',
            simple ? '1 point par bonne réponse : titre et artiste trouvés = 2 points.' : 'Plus tu es rapide, plus tu marques. Bonus pour le premier.',
          ]}
          note={<div className="shrink-0 space-y-1"><p className="text-center text-xs font-bold text-tx-secondary">Monte le son de ton appareil et appuie sur Tester : tu dois entendre trois notes.</p>{soundControl}</div>}
        />
      )}

      {phase === 'listen' && song && (
        <Screen>
          <Columns className="grid-rows-[minmax(0,1fr)_auto] lg:grid-rows-1">
            <Column className="items-center justify-center">
              <MediaFrame className="flex aspect-square h-full max-h-full max-w-full flex-col items-center justify-center gap-2 bg-[radial-gradient(circle,#2B3170_0%,#151942_70%)] p-4">
                {countdown > 0 ? (
                  <span className="font-display text-7xl tabular-nums">{countdown}</span>
                ) : (
                  <Disc3 className={cn('h-2/3 w-2/3 text-accent-success', !blocked && 'animate-spin [animation-duration:3s]')} />
                )}
                <span className="text-center text-xs font-black uppercase tracking-widest text-tx-secondary">{song.catLabel ?? `Extrait ${roundNo}/${totalRounds}`}</span>
              </MediaFrame>
            </Column>
            <Column className="lg:justify-center">
              {blocked && (
                <button onClick={resume} className={cn(BRAWL.pink, 'h-12 w-full shrink-0 animate-pulse rounded-2xl text-lg')}>
                  <Volume2 className="h-6 w-6" /> Touche pour lancer le son
                </button>
              )}
              <div className="flex shrink-0 justify-center gap-2">
                {need.map((part) => (
                  <span key={part} className={cn('inline-flex h-9 items-center gap-1.5 rounded-xl border-[3px] border-brand-border px-3 font-display', myParts.has(part) ? 'bg-accent-success text-brand-bg' : 'bg-brand-inner text-tx-secondary')}>
                    {myParts.has(part) ? <Check className="h-5 w-5" /> : <X className="h-5 w-5 opacity-50" />}{partLabel(part)}
                  </span>
                ))}
              </div>
              {doneAll ? (
                <RevealBanner tone="good" eyebrow="Bien joué">Tout trouvé !</RevealBanner>
              ) : (
                <>
                  <AnswerInput value={draft} onChange={setDraft} maxLength={80} placeholder={mode === 'artist' ? 'L’artiste…' : mode === 'title' ? 'Le titre…' : 'Titre ou artiste…'} submitLabel="Proposer" onSubmit={guess} />
                  <p key={miss} className={cn('shrink-0 text-center text-sm font-bold', miss ? 'text-accent-secondary animate-in fade-in' : 'text-tx-secondary')}>{miss ? 'Raté, essaie encore' : 'Propose autant de fois que tu veux'}</p>
                </>
              )}
              {soundControl}
              <PlayerChips party={party} done={Object.entries(foundBy).filter(([, f]) => need.every((p) => f[p])).map(([pid]) => pid)} label="Tout trouvé" />
            </Column>
          </Columns>
        </Screen>
      )}

      {phase === 'results' && song && (
        <ResultsScreen
          party={party}
          reveal={<RevealBanner tone={finds.length ? 'good' : 'bad'} eyebrow="C’était" detail={song.artist}>{song.title}</RevealBanner>}
          media={song.cover ? <MediaFrame className="aspect-square h-full max-h-full max-w-full"><img src={song.cover} alt={`Pochette de ${song.title}`} className="h-full w-full object-cover" /></MediaFrame> : undefined}
          rows={Object.fromEntries(party.seated.map((p) => {
            const mine = finds.filter((f) => f.pid === p.id);
            return [p.id, { ok: mine.length === need.length, answer: mine.length ? mine.map((f) => `${partLabel(f.part).toLowerCase()} en ${f.sec} s`).join(' · ') : 'rien trouvé' } as RoundRow];
          }))}
          onNext={next}
          nextLabel={roundNo >= totalRounds ? 'Voir le podium' : 'Extrait suivant'}
        />
      )}

      {phase === 'podium' && <Podium party={party} onReplay={start} flavor="Les meilleures oreilles." />}
    </PartyShell>
  );
}
