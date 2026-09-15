'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { LogOut, Menu, X, RotateCcw, Sparkles, ArrowRight, Users, User } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase/client';
import { vibrate, HAPTIC } from '@/lib/haptic';
import GameCover, { type CoverGame } from '@/components/GameCover';
import HowToPlayDemo from '@/components/HowToPlayDemo';
import DonateStrip from '@/components/DonateStrip';
import { isOwner } from '@/lib/owner';
import releases from '@/patch-notes/releases.json';


import OgName from '@/components/OgName';
const SOLO_GAMES: {
  id: CoverGame; name: string; tag: string; tagClass: string; description: string; href: string;
  /** Shown to everyone under a "en construction" tape, playable by the owner only. */
  building?: boolean;
}[] = [
  {
    id: 'casino', name: 'Casino', tag: '20 jeux', tagClass: 'bg-accent-primary text-brand-bg',
    description: 'Mise tes FrenlyCoins sur 20 mini-jeux, avec pass, coffre, missions et cagnotte. Monnaie fictive.',
    href: '/casino',
  },
  {
    id: 'peche', name: 'Pêche', tag: 'Bêta', tagClass: 'bg-accent-info text-white',
    description: 'Pêche des centaines d’espèces, améliore ton matériel et enchaîne les Marées pour aller toujours plus loin.',
    href: '/peche',
  },
];

const latestRelease = (releases as { releases: { version: string; title?: string; entries?: { title: string }[] }[] }).releases[0];

/** The shared chunky button: bright fill, black outline, pressed-in bottom edge. */
const BTN = 'inline-flex items-center justify-center gap-2 rounded-xl border-[3px] border-brand-border font-display tracking-wide transition-transform active:translate-y-[3px] disabled:opacity-50 disabled:cursor-not-allowed';
const BTN_YELLOW = `${BTN} bg-accent-primary text-brand-bg shadow-[inset_0_-5px_0_#D98E00,0_4px_0_#05061A]`;
const BTN_DARK = `${BTN} bg-[#2B3170] text-white shadow-[inset_0_-5px_0_#1A1F52,0_4px_0_#05061A]`;
const BTN_PINK = `${BTN} bg-accent-secondary text-white shadow-[inset_0_-5px_0_#C92D63,0_4px_0_#05061A]`;

// Reading the URL (?mode=) needs a Suspense boundary for the page to prerender.
export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <Home />
    </Suspense>
  );
}

