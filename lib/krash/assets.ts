/**
 * What can be traded in Krash.
 *
 * Companies carry parody names and no logos: you recognise the real firm by
 * the name and the sector, nothing is copied. Cryptocurrencies and
 * commodities keep their real names — they are not companies' brands.
 *
 * `cap` (in billions) sets the ranking and the price's anchor. Prices wander
 * around that anchor and are pulled back towards it, so a mid-size company can
 * have a great week without ever overtaking the giants. `vol` is how nervous
 * the asset is: the big caps are calm, memecoins are not.
 */

export type MarketId = 'frx' | 'global' | 'crypto' | 'meme' | 'matieres';

export type Sector =
  | 'luxe' | 'energie' | 'banque' | 'industrie' | 'tech' | 'sante'
  | 'conso' | 'telecom' | 'auto' | 'aero' | 'btp' | 'media' | 'immo'
  | 'crypto_major' | 'crypto_alt' | 'crypto_meme'
  | 'metaux' | 'agri';

export interface Asset {
  id: string;
  name: string;
  market: MarketId;
  sector: Sector;
  /** Market capitalisation, in billions of ₶. Orders the list. */
  cap: number;
  /** Anchor price of one share, coin or unit, in ₶. */
  price: number;
  /** Typical relative swing; drives every octave of the price noise. */
  vol: number;
}

export const MARKETS: Record<MarketId, { label: string; description: string }> = {
  frx: { label: 'FRX 40', description: 'Les 40 plus grosses entreprises françaises.' },
  global: { label: 'Global 50', description: 'Les 50 géantes mondiales.' },
  crypto: { label: 'Crypto', description: 'Les grandes cryptomonnaies, bien plus nerveuses.' },
  meme: { label: 'Meme', description: 'Des jetons absurdes qui font x3 ou −70 % en une heure.' },
  matieres: { label: 'Matières', description: 'Or, pétrole, blé… Ils réagissent aux guerres et à la météo.' },
};

export const MARKET_ORDER: MarketId[] = ['frx', 'global', 'crypto', 'meme', 'matieres'];

export const SECTORS: Record<Sector, { label: string; dot: string; text: string }> = {
  luxe: { label: 'Luxe', dot: 'bg-fuchsia-400', text: 'text-fuchsia-300' },
  energie: { label: 'Énergie', dot: 'bg-yellow-400', text: 'text-yellow-300' },
  banque: { label: 'Banque & finance', dot: 'bg-emerald-400', text: 'text-emerald-300' },
  industrie: { label: 'Industrie', dot: 'bg-slate-400', text: 'text-slate-300' },
  tech: { label: 'Tech', dot: 'bg-sky-400', text: 'text-sky-300' },
  sante: { label: 'Santé', dot: 'bg-teal-400', text: 'text-teal-300' },
  conso: { label: 'Conso', dot: 'bg-lime-400', text: 'text-lime-300' },
  telecom: { label: 'Télécom', dot: 'bg-indigo-400', text: 'text-indigo-300' },
  auto: { label: 'Auto', dot: 'bg-red-400', text: 'text-red-300' },
  aero: { label: 'Aéro & défense', dot: 'bg-cyan-400', text: 'text-cyan-300' },
  btp: { label: 'BTP', dot: 'bg-amber-500', text: 'text-amber-400' },
  media: { label: 'Médias', dot: 'bg-pink-400', text: 'text-pink-300' },
  immo: { label: 'Immobilier', dot: 'bg-stone-400', text: 'text-stone-300' },
  crypto_major: { label: 'Crypto majeure', dot: 'bg-orange-400', text: 'text-orange-300' },
  crypto_alt: { label: 'Altcoin', dot: 'bg-violet-400', text: 'text-violet-300' },
  crypto_meme: { label: 'Memecoin', dot: 'bg-rose-400', text: 'text-rose-300' },
  metaux: { label: 'Métaux', dot: 'bg-zinc-300', text: 'text-zinc-200' },
  agri: { label: 'Agriculture', dot: 'bg-green-500', text: 'text-green-400' },
};

