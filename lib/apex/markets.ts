import type { ApexCryptoId, ApexCryptoState, ApexStockId, ApexStockState } from '@/types/apex';

type CryptoDef = {
  id: ApexCryptoId;
  base: number;
  volatility: number;
  drift: number;
  liquidity: number;
  impactK: number;
  stable: boolean;
};

const CRYPTOS: CryptoDef[] = [
  { id: 'BitApex', base: 120, volatility: 0.03, drift: 0.00025, liquidity: 250_000, impactK: 0.08, stable: false },
  { id: 'EtherGlobe', base: 45, volatility: 0.02, drift: 0.00018, liquidity: 200_000, impactK: 0.06, stable: false },
  { id: 'DogeStar', base: 3.2, volatility: 0.08, drift: 0.00012, liquidity: 60_000, impactK: 0.18, stable: false },
  { id: 'ApexStable', base: 1, volatility: 0, drift: 0, liquidity: 1_000_000, impactK: 0, stable: true },
];

type StockDef = {
  id: ApexStockId;
  name: string;
  base: number;
  volatility: number;
  dividend: boolean;
  dividendThreshold: number;
};

export const STOCKS: StockDef[] = [
  { id: 'CINEGLOBE', name: 'CinéGlobe Corp', base: 42, volatility: 0.05, dividend: false, dividendThreshold: 0 },
  { id: 'SOUNDWAVE', name: 'SoundWave Inc', base: 38, volatility: 0.06, dividend: false, dividendThreshold: 0 },
  { id: 'PRIMEVISION', name: 'PrimeVision', base: 55, volatility: 0.045, dividend: false, dividendThreshold: 0 },
  { id: 'LIVENATION', name: 'LiveNation-like', base: 26, volatility: 0.07, dividend: false, dividendThreshold: 0 },
  { id: 'PIXELFORGE', name: 'PixelForge', base: 31, volatility: 0.065, dividend: false, dividendThreshold: 0 },
  { id: 'APEXMEDIA', name: 'ApexMedia Holdings', base: 68, volatility: 0.04, dividend: false, dividendThreshold: 0 },
  { id: 'TECHSTREAM', name: 'TechStream', base: 24, volatility: 0.02, dividend: true, dividendThreshold: 22 },
  { id: 'GLOBALADS', name: 'GlobalAds Corp', base: 29, volatility: 0.055, dividend: true, dividendThreshold: 28 },
];

function clampMin(n: number, min: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, n);
}

