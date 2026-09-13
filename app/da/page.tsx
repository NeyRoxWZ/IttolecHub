'use client';

import { useEffect, useState } from 'react';

type Variant = 'console' | 'brawl' | 'hud' | 'flyer';
type GameId = 'clicker' | 'casino' | 'krash';

const VARIANTS: { id: Variant; name: string; pitch: string }[] = [
  { id: 'console', name: 'Console', pitch: 'Lanceur de jeux AAA : grandes jaquettes, typo condensée, un seul orange, zéro effet.' },
  { id: 'brawl', name: 'Brawl', pitch: 'Jeu mobile pro : contours épais, boutons en relief, titres détourés, barre du bas.' },
  { id: 'hud', name: 'HUD', pitch: 'Esport tactique : panneaux biseautés, données en chiffres fixes, rouge précis.' },
  { id: 'flyer', name: 'Flyer', pitch: 'Affiche d’arcade imprimée : fond jaune, encre noire, décalages d’impression, version claire.' },
];

const GAMES: { id: GameId; name: string; tagline: string; tag: string; players: number }[] = [
  { id: 'clicker', name: 'ItollecClicker', tagline: 'Clique, investis, deviens milliardaire.', tag: 'Idle', players: 42 },
  { id: 'casino', name: 'Casino', tagline: '20 jeux, pass du mois, coffre et missions.', tag: 'Nouveau pass', players: 128 },
  { id: 'krash', name: 'Krash', tagline: 'La bourse en accéléré, sans vrai argent.', tag: 'Bêta', players: 31 },
];

/** Cover art drawn from each game's world, recoloured per direction. */
function Cover({ game, bg, a, b, ink, paper = '#FFFFFF', font }: { game: GameId; bg: string; a: string; b: string; ink: string; paper?: string; font?: string }) {
  return (
    <svg viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice" className="da-cover" role="img" aria-label={game}>
      <rect width="300" height="200" fill={bg} />
      {game === 'clicker' && (
        <>
          <circle cx="190" cy="100" r="78" fill={a} />
          <circle cx="190" cy="100" r="52" fill={b} />
          <circle cx="190" cy="100" r="26" fill={a} />
          <polygon points="112,52 112,150 136,128 153,166 170,158 153,121 186,121" fill={paper} stroke={ink} strokeWidth="7" strokeLinejoin="round" />
        </>
      )}
      {game === 'casino' && (
        <>
          {[40, 120, 200].map((x) => (
            <g key={x}>
              <rect x={x} y="48" width="62" height="100" rx="10" fill={paper} stroke={ink} strokeWidth="7" />
              <text x={x + 31} y="122" textAnchor="middle" fontSize="66" fontWeight="900" fill={a} style={{ fontFamily: font }}>7</text>
            </g>
          ))}
          <rect x="272" y="60" width="10" height="70" rx="5" fill={ink} />
          <circle cx="277" cy="56" r="12" fill={b} stroke={ink} strokeWidth="5" />
        </>
      )}
      {game === 'krash' && (
        <>
          {[50, 100, 150].map((y) => <line key={y} x1="0" x2="300" y1={y} y2={y} stroke={paper} strokeOpacity="0.12" strokeWidth="2" />)}
          <polyline points="18,166 58,142 92,154 128,104 164,120 202,62 236,84 282,30" fill="none" stroke={a} strokeWidth="12" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx="282" cy="30" r="13" fill={b} stroke={ink} strokeWidth="5" />
        </>
      )}
    </svg>
  );
}

const Logo = ({ className }: { className: string }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src="/logo-site.png" alt="ItollecHub" className={className} />
);

/* ------------------------------------------------------------------ */