export const ASSETS: Asset[] = [
  // FRX 40
  { id: 'LVMX', name: 'LVMX', market: 'frx', sector: 'luxe', cap: 330, price: 660, vol: 0.035 },
  { id: 'HRMZ', name: 'Hermez', market: 'frx', sector: 'luxe', cap: 230, price: 2200, vol: 0.032 },
  { id: 'AURL', name: "L'Auréal", market: 'frx', sector: 'conso', cap: 210, price: 390, vol: 0.03 },
  { id: 'TOTO', name: 'TotoEnergies', market: 'frx', sector: 'energie', cap: 140, price: 60, vol: 0.04 },
  { id: 'SNFO', name: 'Sanofo', market: 'frx', sector: 'sante', cap: 125, price: 98, vol: 0.03 },
  { id: 'AIRZ', name: 'Airbuzz', market: 'frx', sector: 'aero', cap: 120, price: 150, vol: 0.04 },
  { id: 'SCHN', name: 'Schneidar', market: 'frx', sector: 'industrie', cap: 115, price: 205, vol: 0.038 },
  { id: 'SAFN', name: 'Safrun', market: 'frx', sector: 'aero', cap: 95, price: 225, vol: 0.038 },
  { id: 'ALIQ', name: 'Air Liquido', market: 'frx', sector: 'industrie', cap: 90, price: 165, vol: 0.028 },
  { id: 'AXO', name: 'AXO', market: 'frx', sector: 'banque', cap: 80, price: 35, vol: 0.035 },
  { id: 'BNQP', name: 'BNQ Paribus', market: 'frx', sector: 'banque', cap: 75, price: 66, vol: 0.042 },
  { id: 'ESLX', name: 'Essilux', market: 'frx', sector: 'sante', cap: 70, price: 215, vol: 0.03 },
  { id: 'VNCO', name: 'Vinco', market: 'frx', sector: 'btp', cap: 65, price: 110, vol: 0.032 },
  { id: 'KERR', name: 'Kerring', market: 'frx', sector: 'luxe', cap: 55, price: 380, vol: 0.05 },
  { id: 'DASY', name: 'Dasso Systèmes', market: 'frx', sector: 'tech', cap: 50, price: 38, vol: 0.045 },
  { id: 'DANN', name: "Danon'", market: 'frx', sector: 'conso', cap: 45, price: 67, vol: 0.026 },
  { id: 'CAGR', name: 'Crédit Agricolo', market: 'frx', sector: 'banque', cap: 42, price: 14, vol: 0.04 },
  { id: 'PRND', name: 'Pernaud Ricard', market: 'frx', sector: 'conso', cap: 40, price: 140, vol: 0.036 },
  { id: 'STLX', name: 'Stellantix', market: 'frx', sector: 'auto', cap: 38, price: 13, vol: 0.055 },
  { id: 'ORNG', name: 'Orangé', market: 'frx', sector: 'telecom', cap: 30, price: 11, vol: 0.028 },
  { id: 'SGEN', name: 'Société Génial', market: 'frx', sector: 'banque', cap: 28, price: 26, vol: 0.05 },
  { id: 'MICH', name: 'Michelun', market: 'frx', sector: 'auto', cap: 26, price: 36, vol: 0.036 },
  { id: 'SGBN', name: 'Saint-Goban', market: 'frx', sector: 'btp', cap: 25, price: 82, vol: 0.038 },
  { id: 'ENJI', name: 'Enjie', market: 'frx', sector: 'energie', cap: 24, price: 16, vol: 0.036 },
  { id: 'TALS', name: 'Talès', market: 'frx', sector: 'aero', cap: 23, price: 150, vol: 0.04 },
  { id: 'CAPG', name: 'Capgémeaux', market: 'frx', sector: 'tech', cap: 22, price: 170, vol: 0.045 },
  { id: 'VEOL', name: 'Véolio', market: 'frx', sector: 'energie', cap: 21, price: 30, vol: 0.03 },
  { id: 'PBLX', name: 'Publicix', market: 'frx', sector: 'media', cap: 20, price: 95, vol: 0.038 },
  { id: 'RENO', name: 'Renaud', market: 'frx', sector: 'auto', cap: 14, price: 47, vol: 0.058 },
  { id: 'LGRS', name: 'Legros', market: 'frx', sector: 'industrie', cap: 13, price: 98, vol: 0.032 },
  { id: 'BOUY', name: 'Bouyguez', market: 'frx', sector: 'btp', cap: 12, price: 31, vol: 0.034 },
  { id: 'STMC', name: 'STMicron', market: 'frx', sector: 'tech', cap: 11, price: 24, vol: 0.06 },
  { id: 'AKOR', name: 'Akor', market: 'frx', sector: 'conso', cap: 11, price: 42, vol: 0.042 },
  { id: 'CRFR', name: 'Carrefoor', market: 'frx', sector: 'conso', cap: 10, price: 14, vol: 0.034 },
  { id: 'ARCM', name: 'Arcelor Mittol', market: 'frx', sector: 'industrie', cap: 9, price: 23, vol: 0.055 },
  { id: 'UNBL', name: 'Unibaille', market: 'frx', sector: 'immo', cap: 9, price: 72, vol: 0.05 },
  { id: 'VIVD', name: 'Vivendo', market: 'frx', sector: 'media', cap: 8, price: 9, vol: 0.045 },
  { id: 'EFUN', name: 'Eurofun', market: 'frx', sector: 'sante', cap: 8, price: 45, vol: 0.05 },
  { id: 'ALST', name: 'Alstomme', market: 'frx', sector: 'industrie', cap: 7, price: 19, vol: 0.055 },
  { id: 'TLPF', name: 'Téléperformo', market: 'frx', sector: 'tech', cap: 6, price: 95, vol: 0.065 },

  // Global 50
  { id: 'POMM', name: 'Pomme', market: 'global', sector: 'tech', cap: 3200, price: 220, vol: 0.05 },
  { id: 'MCSF', name: 'Macrosoft', market: 'global', sector: 'tech', cap: 3100, price: 420, vol: 0.045 },
  { id: 'XVDA', name: 'Xvidia', market: 'global', sector: 'tech', cap: 3000, price: 120, vol: 0.09 },
  { id: 'ALPB', name: 'Alphabeta', market: 'global', sector: 'tech', cap: 2100, price: 170, vol: 0.055 },
  { id: 'AMZO', name: 'Amazoo', market: 'global', sector: 'conso', cap: 1900, price: 185, vol: 0.06 },
  { id: 'ARMK', name: 'Saudi Aramko', market: 'global', sector: 'energie', cap: 1800, price: 7.5, vol: 0.035 },
  { id: 'METO', name: 'Métaa', market: 'global', sector: 'tech', cap: 1400, price: 520, vol: 0.07 },
  { id: 'BRKS', name: 'Berkshare', market: 'global', sector: 'banque', cap: 950, price: 460, vol: 0.03 },
  { id: 'TSMX', name: 'TSMX', market: 'global', sector: 'tech', cap: 850, price: 170, vol: 0.07 },
  { id: 'TSLO', name: 'Teslo', market: 'global', sector: 'auto', cap: 800, price: 240, vol: 0.12 },
  { id: 'LOLY', name: 'Eli Lolly', market: 'global', sector: 'sante', cap: 800, price: 850, vol: 0.06 },
  { id: 'BRCM', name: 'Broadcum', market: 'global', sector: 'tech', cap: 750, price: 160, vol: 0.08 },
  { id: 'JPMG', name: 'JP Morgun', market: 'global', sector: 'banque', cap: 600, price: 210, vol: 0.04 },
  { id: 'VISO', name: 'Visaa', market: 'global', sector: 'banque', cap: 550, price: 280, vol: 0.035 },
  { id: 'WMRT', name: 'Walmarche', market: 'global', sector: 'conso', cap: 550, price: 70, vol: 0.03 },
  { id: 'XOMB', name: 'ExxonMobul', market: 'global', sector: 'energie', cap: 480, price: 115, vol: 0.045 },
  { id: 'MCRT', name: 'Mastercarte', market: 'global', sector: 'banque', cap: 450, price: 480, vol: 0.035 },
  { id: 'NOVO', name: 'Novo Nordik', market: 'global', sector: 'sante', cap: 450, price: 100, vol: 0.07 },
  { id: 'TNST', name: 'Tensent', market: 'global', sector: 'tech', cap: 450, price: 45, vol: 0.07 },
  { id: 'ORCO', name: 'Oraclo', market: 'global', sector: 'tech', cap: 400, price: 140, vol: 0.06 },
  { id: 'CSTK', name: 'Costko', market: 'global', sector: 'conso', cap: 380, price: 870, vol: 0.035 },
  { id: 'JNJX', name: 'Johnson & Johnsen', market: 'global', sector: 'sante', cap: 380, price: 155, vol: 0.03 },
  { id: 'SMSG', name: 'Samsong', market: 'global', sector: 'tech', cap: 350, price: 70, vol: 0.06 },
  { id: 'ASLM', name: 'ASLM', market: 'global', sector: 'tech', cap: 300, price: 750, vol: 0.07 },
  { id: 'CHVR', name: 'Chevrun', market: 'global', sector: 'energie', cap: 280, price: 150, vol: 0.045 },
  { id: 'NFLU', name: 'Netflux', market: 'global', sector: 'media', cap: 280, price: 650, vol: 0.07 },
  { id: 'KOKO', name: 'Coca-Colo', market: 'global', sector: 'conso', cap: 270, price: 63, vol: 0.025 },
  { id: 'NSTL', name: 'Nestlo', market: 'global', sector: 'conso', cap: 260, price: 95, vol: 0.03 },
  { id: 'SABX', name: 'SAB', market: 'global', sector: 'tech', cap: 250, price: 210, vol: 0.05 },
  { id: 'SALF', name: 'Salesfarce', market: 'global', sector: 'tech', cap: 250, price: 260, vol: 0.06 },
  { id: 'AMDX', name: 'AMDX', market: 'global', sector: 'tech', cap: 250, price: 150, vol: 0.1 },
  { id: 'TOYO', name: 'Toyoto', market: 'global', sector: 'auto', cap: 250, price: 180, vol: 0.04 },
  { id: 'ROCH', name: 'Roch', market: 'global', sector: 'sante', cap: 230, price: 270, vol: 0.035 },
  { id: 'PEPK', name: 'Pepsiko', market: 'global', sector: 'conso', cap: 220, price: 160, vol: 0.03 },
  { id: 'SHEL', name: 'Shelle', market: 'global', sector: 'energie', cap: 210, price: 33, vol: 0.045 },
  { id: 'MCDO', name: "McDonalt's", market: 'global', sector: 'conso', cap: 210, price: 290, vol: 0.03 },
  { id: 'ALBB', name: 'Alibobo', market: 'global', sector: 'conso', cap: 200, price: 85, vol: 0.09 },
  { id: 'CATR', name: 'Caterpillor', market: 'global', sector: 'industrie', cap: 170, price: 350, vol: 0.05 },
  { id: 'GSAX', name: 'Goldman Sax', market: 'global', sector: 'banque', cap: 160, price: 480, vol: 0.05 },
  { id: 'PFZR', name: 'Pfizor', market: 'global', sector: 'sante', cap: 160, price: 28, vol: 0.045 },
  { id: 'UBRR', name: 'Uberr', market: 'global', sector: 'tech', cap: 150, price: 70, vol: 0.08 },
  { id: 'BLKR', name: 'Blackrocks', market: 'global', sector: 'banque', cap: 130, price: 880, vol: 0.045 },
  { id: 'NIKY', name: 'Nikey', market: 'global', sector: 'conso', cap: 120, price: 80, vol: 0.06 },
  { id: 'LKMT', name: 'Lockheed Marteen', market: 'global', sector: 'aero', cap: 120, price: 480, vol: 0.04 },
  { id: 'SONO', name: 'Sonyo', market: 'global', sector: 'tech', cap: 110, price: 90, vol: 0.05 },
  { id: 'BOEG', name: 'Boeinge', market: 'global', sector: 'aero', cap: 110, price: 180, vol: 0.08 },
  { id: 'SHPI', name: 'Shopifi', market: 'global', sector: 'tech', cap: 100, price: 75, vol: 0.1 },
  { id: 'INTO', name: 'Intol', market: 'global', sector: 'tech', cap: 100, price: 23, vol: 0.08 },
  { id: 'SBUK', name: 'Starbuks', market: 'global', sector: 'conso', cap: 100, price: 90, vol: 0.05 },
  { id: 'PLTO', name: 'Palantor', market: 'global', sector: 'tech', cap: 90, price: 38, vol: 0.12 },

  // Crypto
  { id: 'BTC', name: 'Bitcoin', market: 'crypto', sector: 'crypto_major', cap: 1200, price: 60000, vol: 0.09 },
  { id: 'ETH', name: 'Ethereum', market: 'crypto', sector: 'crypto_major', cap: 380, price: 3200, vol: 0.11 },
  { id: 'BNB', name: 'BNB', market: 'crypto', sector: 'crypto_alt', cap: 85, price: 560, vol: 0.12 },
  { id: 'SOL', name: 'Solana', market: 'crypto', sector: 'crypto_alt', cap: 70, price: 150, vol: 0.15 },
  { id: 'XRP', name: 'XRP', market: 'crypto', sector: 'crypto_alt', cap: 55, price: 0.95, vol: 0.14 },
  { id: 'DOGE', name: 'Dogecoin', market: 'crypto', sector: 'crypto_meme', cap: 22, price: 0.15, vol: 0.2 },
  { id: 'ADA', name: 'Cardano', market: 'crypto', sector: 'crypto_alt', cap: 16, price: 0.45, vol: 0.16 },
  { id: 'TON', name: 'Toncoin', market: 'crypto', sector: 'crypto_alt', cap: 13, price: 5.2, vol: 0.16 },
  { id: 'TRX', name: 'Tron', market: 'crypto', sector: 'crypto_alt', cap: 12, price: 0.14, vol: 0.12 },
  { id: 'AVAX', name: 'Avalanche', market: 'crypto', sector: 'crypto_alt', cap: 11, price: 28, vol: 0.17 },
  { id: 'SHIB', name: 'Shiba Inu', market: 'crypto', sector: 'crypto_meme', cap: 10, price: 0.000018, vol: 0.24 },
  { id: 'LINK', name: 'Chainlink', market: 'crypto', sector: 'crypto_alt', cap: 9, price: 15, vol: 0.16 },
  { id: 'DOT', name: 'Polkadot', market: 'crypto', sector: 'crypto_alt', cap: 8, price: 5.5, vol: 0.16 },
  { id: 'LTC', name: 'Litecoin', market: 'crypto', sector: 'crypto_alt', cap: 6, price: 80, vol: 0.14 },
  { id: 'PEPE', name: 'Pepe', market: 'crypto', sector: 'crypto_meme', cap: 4, price: 0.000009, vol: 0.3 },

  // Meme
  { id: 'WIF', name: 'dogwifhat', market: 'meme', sector: 'crypto_meme', cap: 2.5, price: 2.4, vol: 0.38 },
  { id: 'BONK', name: 'Bonk', market: 'meme', sector: 'crypto_meme', cap: 2, price: 0.000025, vol: 0.4 },
  { id: 'FLOKI', name: 'Floki', market: 'meme', sector: 'crypto_meme', cap: 1.6, price: 0.00016, vol: 0.4 },
  { id: 'FRENLY', name: 'FrenlyToken', market: 'meme', sector: 'crypto_meme', cap: 0.9, price: 0.42, vol: 0.45 },
  { id: 'BAGUET', name: 'Baguette Coin', market: 'meme', sector: 'crypto_meme', cap: 0.6, price: 0.018, vol: 0.48 },
  { id: 'CROISS', name: 'Croissant Inu', market: 'meme', sector: 'crypto_meme', cap: 0.45, price: 0.0031, vol: 0.5 },
  { id: 'LENNY', name: 'LennyCoin', market: 'meme', sector: 'crypto_meme', cap: 0.3, price: 0.069, vol: 0.52 },
  { id: 'PASTIS', name: 'Pastis Token', market: 'meme', sector: 'crypto_meme', cap: 0.25, price: 0.51, vol: 0.5 },
  { id: 'ESCARG', name: 'Escargot', market: 'meme', sector: 'crypto_meme', cap: 0.15, price: 0.0009, vol: 0.55 },
  { id: 'MOON', name: 'MoonMoon', market: 'meme', sector: 'crypto_meme', cap: 0.08, price: 0.00042, vol: 0.6 },

  // Matières premières
  { id: 'GOLD', name: 'Or', market: 'matieres', sector: 'metaux', cap: 100, price: 2400, vol: 0.03 },
  { id: 'BRENT', name: 'Pétrole Brent', market: 'matieres', sector: 'energie', cap: 90, price: 82, vol: 0.06 },
  { id: 'GAZ', name: 'Gaz naturel', market: 'matieres', sector: 'energie', cap: 70, price: 2.5, vol: 0.1 },
  { id: 'SILVER', name: 'Argent', market: 'matieres', sector: 'metaux', cap: 60, price: 29, vol: 0.05 },
  { id: 'COPPER', name: 'Cuivre', market: 'matieres', sector: 'metaux', cap: 50, price: 4.2, vol: 0.05 },
  { id: 'URAN', name: 'Uranium', market: 'matieres', sector: 'energie', cap: 40, price: 85, vol: 0.07 },
  { id: 'WHEAT', name: 'Blé', market: 'matieres', sector: 'agri', cap: 35, price: 5.8, vol: 0.06 },
  { id: 'LITH', name: 'Lithium', market: 'matieres', sector: 'metaux', cap: 30, price: 13, vol: 0.09 },
  { id: 'COCOA', name: 'Cacao', market: 'matieres', sector: 'agri', cap: 25, price: 8000, vol: 0.09 },
  { id: 'COFFEE', name: 'Café', market: 'matieres', sector: 'agri', cap: 20, price: 2.3, vol: 0.07 },
];