function randn(): number {
  const u = Math.max(1e-9, Math.random());
  const v = Math.max(1e-9, Math.random());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function initCryptoState(): ApexCryptoState {
  const coins = {} as ApexCryptoState['coins'];
  for (const def of CRYPTOS) {
    coins[def.id] = {
      id: def.id,
      price: def.base,
      history: [def.base],
      holdings: 0,
      costBasis: 0,
      realizedProfit: 0,
      miningRatePerMin: 0,
    };
  }
  return { coins, selected: 'BitApex' };
}

function clampRange(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function stepCrypto(
  state: ApexCryptoState,
  seconds: number,
  now?: number,
  options?: { predictable?: boolean }
): ApexCryptoState {
  const s = Math.max(1, Math.floor(seconds));
  const coins = { ...state.coins };

  for (const def of CRYPTOS) {
    const prev = coins[def.id];
    if (!prev) continue;

    let price = clampMin(prev.price, 0.0001);
    const history = [...prev.history];

    for (let i = 0; i < s; i += 1) {
      if (now && prev.suspendedUntil && now < prev.suspendedUntil) {
        history.push(price);
        continue;
      }
      if (!def.stable) {
        const last = history[history.length - 1] ?? price;
        const prev2 = history[history.length - 2] ?? last;
        const delta = prev2 > 0 ? (last - prev2) / prev2 : 0;
        const momentum = options?.predictable ? clampRange(delta * 0.22, -0.012, 0.012) : 0;
        const shock = randn() * def.volatility * (options?.predictable ? 0.78 : 1);
        price = clampMin(price * (1 + def.drift + shock + momentum), 0.0001);
      } else {
        price = def.base;
      }

      history.push(price);
    }

    const trimmed = history.length > 300 ? history.slice(history.length - 300) : history;
    coins[def.id] = { ...prev, price, history: trimmed };
  }

  return { ...state, coins };
}

export function applyExternalCryptoImpact(args: {
  state: ApexCryptoState;
  coinId: ApexCryptoId;
  direction: 'buy' | 'sell';
  strength: number;
  now: number;
}): ApexCryptoState {
  const def = CRYPTOS.find((c) => c.id === args.coinId);
  const coin = args.state.coins[args.coinId];
  if (!def || !coin) return args.state;
  if (coin.suspendedUntil && args.now < coin.suspendedUntil) return args.state;
  if (def.stable) return args.state;

  const s = clampRange(args.strength, 0, 1);
  const price = clampMin(coin.price, 0.0001);
  const impact = Math.min(0.6, s * def.impactK * 2.2);
  const mult = args.direction === 'buy' ? 1 + impact : 1 - impact;
  const nextPrice = clampMin(price * mult, 0.0001);
  return {
    ...args.state,
    coins: {
      ...args.state.coins,
      [args.coinId]: {
        ...coin,
        price: nextPrice,
        history: [...coin.history, nextPrice].slice(-300),
      },
    },
  };
}

export function buyCrypto(args: { state: ApexCryptoState; coinId: ApexCryptoId; cash: number }): {
  next: ApexCryptoState;
  spent: number;
  units: number;
} {
  const def = CRYPTOS.find((c) => c.id === args.coinId);
  const coin = args.state.coins[args.coinId];
  if (!def || !coin) return { next: args.state, spent: 0, units: 0 };

  const price = clampMin(coin.price, 0.0001);
  const spent = Math.max(0, args.cash);
  const units = spent / price;

  const impact = def.stable ? 0 : Math.min(0.25, (spent / def.liquidity) * def.impactK);
  const nextPrice = def.stable ? def.base : clampMin(price * (1 + impact), 0.0001);

  return {
    next: {
      ...args.state,
      coins: {
        ...args.state.coins,
        [args.coinId]: {
          ...coin,
          price: nextPrice,
          holdings: coin.holdings + units,
          costBasis: coin.costBasis + spent,
          history: [...coin.history, nextPrice].slice(-300),
        },
      },
    },
    spent,
    units,
  };
}

export function sellCrypto(args: { state: ApexCryptoState; coinId: ApexCryptoId; units: number }): {
  next: ApexCryptoState;
  gained: number;
  profit: number;
} {
  const def = CRYPTOS.find((c) => c.id === args.coinId);
  const coin = args.state.coins[args.coinId];
  if (!def || !coin) return { next: args.state, gained: 0, profit: 0 };

  const price = clampMin(coin.price, 0.0001);
  const sellUnits = Math.max(0, Math.min(coin.holdings, args.units));
  const gained = sellUnits * price;
  const avg = coin.holdings > 0 ? coin.costBasis / coin.holdings : 0;
  const cost = sellUnits * avg;
  const profit = gained - cost;

  const nextHoldings = coin.holdings - sellUnits;
  const nextBasis = nextHoldings <= 0 ? 0 : Math.max(0, coin.costBasis - cost);

  const impact = def.stable ? 0 : Math.min(0.25, (gained / def.liquidity) * def.impactK);
  const nextPrice = def.stable ? def.base : clampMin(price * (1 - impact), 0.0001);

  return {
    next: {
      ...args.state,
      coins: {
        ...args.state.coins,
        [args.coinId]: {
          ...coin,
          price: nextPrice,
          holdings: nextHoldings,
          costBasis: nextBasis,
          realizedProfit: coin.realizedProfit + profit,
          history: [...coin.history, nextPrice].slice(-300),
        },
      },
    },
    gained,
    profit,
  };
}

export function initStockMarket(now: number): ApexStockState {
  const prices = {} as ApexStockState['prices'];
  const history: ApexStockState['history'] = {};
  for (const s of STOCKS) {
    prices[s.id] = s.base;
    history[s.id] = [s.base];
  }

  return {
    prices,
    history,
    shares: {},
    costBasis: {},
    realizedProfit: 0,
    nextDividendAt: now + 10 * 60 * 1000,
    nextQuarterAt: now + 20 * 60 * 1000,
  };
}

export function stepStocks(args: {
  state: ApexStockState;
  seconds: number;
  sentiment?: Partial<Record<ApexStockId, number>>;
  now: number;
}): { next: ApexStockState; dividends: number } {
  const s = Math.max(1, Math.floor(args.seconds));
  const prices = { ...args.state.prices };
  const history: ApexStockState['history'] = { ...args.state.history };

  for (let t = 0; t < s; t += 1) {
    for (const def of STOCKS) {
      const drift = 0.00012;
      const shock = randn() * def.volatility;
      const sent = Math.max(-0.02, Math.min(0.02, (args.sentiment?.[def.id] ?? 0) * 0.01));
      prices[def.id] = clampMin(prices[def.id] * (1 + drift + shock + sent), 0.05);
      const arr = [...(history[def.id] ?? [])];
      arr.push(prices[def.id]);
      history[def.id] = arr.length > 300 ? arr.slice(arr.length - 300) : arr;
    }
  }

  let nextDividendAt = args.state.nextDividendAt;
  let nextQuarterAt = args.state.nextQuarterAt;
  let dividends = 0;

  if (args.now >= nextQuarterAt) {
    nextQuarterAt = args.now + 20 * 60 * 1000;
    for (const def of STOCKS) {
      const shock = randn() * (def.volatility * 2.2);
      prices[def.id] = clampMin(prices[def.id] * (1 + shock), 0.05);
      const arr = [...(history[def.id] ?? [])];
      arr.push(prices[def.id]);
      history[def.id] = arr.length > 300 ? arr.slice(arr.length - 300) : arr;
    }
  }

  if (args.now >= nextDividendAt) {
    nextDividendAt = args.now + 10 * 60 * 1000;
    for (const def of STOCKS) {
      if (!def.dividend) continue;
      const price = prices[def.id];
      if (price < def.dividendThreshold) continue;
      const shares = args.state.shares[def.id] ?? 0;
      if (shares <= 0) continue;
      dividends += shares * price * 0.01;
    }
  }

  return {
    next: { ...args.state, prices, history, nextDividendAt, nextQuarterAt },
    dividends,
  };
}

export function portfolioValue(state: ApexStockState): number {
  let sum = 0;
  for (const def of STOCKS) {
    const shares = state.shares[def.id] ?? 0;
    sum += shares * (state.prices[def.id] ?? def.base);
  }
  return sum;
}

export function buyStock(state: ApexStockState, id: ApexStockId, cash: number): { next: ApexStockState; spent: number; shares: number } {
  const def = STOCKS.find((s) => s.id === id);
  const price = clampMin(state.prices[id] ?? def?.base ?? 1, 0.01);
  const spent = Math.max(0, cash);
  const shares = spent / price;

  const prevShares = state.shares[id] ?? 0;
  const prevBasis = state.costBasis[id] ?? 0;
  return {
    next: {
      ...state,
      shares: { ...state.shares, [id]: prevShares + shares },
      costBasis: { ...state.costBasis, [id]: prevBasis + spent },
    },
    spent,
    shares,
  };
}

export function sellStock(state: ApexStockState, id: ApexStockId, shares: number): { next: ApexStockState; gained: number; profit: number } {
  const def = STOCKS.find((s) => s.id === id);
  const price = clampMin(state.prices[id] ?? def?.base ?? 1, 0.01);
  const held = state.shares[id] ?? 0;
  const sellShares = Math.max(0, Math.min(held, shares));
  const gained = sellShares * price;

  const basis = state.costBasis[id] ?? 0;
  const avg = held > 0 ? basis / held : 0;
  const cost = sellShares * avg;
  const profit = gained - cost;

  const nextHeld = held - sellShares;
  const nextBasis = nextHeld <= 0 ? 0 : Math.max(0, basis - cost);

  return {
    next: {
      ...state,
      shares: { ...state.shares, [id]: nextHeld },
      costBasis: { ...state.costBasis, [id]: nextBasis },
      realizedProfit: state.realizedProfit + profit,
    },
    gained,
    profit,
  };
}
