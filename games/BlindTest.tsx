'use client';

import { useEffect, useRef, useState } from 'react';
import { Music, Volume2, VolumeX, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import OgName from '@/components/OgName';
import { cn } from '@/lib/utils';
import { BRAWL } from '@/lib/ui/brawl';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { isCloseEnough, normalize } from '@/lib/party/text';
import { addScores, listSetting, numSetting, useHostStep, usePartyGame, type Scores } from './party/usePartyGame';
import { AnswerInput, NextStep, PartyShell, PlayerChips, Podium, PromptCard, ScoreList, SetupScreen } from './party/ui';

const SWATCH = { fill: '#8B3DFF', shade: '#6526C9' };
const LEAD_IN = 3;
const RESULTS_TIME = 9;
const VOLUME_KEY = 'itollec_blindtest_volume';
// A silent sound played on a tap: phones then let the page play the songs.
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

type Song = { id: number; title: string; artist: string; cover: string; preview: string; catLabel?: string };
type Part = 'title' | 'artist';
type Find = { pid: string; part: Part; sec: number };

export default function BlindTest({ params }: { params: { code: string } }) {
  const party = usePartyGame(params.code, 'blindtest');
  const { round, phase, settings, playerId, active, roundNo, totalRounds, gid } = party;
  const listenTime = [15, 20, 30].includes(Number(settings.listenTime)) ? Number(settings.listenTime) : 30;
  const mode: 'both' | Part = settings.answerMode === 'title' || settings.answerMode === 'artist' ? settings.answerMode : 'both';
  const need: Part[] = mode === 'both' ? ['title', 'artist'] : [mode];

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
    try { const v = Number(localStorage.getItem(VOLUME_KEY)); if (v >= 0 && v <= 1 && localStorage.getItem(VOLUME_KEY) !== null) setVolume(v); } catch {}
    return () => { audio.current?.pause(); audio.current = null; };
  }, []);
  useEffect(() => {
    if (audio.current) audio.current.volume = muted ? 0 : volume;
    try { localStorage.setItem(VOLUME_KEY, String(volume)); } catch {}
  }, [volume, muted]);

  // New song: load it ahead of the countdown.
  useEffect(() => {
    const a = audio.current;
    if (!a || !song?.preview) return;
    a.pause();
    a.src = song.preview;
    a.load();
  }, [song?.id, song?.preview]);

  // Everyone starts the song at the same moment (late arrivals jump in at the right spot).
  useEffect(() => {
    const a = audio.current;
    if (!a || !song) return;
    if (phase === 'podium' || phase === 'setup') { a.pause(); return; }
    if ((phase === 'listen' || phase === 'results') && now >= startsAt && a.paused && !a.ended && a.src) {
      const offset = (now - startsAt) / 1000;
      if (offset < 29) {
        try { a.currentTime = Math.max(0, offset); } catch {}
        a.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
      }
    }
  });

  const unlock = () => {
    const a = audio.current;
    if (!a) return;
    const keep = a.src;
    if (!keep) {
      a.src = SILENT;
      a.play().catch(() => {});
    } else {
      a.play().then(() => setBlocked(false)).catch(() => {});
    }
  };

  /* ---------------- guesses ---------------- */
  const [draft, setDraft] = useState('');
  const [miss, setMiss] = useState(0);
  const [localFound, setLocalFound] = useState<{ key: string; parts: Part[] }>({ key: '', parts: [] });
  const roundKey = `${gid}:${roundNo}`;
  useEffect(() => setDraft(''), [roundKey]);

  const finds = party.movesIn('listen', 'found');
  const foundBy: Record<string, Partial<Record<Part, string>>> = {};
  for (const m of finds) {
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
      if (pieces.some((p) => isCloseEnough(p, answer) || (normalize(p).length >= 4 && normalize(answer).startsWith(normalize(p)) && normalize(p).length >= normalize(answer).length * 0.7))) hits.push(part);
    }
    setDraft('');
    if (!hits.length) { setMiss((n) => n + 1); vibrate(HAPTIC.SOFT); return; }
    setLocalFound({ key: roundKey, parts: Array.from(myParts).concat(hits) });
    for (const part of hits) party.act('found', { part });
    vibrate(HAPTIC.MEDIUM);
    toast.success(hits.length === 2 ? 'Titre et artiste trouvés !' : hits[0] === 'title' ? 'Titre trouvé !' : 'Artiste trouvé !');
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
        const pts = 60 + Math.round(40 * Math.max(0, 1 - sec / listenTime)) + (i === 0 ? 20 : 0);
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

  /* ---------------- render ---------------- */
  const soundBar = (
    <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border-[3px] border-brand-border bg-brand-inner px-3 py-2">
      <button onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Remettre le son' : 'Couper le son'} className="text-tx-base">
        {muted || volume === 0 ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
      </button>
      <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => { setVolume(Number(e.target.value)); setMuted(false); }} className="flex-1 accent-[#FFC61A]" aria-label="Volume" />
    </div>
  );

  return (
    <PartyShell party={party} title="BlindTest" maxTime={phase === 'listen' ? listenTime + LEAD_IN : RESULTS_TIME}>
      {phase === 'setup' && (
        <SetupScreen
          party={party}
          title="BlindTest"
          tagline="Un extrait, trouve le titre et l’artiste."
          icon={Music}
          swatch={SWATCH}
          minPlayers={1}
          onStart={start}
          rules={[
            'Un extrait de chanson se lance en même temps chez tout le monde.',
            mode === 'both' ? 'Tape le titre et l’artiste, dans l’ordre que tu veux.' : mode === 'title' ? 'Tape le titre de la chanson.' : 'Tape le nom de l’artiste.',
            'Pas besoin des accents ni des majuscules, une petite faute passe.',
            'Plus tu es rapide, plus tu marques. Bonus pour le premier qui trouve.',
          ]}
          note={
            <div className="flex w-full flex-col items-center gap-2">
              <button onClick={unlock} className={cn(BRAWL.blue, 'h-12 px-5 rounded-2xl text-lg')}>
                <Volume2 className="h-5 w-5" /> Activer le son
              </button>
              {soundBar}
            </div>
          }
        />
      )}

      {phase === 'listen' && song && (
        <>
          <PromptCard eyebrow={song.catLabel ?? `Extrait ${roundNo}/${totalRounds}`}>
            {countdown > 0 ? <span className="text-6xl tabular-nums">{countdown}</span> : <span className="inline-flex items-center gap-3"><Music className="h-8 w-8 animate-pulse" /> Écoute…</span>}
          </PromptCard>
          {blocked && (
            <button onClick={unlock} className={cn(BRAWL.pink, 'h-14 w-full max-w-md rounded-2xl text-xl animate-pulse')}>
              <Volume2 className="h-6 w-6" /> Touche pour lancer le son
            </button>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            {need.map((part) => (
              <span key={part} className={cn('inline-flex h-10 items-center gap-2 rounded-xl border-[3px] border-brand-border px-3 font-display text-lg', myParts.has(part) ? 'bg-accent-success text-brand-bg' : 'bg-brand-inner text-tx-secondary')}>
                {myParts.has(part) ? <Check className="h-5 w-5" /> : <X className="h-5 w-5 opacity-50" />}
                {part === 'title' ? 'Titre' : 'Artiste'}
              </span>
            ))}
          </div>
          {doneAll ? (
            <p className="font-display text-2xl text-accent-success">Bien joué !</p>
          ) : (
            <div key={miss} className={cn('w-full', miss > 0 && 'animate-in shake')}>
              <AnswerInput value={draft} onChange={setDraft} maxLength={80} placeholder={mode === 'artist' ? 'L’artiste…' : mode === 'title' ? 'Le titre…' : 'Titre ou artiste…'} submitLabel="Proposer" onSubmit={guess} />
            </div>
          )}
          <PlayerChips party={party} done={Object.entries(foundBy).filter(([, f]) => need.every((p) => f[p])).map(([pid]) => pid)} label="Ont tout trouvé" />
          {soundBar}
        </>
      )}

      {phase === 'results' && song && (
        <>
          <div className={cn(BRAWL.panel, 'w-full p-4 flex items-center gap-4')}>
            {song.cover && <img src={song.cover} alt={`Pochette de ${song.title}`} className="h-24 w-24 shrink-0 rounded-xl border-[3px] border-brand-border object-cover" />}
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-widest text-tx-secondary">C’était</p>
              <p className="font-display text-2xl md:text-3xl leading-tight [overflow-wrap:anywhere]">{song.title}</p>
              <p className="font-bold text-accent-primary">{song.artist}</p>
            </div>
          </div>
          {(round.finds as Find[] | undefined)?.length ? (
            <ul className="flex w-full flex-wrap justify-center gap-2">
              {(round.finds as Find[]).map((f, i) => (
                <li key={i} className="rounded-xl border-[3px] border-brand-border bg-brand-inner px-3 py-1.5 text-sm font-bold">
                  <OgName name={party.nameOf(f.pid)} /> · {f.part === 'title' ? 'titre' : 'artiste'} en {f.sec} s
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-bold text-tx-secondary">Personne n’a trouvé.</p>
          )}
          <ScoreList party={party} gains={round.gains} />
          <NextStep party={party} onNext={next} label={roundNo >= totalRounds ? 'Voir le podium' : 'Extrait suivant'} />
        </>
      )}

      {phase === 'podium' && <Podium party={party} onReplay={start} flavor="Les meilleures oreilles." />}
    </PartyShell>
  );
}