export const ASSET_BY_ID = new Map(ASSETS.map((a) => [a.id, a]));

export function assetsOf(market: MarketId): Asset[] {
  return ASSETS.filter((a) => a.market === market).sort((a, b) => b.cap - a.cap);
}

/** Markets whose assets are companies, where {E} headlines can pick from. */
export const COMPANY_MARKETS: MarketId[] = ['frx', 'global'];

/** Prices change every this many seconds. */
export const KRASH_TICK = 2;

/**
 * Krash has its own FrenlyCoins: same name as the casino's, separate wallet.
 * A new wallet starts with KRASH_START_BALANCE; a player below
 * KRASH_REFILL_BELOW with nothing left on the market can refill it once a day.
 */
export const KRASH_START_BALANCE = 1000;
export const KRASH_REFILL_BELOW = 100;
export const KRASH_REFILL_AMOUNT = 1000;

/** Smallest stake, and the share of the balance one position may use. */
export const KRASH_MIN_STAKE = 10;
export const KRASH_MAX_STAKE_PCT = 0.5;

export const LEVERAGES = [1, 2, 5, 10] as const;
export type Leverage = (typeof LEVERAGES)[number];

/** Closed trades needed before a leverage opens up, so newcomers start gently. */
export const LEVERAGE_UNLOCK: Record<Leverage, number> = { 1: 0, 2: 0, 5: 5, 10: 20 };