function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'multiplayer' | 'solo'>('multiplayer');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [logoVisible, setLogoVisible] = useState(true);
  const [easterEggActive, setEasterEggActive] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [resumeRoom, setResumeRoom] = useState<{ code: string; name: string } | null>(null);
  const { user, logout } = useAuth();

  // Offer to resume the last room this browser was in, if it's still alive.
  useEffect(() => {
    let cancelled = false;
    try {
      const raw = localStorage.getItem('itollec_last_room');
      if (!raw) return;
      const saved = JSON.parse(raw) as { code: string; name: string };
      if (!saved?.code || !saved?.name) return;

      supabase
        .from('rooms')
        .select('code,status')
        .eq('code', saved.code)
        .maybeSingle()
        .then(({ data }) => {
          if (cancelled) return;
          if (data && data.status !== 'closed' && data.status !== 'finished') {
            setResumeRoom(saved);
          } else {
            localStorage.removeItem('itollec_last_room');
          }
        });
    } catch {}
    return () => { cancelled = true; };
  }, []);

  const resumeLastGame = () => {
    if (!resumeRoom) return;
    sessionStorage.setItem('playerName', resumeRoom.name);
    // No ?return=true here on purpose: if the room is mid-game, the room
    // page's own logic should redirect straight into the running game.
    router.push(`/room/${resumeRoom.code}`);
  };

  useEffect(() => {
    const urlMode = searchParams.get('mode');
    if (urlMode === 'solo' || urlMode === 'multiplayer') {
      setMode(urlMode);
      sessionStorage.setItem('itollec_home_mode', urlMode);
      return;
    }
    const savedMode = sessionStorage.getItem('itollec_home_mode');
    if (savedMode === 'solo' || savedMode === 'multiplayer') setMode(savedMode);
  }, [searchParams]);

  useEffect(() => {
    if (user) {
      setName(user.pseudo);
    } else {
      const savedName = sessionStorage.getItem('playerName');
      if (savedName) setName(savedName);
    }
  }, [user]);

  // Easter egg: type "arsac" anywhere outside a field.
  useEffect(() => {
    let buffer = '';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      buffer = (buffer + e.key).slice(-5).toLowerCase();
      if (buffer === 'arsac') setEasterEggActive(true);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleAction = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name.trim()) {
      toast.error('Choisis un pseudo !');
      return;
    }
    sessionStorage.setItem('playerName', name);
    vibrate(HAPTIC.MEDIUM);

    if (activeTab === 'create') {
      const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      router.push(`/room/${newCode}?host=true`);
    } else {
      if (!code.trim()) {
        toast.error('Entre un code de salle !');
        return;
      }
      router.push(`/room/${code.toUpperCase()}`);
    }
  };

  const canSubmit = name.trim().length > 0 && (activeTab === 'create' || code.trim().length > 0);

  const handleSetMode = (nextMode: 'multiplayer' | 'solo') => {
    vibrate(HAPTIC.SOFT);
    setMode(nextMode);
    sessionStorage.setItem('itollec_home_mode', nextMode);
    router.replace(`/?mode=${nextMode}`);
  };

  const rememberNext = () => {
    try { sessionStorage.setItem('itollec_next_path', `/?mode=${mode}`); } catch {}
  };
  const goConnexion = () => { rememberNext(); router.push(`/connexion?next=${encodeURIComponent(`/?mode=${mode}`)}`); };
  const goCreerCompte = () => { rememberNext(); router.push('/creer-compte'); };

  const modeSwitch = (
    // Concentric corners: 22px outside, minus the 3px border and 6px padding,
    // leaves 13px for the pill inside.
    <nav className="flex gap-1 p-1.5 rounded-[22px] bg-brand-bg border-[3px] border-brand-border" aria-label="Mode de jeu">
      {(['multiplayer', 'solo'] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => handleSetMode(m)}
          aria-pressed={mode === m}
          className={cn(
            'h-10 px-4 sm:px-5 rounded-[13px] font-display text-lg transition-colors flex items-center gap-2',
            mode === m
              ? 'bg-accent-primary text-brand-bg shadow-[inset_0_-4px_0_#D98E00]'
              : 'text-tx-secondary hover:text-white'
          )}
        >
          {m === 'multiplayer' ? <Users className="h-5 w-5" strokeWidth={2.5} /> : <User className="h-5 w-5" strokeWidth={2.5} />}
          {m === 'multiplayer' ? 'Multijoueur' : 'Solo'}
        </button>
      ))}
    </nav>
  );

  return (
    // Locked to one screen only when the window is big enough to hold it all;
    // a narrow or short window (split screen) scrolls normally.
    <main className="bg-transparent min-h-screen flex flex-col relative fit:h-[100dvh] fit:min-h-0 fit:overflow-hidden">
      {easterEggActive && (
        <div className="fixed inset-0 z-[9999] pointer-events-none">
          <div
            className="absolute bottom-4 left-4 animate-in slide-in-from-bottom-full duration-500 fade-in pointer-events-auto cursor-pointer"
            onClick={() => setEasterEggActive(false)}
          >
            <Image src="/easteregg.png" alt="Easter Egg" width={192} height={192} className="w-48 h-auto drop-shadow-2xl" draggable={false} priority />
          </div>
        </div>
      )}

      {/* TOP BAR */}
      <header className="px-4 sm:px-6 pt-4">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className={cn(BTN_DARK, 'md:hidden h-12 w-12 shrink-0')}
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {logoVisible && (
            <Image
              src="/logo-site.png"
              alt="ItollecHub"
              width={1219}
              height={635}
              className="h-12 md:h-16 w-auto object-contain select-none"
              priority
              onError={() => setLogoVisible(false)}
            />
          )}

          <div className="hidden md:flex flex-1 justify-center">{modeSwitch}</div>

          <div className="hidden md:flex items-center gap-2 ml-auto">
            {user ? (
              <>
                <button
                  type="button"
                  onClick={() => router.push('/profil')}
                  className="h-12 flex items-center gap-2 pl-1.5 pr-4 rounded-2xl bg-brand-card border-[3px] border-brand-border shadow-brutal font-black hover:bg-[#252B66] transition-colors"
                >
                  <span className="h-8 w-8 rounded-xl bg-accent-secondary text-white font-display text-lg flex items-center justify-center shadow-[inset_0_-3px_0_#C92D63]">
                    {user.pseudo[0]?.toUpperCase()}
                  </span>
                  <OgName name={user.pseudo} />
                </button>
                <button type="button" onClick={logout} className={cn(BTN_PINK, 'h-12 w-12')} title="Se déconnecter" aria-label="Se déconnecter">
                  <LogOut className="h-5 w-5" />
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={goConnexion} className={cn(BTN_DARK, 'h-12 px-4 text-lg')}>Connexion</button>
                <button type="button" onClick={goCreerCompte} className={cn(BTN_YELLOW, 'h-12 px-4 text-lg')}>Créer un compte</button>
              </>
            )}
          </div>
        </div>

        <div className="md:hidden mt-4 flex justify-center">{modeSwitch}</div>
      </header>

      {/* MOBILE MENU */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[9999] md:hidden">
          <button type="button" onClick={() => setMobileMenuOpen(false)} className="absolute inset-0 bg-black/70" aria-label="Fermer" />
          <div className="absolute top-3 left-3 right-3 bg-brand-card border-4 border-brand-border rounded-[22px] p-5 shadow-brutal max-h-[calc(100vh-24px)] overflow-y-auto space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="font-display text-3xl text-stroke">Menu</div>
              <button type="button" onClick={() => setMobileMenuOpen(false)} className={cn(BTN_DARK, 'h-11 w-11')} aria-label="Fermer">
                <X className="h-5 w-5" />
              </button>
            </div>
            {user ? (
              <>
                <button type="button" onClick={() => { setMobileMenuOpen(false); router.push('/profil'); }} className={cn(BTN_DARK, 'w-full h-12 text-lg')}>
                  Profil · {user.pseudo}
                </button>
                <button type="button" onClick={() => { setMobileMenuOpen(false); logout(); }} className={cn(BTN_PINK, 'w-full h-12 text-lg')}>
                  <LogOut className="h-5 w-5" /> Déconnexion
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => { setMobileMenuOpen(false); goConnexion(); }} className={cn(BTN_DARK, 'w-full h-12 text-lg')}>Connexion</button>
                <button type="button" onClick={() => { setMobileMenuOpen(false); goCreerCompte(); }} className={cn(BTN_YELLOW, 'w-full h-12 text-lg')}>Créer un compte</button>
              </>
            )}
            <Link href="/patch-notes" className={cn(BTN_DARK, 'w-full h-12 text-lg')}>Patch notes</Link>
          </div>
        </div>
      )}

      <section className="flex-1 px-4 sm:px-6 py-6 md:py-8 short:py-3 fit:min-h-0 fit:flex fit:flex-col">
        <div className="max-w-6xl mx-auto fit:w-full fit:flex-1 fit:min-h-0 fit:flex fit:flex-col">
          {resumeRoom && mode === 'multiplayer' && (
            <button
              type="button"
              onClick={resumeLastGame}
              className={cn(BTN_YELLOW, 'mb-6 w-full h-14 text-xl animate-in fade-in slide-in-from-top-2')}
            >
              <RotateCcw className="h-5 w-5" />
              Reprendre la partie {resumeRoom.code}
            </button>
          )}

          {mode === 'solo' ? (
            <>
              <div className="mb-6 short:mb-3">
                <h1 className="font-display text-5xl md:text-6xl short:text-5xl leading-none">Jeux solo</h1>
                <p className="mt-2 short:mt-1 font-black text-tx-secondary">Joue à ton rythme. Ta progression est sauvegardée sur ton compte.</p>
              </div>

              {/* Stretch, so the side column ends exactly where the game cards end. */}
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] items-stretch fit:flex-1 fit:min-h-0">
                <div className="grid gap-5 sm:grid-cols-2 fit:min-h-0">
                  {SOLO_GAMES.map((g) => {
                    const locked = !!g.building && !isOwner(user?.id);
                    return (
                    <article
                      key={g.id}
                      className="relative flex flex-col bg-brand-card border-4 border-brand-border rounded-[22px] overflow-hidden shadow-[0_8px_0_#05061A] fit:min-h-0"
                    >
                      <span className={cn('absolute top-3 left-[-4px] z-10 px-3 py-1 font-display text-base border-[3px] border-brand-border rounded-r-xl', g.tagClass)}>
                        {g.tag}
                      </span>
                      {/* On a locked screen the cover gives up height first, so the card fits. */}
                      <div className="relative overflow-hidden border-b-4 border-brand-border fit:flex-1 fit:min-h-0">
                        <GameCover game={g.id} className={cn('block w-full aspect-[16/9] fit:aspect-auto fit:h-full', locked && 'grayscale-[40%]')} />
                        {g.building && (
                          // Two crossing strips of warning tape across the cover.
                          <div aria-hidden className="absolute inset-0 pointer-events-none">
                            {[-18, 18].map((deg) => (
                              <div
                                key={deg}
                                className="absolute left-1/2 top-1/2 w-[150%] h-10 -translate-x-1/2 -translate-y-1/2 border-y-[3px] border-brand-border flex items-center justify-center shadow-[0_4px_0_rgba(5,6,26,0.5)]"
                                style={{
                                  transform: `translate(-50%, -50%) rotate(${deg}deg)`,
                                  background: 'repeating-linear-gradient(135deg, #FFC61A 0 22px, #05061A 22px 44px)',
                                }}
                              />
                            ))}
                            {/* The label sits above both strips, where they cross. */}
                            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 px-3 py-1 rounded-xl bg-[#FFC61A] border-[3px] border-brand-border font-display text-xl sm:text-2xl text-brand-bg whitespace-nowrap shadow-[inset_0_-4px_0_#D98E00,0_4px_0_#05061A]">
                              En construction
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 flex flex-col gap-3 p-4">
                        <h2 className="font-display text-3xl leading-none text-stroke">{g.name}</h2>
                        <p className="text-sm font-bold text-tx-secondary leading-relaxed">{g.description}</p>
                        <button
                          type="button"
                          disabled={locked}
                          onClick={() => window.location.assign(g.href)}
                          className={cn(locked ? BTN_DARK : BTN_YELLOW, 'mt-auto w-full h-14 text-2xl')}
                        >
                          {locked ? 'En construction' : 'Jouer'}
                        </button>
                      </div>
                    </article>
                    );
                  })}
                </div>

                <aside className="flex flex-col fit:min-h-0">
                  {/* Takes the whole column: the latest version, summed up. */}
                  <div className="flex-1 flex flex-col bg-brand-card border-4 border-brand-border rounded-[22px] p-5 shadow-[0_8px_0_#05061A] fit:min-h-0 fit:overflow-hidden">
                    <div className="flex items-center gap-2">
                      <span className="h-10 w-10 rounded-xl border-[3px] border-brand-border bg-accent-primary flex items-center justify-center shadow-[inset_0_-3px_0_#D98E00]">
                        <Sparkles className="h-5 w-5 text-brand-bg" />
                      </span>
                      <div className="font-display text-3xl leading-none">Nouveautés</div>
                    </div>
                    {latestRelease ? (
                      <>
                        <div className="mt-3 w-fit px-2.5 py-0.5 rounded-lg border-2 border-brand-border bg-accent-info text-white font-display text-base">
                          Version {latestRelease.version}
                        </div>
                        {latestRelease.title && <p className="mt-2 font-display text-xl leading-tight">{latestRelease.title}</p>}
                        {/* On a locked screen the list gives up height, never the button under it. */}
                        <ul className="mt-3 space-y-1.5 fit:min-h-0 fit:overflow-hidden">
                          {(latestRelease.entries || []).slice(0, 5).map((e, i) => (
                            <li key={i} className="flex gap-2 items-start text-sm font-bold text-tx-secondary leading-snug">
                              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-brand-border bg-accent-primary" />
                              <span>{e.title}</span>
                            </li>
                          ))}
                        </ul>
                        {(latestRelease.entries?.length || 0) > 5 && (
                          <p className="mt-2 text-xs font-black text-tx-secondary">et {latestRelease.entries!.length - 5} autres changements</p>
                        )}
                      </>
                    ) : (
                      <p className="mt-2 text-sm font-bold text-tx-secondary">Toutes les mises à jour du site.</p>
                    )}
                    <div className="mt-auto pt-4 shrink-0">
                      <Link href="/patch-notes" className={cn(BTN_YELLOW, 'w-full h-12 text-lg')}>
                        Voir les patch notes <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                  {/* Inside the column, not under the page: asking for support never adds a scroll. */}
                  <DonateStrip className="mt-4" pseudo={user?.pseudo} text="Aide le Casino et la Pêche à grandir." />
                </aside>
              </div>
            </>
          ) : (
            <>
              <div className="mb-6 short:mb-3">
                <h1 className="font-display text-5xl md:text-6xl short:text-5xl leading-none">Multijoueur</h1>
                <p className="mt-2 short:mt-1 font-black text-tx-secondary">Crée une salle, envoie le code, jouez tous ensemble.</p>
              </div>

              {/* Two cards side by side, same height, tops and bottoms aligned. */}
              <div className="grid gap-6 lg:grid-cols-2 items-stretch fit:flex-1 fit:min-h-0">
                <div className="flex flex-col bg-brand-card border-4 border-brand-border rounded-[22px] p-5 md:p-6 shadow-[0_8px_0_#05061A]">
                  <div className="font-display text-2xl mb-4">{activeTab === 'create' ? 'Créer une salle' : 'Rejoindre une salle'}</div>
                  <div className="flex gap-1 p-1.5 rounded-[22px] bg-brand-bg border-[3px] border-brand-border">
                    {(['create', 'join'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => { vibrate(HAPTIC.SOFT); setActiveTab(t); }}
                        aria-pressed={activeTab === t}
                        className={cn(
                          'flex-1 h-11 rounded-[13px] font-display text-lg transition-colors',
                          activeTab === t ? 'bg-accent-primary text-brand-bg shadow-[inset_0_-4px_0_#D98E00]' : 'text-tx-secondary hover:text-white'
                        )}
                      >
                        {t === 'create' ? 'Créer une salle' : 'Rejoindre'}
                      </button>
                    ))}
                  </div>

                  <form onSubmit={handleAction} className="mt-5 flex-1 flex flex-col gap-4">
                    <label className="block space-y-2">
                      <span className="text-xs font-black tracking-widest uppercase text-tx-secondary">Ton pseudo</span>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="PseudoCool"
                        disabled={!!user}
                        className="w-full h-14 rounded-xl bg-brand-inner border-[3px] border-brand-border px-4 text-lg font-black text-white placeholder:text-tx-muted focus:outline-none focus:ring-4 focus:ring-accent-primary disabled:opacity-60"
                      />
                    </label>

                    {activeTab === 'join' && (
                      <label className="block space-y-2 animate-in fade-in slide-in-from-top-1">
                        <span className="text-xs font-black tracking-widest uppercase text-tx-secondary">Code de salle</span>
                        <input
                          value={code}
                          onChange={(e) => setCode(e.target.value.toUpperCase())}
                          placeholder="ABC123"
                          maxLength={6}
                          className="w-full h-14 rounded-xl bg-brand-inner border-[3px] border-brand-border px-4 font-display text-2xl tracking-[0.3em] text-white placeholder:text-tx-muted focus:outline-none focus:ring-4 focus:ring-accent-primary"
                        />
                      </label>
                    )}

                    <button type="submit" disabled={!canSubmit} className={cn(BTN_YELLOW, 'mt-auto w-full h-16 text-2xl')}>
                      {activeTab === 'create' ? 'Démarrer' : 'Rejoindre'}
                    </button>
                  </form>
                </div>

                <div className="flex flex-col bg-brand-card border-4 border-brand-border rounded-[22px] p-5 md:p-6 shadow-[0_8px_0_#05061A] fit:min-h-0 fit:overflow-hidden">
                  <div className="font-display text-2xl mb-4 short:mb-2">Comment jouer</div>
                  <HowToPlayDemo className="flex-1 min-h-0" />
                  {/* Inside the card, not under the page: asking for support never adds a scroll. */}
                  <DonateStrip className="mt-4" pseudo={user?.pseudo} text="Garde les salles ouvertes et de nouveaux jeux." />
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <footer className="pb-4 px-6">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-black tracking-widest uppercase text-tx-secondary">
          <Link href="/mentions-legales" className="hover:text-white">Mentions légales</Link>
          <Link href="/conditions" className="hover:text-white">Conditions</Link>
          {/* Reopens Ezoic's consent window; its floating gear is hidden (globals.css). */}
          <button
            type="button"
            onClick={() => {
              const cmp = (window as unknown as { ezCMP?: { generateCMPFromPrivacyCenter?: () => void } }).ezCMP;
              if (cmp?.generateCMPFromPrivacyCenter) cmp.generateCMPFromPrivacyCenter();
              else router.push('/confidentialite');
            }}
            className="uppercase tracking-widest hover:text-white"
          >
            Cookies
          </button>
          <Link href="/confidentialite" className="hover:text-white">Confidentialité</Link>
          <Link href="/patch-notes" className="hover:text-white">Patch notes</Link>
        </div>
      </footer>
    </main>
  );
}