function ConsoleDirection() {
  return (
    <div className="da-console">
      <aside className="c-nav">
        <Logo className="c-logo" />
        <nav className="c-links">
          {['Accueil', 'Solo', 'Multijoueur', 'Classements', 'Boutique', 'Profil'].map((l) => (
            <a key={l} className={l === 'Solo' ? 'is-on' : undefined}>{l}</a>
          ))}
        </nav>
      </aside>
      <div className="c-main">
        <header className="c-top">
          <div className="c-crumb">Solo</div>
          <div className="c-user">
            <span className="c-coins">48 320 ₶</span>
            <span className="c-avatar">L</span>
            <span>LennyBar</span>
          </div>
        </header>

        <section className="c-hero">
          <Cover game="casino" bg="#2A1406" a="#FF6A13" b="#FFD23F" ink="#0E1014" font="var(--f-barlow-c)" />
          <div className="c-hero-copy">
            <span className="c-kicker">À la une · Saison 2</span>
            <h1>Casino</h1>
            <p>Le pass de septembre est sorti : 100 paliers, 30 cosmétiques, un nouveau jeu de dés.</p>
            <div className="c-actions">
              <button className="c-btn c-btn-main">Jouer</button>
              <button className="c-btn c-btn-ghost">Voir le pass</button>
            </div>
          </div>
        </section>

        <div className="c-body">
          <section>
            <h2 className="c-h2">Jeux solo</h2>
            <div className="c-grid">
              {GAMES.map((g, i) => (
                <article key={g.id} className={i === 1 ? 'c-card is-focus' : 'c-card'}>
                  <Cover
                    game={g.id}
                    bg={['#0F2A22', '#2A1406', '#141B33'][i]}
                    a={['#34D399', '#FF6A13', '#5B8CFF'][i]}
                    b={['#0E1014', '#FFD23F', '#FF6A13'][i]}
                    ink="#0E1014"
                    font="var(--f-barlow-c)"
                  />
                  <div className="c-card-copy">
                    <div className="c-card-name">{g.name}</div>
                    <div className="c-card-meta"><span>{g.tag}</span><span>{g.players} en jeu</span></div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className="c-today">
            <h2 className="c-h2">Aujourd’hui</h2>
            <div className="c-row"><div><b>Coffre du jour</b><small>Série de 6 jours</small></div><button className="c-btn c-btn-main c-btn-sm">+150 ₶</button></div>
            <div className="c-row c-col">
              <div className="c-line"><b>Missions</b><small>2 / 3</small></div>
              <div className="c-bar"><i style={{ width: '66%' }} /></div>
            </div>
            <div className="c-row c-col">
              <div className="c-line"><b>Pass casino</b><small>Palier 12 / 100</small></div>
              <div className="c-bar"><i style={{ width: '12%' }} /></div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function BrawlDirection() {
  return (
    <div className="da-brawl">
      <header className="b-top">
        <Logo className="b-logo" />
        <nav className="b-mode">
          <a>Multijoueur</a>
          <a className="is-on">Solo</a>
        </nav>
        <div className="b-res">
          <span className="b-pill"><i className="b-coin" />48 320<b>+</b></span>
          <span className="b-level"><span>24</span>LennyBar</span>
        </div>
      </header>

      <main className="b-main">
        <div className="b-head">
          <h1 className="b-stroke">Jeux solo</h1>
          <p>Choisis un jeu. Tes coins et ton pass te suivent partout.</p>
        </div>

        <div className="b-cards">
          {GAMES.map((g, i) => (
            <article key={g.id} className={`b-card b-card-${g.id}`}>
              <span className="b-ribbon">{g.tag}</span>
              <Cover
                game={g.id}
                bg={['#1FB866', '#8B3DFF', '#FF4F8B'][i]}
                a={['#FFFFFF', '#FFC61A', '#FFFFFF'][i]}
                b={['#14142B', '#FF4F8B', '#FFC61A'][i]}
                ink="#14142B"
                font="var(--f-lilita)"
              />
              <div className="b-card-body">
                <div className="b-card-name b-stroke">{g.name}</div>
                <p>{g.tagline}</p>
                <div className="b-card-foot">
                  <span className="b-online"><i />{g.players} en jeu</span>
                  <button className="b-btn b-btn-yellow">Jouer</button>
                </div>
              </div>
            </article>
          ))}
        </div>

        <aside className="b-side">
          <div className="b-panel b-chest">
            <div className="b-chest-art" aria-hidden="true"><i /></div>
            <div>
              <div className="b-panel-title">Coffre prêt !</div>
              <small>Série de 6 jours</small>
            </div>
            <button className="b-btn b-btn-green">Ouvrir</button>
          </div>
          <div className="b-panel">
            <div className="b-panel-title">Missions</div>
            {[['Gagner 5 parties', 5, 5], ['Miser 2 000 ₶', 1400, 2000], ['Ouvrir une caisse', 0, 1]].map(([label, v, max]) => (
              <div key={String(label)} className="b-mission">
                <span>{label}</span>
                <div className="b-bar"><i style={{ width: `${(Number(v) / Number(max)) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </aside>
      </main>

      <nav className="b-dock">
        {['Boutique', 'Pass', 'Jouer', 'Classement', 'Profil'].map((l) => (
          <a key={l} className={l === 'Jouer' ? 'b-dock-main' : undefined}>{l}</a>
        ))}
      </nav>
    </div>
  );
}

function HudDirection() {
  return (
    <div className="da-hud">
      <div className="h-status">
        <span><i className="h-dot" />201 joueurs en ligne</span>
        <span>Saison 2 · fin dans 17 j</span>
        <span>v1.0.1</span>
      </div>
      <header className="h-top">
        <Logo className="h-logo" />
        <nav className="h-links">
          {['Solo', 'Multijoueur', 'Classements', 'Boutique'].map((l) => <a key={l} className={l === 'Solo' ? 'is-on' : undefined}>{l}</a>)}
        </nav>
        <div className="h-user">
          <span className="h-coins">48 320 ₶</span>
          <span className="h-avatar">LB</span>
        </div>
      </header>

      <section className="h-hero h-cut">
        <div>
          <div className="h-label">Mode</div>
          <h1>Solo</h1>
          <p>Trois jeux, une progression partagée. Reprends là où tu t’es arrêté.</p>
        </div>
        <dl className="h-stats">
          <div><dt>Jeux</dt><dd>3</dd></div>
          <div><dt>Meilleure série</dt><dd>12</dd></div>
          <div><dt>Pass</dt><dd>12<small>/100</small></dd></div>
        </dl>
      </section>

      <div className="h-body">
        <section className="h-list">
          {GAMES.map((g, i) => (
            <article key={g.id} className={i === 1 ? 'h-row h-cut is-on' : 'h-row h-cut'}>
              <div className="h-thumb">
                <Cover game={g.id} bg="#1B1E25" a={['#E6E8EC', '#FF3B4E', '#F5C451'][i]} b={['#FF3B4E', '#F5C451', '#FF3B4E'][i]} ink="#0B0C0F" paper="#E6E8EC" font="var(--f-oxanium)" />
              </div>
              <div className="h-row-copy">
                <div className="h-row-name">{g.name}</div>
                <p>{g.tagline}</p>
              </div>
              <span className="h-chip">{g.tag}</span>
              <span className="h-num">{g.players}<small>en jeu</small></span>
              <button className="h-btn">Lancer</button>
            </article>
          ))}
        </section>

        <aside className="h-side h-cut">
          <div className="h-label">Objectifs du jour</div>
          {[['Ouvrir le coffre', true], ['Gagner 5 parties', true], ['Miser 2 000 ₶', false]].map(([label, done]) => (
            <div key={String(label)} className={done ? 'h-obj is-done' : 'h-obj'}><i />{label}</div>
          ))}
          <div className="h-label h-gap">Coffre</div>
          <button className="h-btn h-btn-wide">Récupérer +150 ₶</button>
        </aside>
      </div>
    </div>
  );
}

function FlyerDirection() {
  return (
    <div className="da-flyer">
      <header className="f-top">
        <Logo className="f-logo" />
        <nav className="f-tabs">
          <a>Multijoueur</a>
          <a className="is-on">Solo</a>
        </nav>
        <span className="f-ticket">48 320 ₶</span>
      </header>

      <section className="f-hero">
        <h1>Choisis<br />ton jeu</h1>
        <div className="f-sticker">Nouveau<br />pass<br />casino</div>
      </section>

      <div className="f-grid">
        {GAMES.map((g, i) => (
          <article key={g.id} className="f-card">
            <Cover game={g.id} bg={['#1D4ED8', '#E63946', '#111111'][i]} a={['#FFD23F', '#FFD23F', '#E63946'][i]} b={['#FFFFFF', '#111111', '#FFD23F'][i]} ink="#111111" font="var(--f-bowlby)" />
            <div className="f-card-body">
              <div className="f-card-name">{g.name}</div>
              <p>{g.tagline}</p>
              <button className="f-btn">Jouer →</button>
            </div>
          </article>
        ))}
      </div>

      <div className="f-strip">
        <div><b>Coffre</b><span>Prêt · +150 ₶</span></div>
        <div><b>Missions</b><span>2 sur 3</span></div>
        <div><b>Pass</b><span>Palier 12</span></div>
      </div>
    </div>
  );
}

const VIEWS: Record<Variant, () => JSX.Element> = {
  console: ConsoleDirection, brawl: BrawlDirection, hud: HudDirection, flyer: FlyerDirection,
};

export default function DaPage() {
  const [variant, setVariant] = useState<Variant>('console');

  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('v') as Variant | null;
    if (v && v in VIEWS) setVariant(v);
  }, []);

  const pick = (v: Variant) => {
    setVariant(v);
    window.history.replaceState(null, '', `/da?v=${v}`);
    window.scrollTo({ top: 0 });
  };

  const View = VIEWS[variant];
  const current = VARIANTS.find((x) => x.id === variant)!;

  return (
    <div className="da-page">
      <div className="da-switch">
        <div className="da-switch-tabs" role="tablist">
          {VARIANTS.map((v) => (
            <button key={v.id} role="tab" aria-selected={v.id === variant} onClick={() => pick(v.id)}>{v.name}</button>
          ))}
        </div>
        <p>{current.pitch}</p>
        <a href="/" className="da-back">Retour au site</a>
      </div>
      <View />
    </div>
  );
}