/**
 * Fee per side, on the leveraged amount — the coin sink that keeps reading
 * the news from turning into a money printer. Tuned by simulation.
 */
export const KRASH_FEE_RATE = 0.0015;

export function tradeFee(stake: number, leverage: number): number {
  return Math.max(1, Math.round(stake * leverage * KRASH_FEE_RATE));
}

/** A position's value at `price`: never below zero. */
export function positionValue(
  p: { side: 'long' | 'short'; leverage: number; stake: number; entry_price: number }, price: number
): number {
  const move = price / p.entry_price - 1;
  const signed = p.side === 'long' ? move : -move;
  return Math.max(0, Math.round(p.stake * (1 + p.leverage * signed)));
}

/** The price at which a position has lost its whole stake. */
export function liquidationPrice(p: { side: 'long' | 'short'; leverage: number; entry_price: number }): number | null {
  if (p.side === 'long') return p.leverage > 1 ? p.entry_price * (1 - 1 / p.leverage) : null;
  return p.entry_price * (1 + 1 / p.leverage);
}

/* ------------------------------------------------------------------ */
/* Dividends                                                            */
/* ------------------------------------------------------------------ */

/** Company shares pay for being held: a reason to keep a good position open. */
export const DIVIDEND_MARKETS: MarketId[] = ['frx', 'global'];
export const DIVIDEND_RATE_PER_HALF_HOUR = 0.0025;
export const DIVIDEND_CAP = 0.03;

