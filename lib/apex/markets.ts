export type CryptoState = {
  price: number;
  history: number[];
  holdings: number;
  costBasis: number;
  realizedProfit: number;
};

export type StockId = 'ITOL' | 'NAPL' | 'VOLT' | 'AURA' | 'SAND' | 'CETA';

export type StockDef = {
  id: StockId;
  name: string;
  base: number;
  volatility: number;
};

export type StockMarketState = {
  prices: Record<StockId, number>;
  history: Partial<Record<StockId, number[]>>;
  shares: Partial<Record<StockId, number>>;
  costBasis: Partial<Record<StockId, number>>;
  realizedProfit: number;
};

export const STOCKS: StockDef[] = [
  { id: 'ITOL', name: 'Itollec Holdings', base: 42, volatility: 0.04 },
  { id: 'NAPL', name: 'Napoléon Media', base: 78, volatility: 0.05 },
  { id: 'VOLT', name: 'Volt Studios', base: 31, volatility: 0.06 },
  { id: 'AURA', name: 'Aura Streaming', base: 55, volatility: 0.045 },
  { id: 'SAND', name: 'Sandstone Live', base: 26, volatility: 0.07 },
  { id: 'CETA', name: 'Ceta Publishing', base: 63, volatility: 0.05 },
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

export function initCryptoState(): CryptoState {
  return { price: 120, history: [120], holdings: 0, costBasis: 0, realizedProfit: 0 };
}

export function stepCrypto(state: CryptoState, seconds: number): CryptoState {
  const s = Math.max(1, Math.floor(seconds));
  let price = clampMin(state.price, 0.01);
  const history = [...state.history];

  for (let i = 0; i < s; i += 1) {
    const drift = 0.0002;
    const vol = 0.02;
    const shock = randn() * vol;
    price = clampMin(price * (1 + drift + shock), 0.01);
    history.push(price);
  }

  const trimmed = history.length > 180 ? history.slice(history.length - 180) : history;
  return { ...state, price, history: trimmed };
}

export function buyCrypto(state: CryptoState, cash: number): { next: CryptoState; spent: number; units: number } {
  const price = clampMin(state.price, 0.01);
  const spent = Math.max(0, cash);
  const units = spent / price;
  return {
    next: {
      ...state,
      holdings: state.holdings + units,
      costBasis: state.costBasis + spent,
    },
    spent,
    units,
  };
}

export function sellCrypto(state: CryptoState, units: number): { next: CryptoState; gained: number; profit: number } {
  const price = clampMin(state.price, 0.01);
  const sellUnits = Math.max(0, Math.min(state.holdings, units));
  const gained = sellUnits * price;
  const avg = state.holdings > 0 ? state.costBasis / state.holdings : 0;
  const cost = sellUnits * avg;
  const profit = gained - cost;

  const nextHoldings = state.holdings - sellUnits;
  const nextBasis = nextHoldings <= 0 ? 0 : Math.max(0, state.costBasis - cost);

  return {
    next: {
      ...state,
      holdings: nextHoldings,
      costBasis: nextBasis,
      realizedProfit: state.realizedProfit + profit,
    },
    gained,
    profit,
  };
}

export function initStockMarket(): StockMarketState {
  const prices = {} as Record<StockId, number>;
  const history: Partial<Record<StockId, number[]>> = {};
  for (const s of STOCKS) {
    prices[s.id] = s.base;
    history[s.id] = [s.base];
  }
  return { prices, history, shares: {}, costBasis: {}, realizedProfit: 0 };
}

export function stepStocks(state: StockMarketState, seconds: number): StockMarketState {
  const s = Math.max(1, Math.floor(seconds));
  const prices = { ...state.prices };
  const history: Partial<Record<StockId, number[]>> = { ...state.history };

  for (let t = 0; t < s; t += 1) {
    for (const def of STOCKS) {
      const drift = 0.00015;
      const shock = randn() * def.volatility;
      prices[def.id] = clampMin(prices[def.id] * (1 + drift + shock), 0.05);
      const arr = [...(history[def.id] ?? [])];
      arr.push(prices[def.id]);
      history[def.id] = arr.length > 180 ? arr.slice(arr.length - 180) : arr;
    }
  }

  return { ...state, prices, history };
}

export function portfolioValue(state: StockMarketState): number {
  let sum = 0;
  for (const def of STOCKS) {
    const shares = state.shares[def.id] ?? 0;
    sum += shares * (state.prices[def.id] ?? def.base);
  }
  return sum;
}

export function buyStock(state: StockMarketState, id: StockId, cash: number): { next: StockMarketState; spent: number; shares: number } {
  const price = clampMin(state.prices[id] ?? 1, 0.01);
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

export function sellStock(state: StockMarketState, id: StockId, shares: number): { next: StockMarketState; gained: number; profit: number } {
  const price = clampMin(state.prices[id] ?? 1, 0.01);
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

