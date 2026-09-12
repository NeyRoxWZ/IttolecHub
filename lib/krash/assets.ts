/**
 * What can be traded in Krash.
 *
 * Companies carry parody names and no logos: you recognise the real firm by
 * the name and the sector, nothing is copied. Cryptocurrencies keep their real
 * names — they are not companies' brands.
 *
 * `cap` (in billions) sets the ranking and the price's anchor. Prices wander
 * around that anchor and are pulled back towards it, so a mid-size company can
 * have a great week without ever overtaking the giants. `vol` is how nervous
 * the asset is: the big French caps are calm, memecoins are not.
 */

export type MarketId = 'frx' | 'crypto';

export type Sector =
  | 'luxe' | 'energie' | 'banque' | 'industrie' | 'tech' | 'sante'
  | 'conso' | 'telecom' | 'auto' | 'aero' | 'btp' | 'media' | 'immo'
  | 'crypto_major' | 'crypto_alt' | 'crypto_meme';

export interface Asset {
  id: string;
  name: string;
  market: MarketId;
  sector: Sector;
  /** Market capitalisation, in billions of ₶. Orders the list. */
  cap: number;
  /** Anchor price of one share or coin, in ₶. */
  price: number;
  /** Typical relative swing; drives every octave of the price noise. */
  vol: number;
}

export const MARKETS: Record<MarketId, { label: string; short: string; description: string }> = {
  frx: { label: 'FRX 40', short: 'FRX 40', description: 'Les 40 plus grosses entreprises françaises.' },
  crypto: { label: 'Crypto', short: 'Crypto', description: 'Les cryptomonnaies, bien plus nerveuses.' },
};

export const MARKET_ORDER: MarketId[] = ['frx', 'crypto'];

export const SECTORS: Record<Sector, { label: string; dot: string; text: string }> = {
  luxe: { label: 'Luxe', dot: 'bg-fuchsia-400', text: 'text-fuchsia-300' },
  energie: { label: 'Énergie', dot: 'bg-yellow-400', text: 'text-yellow-300' },
  banque: { label: 'Banque', dot: 'bg-emerald-400', text: 'text-emerald-300' },
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

  // Crypto
  { id: 'BTC', name: 'Bitcoin', market: 'crypto', sector: 'crypto_major', cap: 1200, price: 60000, vol: 0.09 },
  { id: 'ETH', name: 'Ethereum', market: 'crypto', sector: 'crypto_major', cap: 380, price: 3200, vol: 0.11 },
  { id: 'SOL', name: 'Solana', market: 'crypto', sector: 'crypto_alt', cap: 70, price: 150, vol: 0.15 },
  { id: 'XRP', name: 'XRP', market: 'crypto', sector: 'crypto_alt', cap: 55, price: 0.95, vol: 0.14 },
  { id: 'BNB', name: 'BNB', market: 'crypto', sector: 'crypto_alt', cap: 85, price: 560, vol: 0.12 },
  { id: 'DOGE', name: 'Dogecoin', market: 'crypto', sector: 'crypto_meme', cap: 22, price: 0.15, vol: 0.2 },
  { id: 'ADA', name: 'Cardano', market: 'crypto', sector: 'crypto_alt', cap: 16, price: 0.45, vol: 0.16 },
  { id: 'TRX', name: 'Tron', market: 'crypto', sector: 'crypto_alt', cap: 12, price: 0.14, vol: 0.12 },
  { id: 'AVAX', name: 'Avalanche', market: 'crypto', sector: 'crypto_alt', cap: 11, price: 28, vol: 0.17 },
  { id: 'TON', name: 'Toncoin', market: 'crypto', sector: 'crypto_alt', cap: 13, price: 5.2, vol: 0.16 },
  { id: 'SHIB', name: 'Shiba Inu', market: 'crypto', sector: 'crypto_meme', cap: 10, price: 0.000018, vol: 0.24 },
  { id: 'LINK', name: 'Chainlink', market: 'crypto', sector: 'crypto_alt', cap: 9, price: 15, vol: 0.16 },
  { id: 'DOT', name: 'Polkadot', market: 'crypto', sector: 'crypto_alt', cap: 8, price: 5.5, vol: 0.16 },
  { id: 'LTC', name: 'Litecoin', market: 'crypto', sector: 'crypto_alt', cap: 6, price: 80, vol: 0.14 },
  { id: 'PEPE', name: 'Pepe', market: 'crypto', sector: 'crypto_meme', cap: 4, price: 0.000009, vol: 0.3 },
];

export const ASSET_BY_ID = new Map(ASSETS.map((a) => [a.id, a]));

export function assetsOf(market: MarketId): Asset[] {
  return ASSETS.filter((a) => a.market === market).sort((a, b) => b.cap - a.cap);
}

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

/** A position's value at `price`: never below zero, never more than the math. */
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

/** Enough decimals to see a 1 % move, whatever the scale of the price. */
export function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
  if (price >= 10) return price.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 0.1) return price.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const digits = Math.min(10, Math.max(4, 2 - Math.floor(Math.log10(price))));
  return price.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