/** Earned by a long company position by `nowSeconds`; on the stake, so leverage does not inflate it. */
export function dividendFor(
  p: { market: string; side: 'long' | 'short'; stake: number; opened_at: string }, nowSeconds: number,
): number {
  if (p.side !== 'long' || !DIVIDEND_MARKETS.includes(p.market as MarketId)) return 0;
  const halfHours = Math.floor((nowSeconds - Date.parse(p.opened_at) / 1000) / 1800);
  return Math.floor(p.stake * Math.min(DIVIDEND_CAP, Math.max(0, halfHours) * DIVIDEND_RATE_PER_HALF_HOUR));
}

/* ------------------------------------------------------------------ */
/* Flash bets                                                           */
/* ------------------------------------------------------------------ */

/**
 * A quick call on a fresh headline: will its target be higher or lower a
 * minute after publication? Odds follow the published chances with a small
 * edge, so backing the obvious side pays little and the long shot pays a lot.
 */
export const FLASH = {
  /** Seconds after publication during which a bet is accepted. */
  window: 25,
  /** Extra seconds the server allows for the click to travel. */
  grace: 3,
  /** The verdict compares the price at publication with this many seconds later. */
  horizon: 60,
  edge: 0.9,
  /**
   * How much of the published chance survives to the verdict. Most of a
   * headline's move happens before it is published, so the minute after is
   * noisier than the odds suggest; paying on the raw chance let the long shot
   * return more than it cost. Measured by simulation.
   */
  realism: 0.8,
  minMultiplier: 1.1,
  maxMultiplier: 5,
  minStake: 10,
  maxStakePct: 0.25,
};

export function flashMultiplier(up: number, side: 'up' | 'down', certainty?: string): number {
  const published = certainty === 'pile' ? 0.5 : side === 'up' ? up : 1 - up;
  const chance = 0.5 + (published - 0.5) * FLASH.realism;
  const raw = FLASH.edge / Math.max(chance, 0.05);
  return Math.round(Math.min(FLASH.maxMultiplier, Math.max(FLASH.minMultiplier, raw)) * 100) / 100;
}

/** Enough decimals to see a 1 % move, whatever the scale of the price. */
export function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
  if (price >= 10) return price.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 0.1) return price.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const digits = Math.min(10, Math.max(4, 2 - Math.floor(Math.log10(price))));
  return price.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
