export type DrawState = {
  order: number[];
  idx: number;
};

function shuffle(arr: number[]): number[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

export function drawWithoutReplacement(args: {
  list: string[];
  prev: DrawState | undefined;
}): { value: string; next: DrawState } {
  const { list } = args;
  if (list.length === 0) {
    return { value: 'Sans titre', next: { order: [], idx: 0 } };
  }

  const prev = args.prev;
  let order = prev?.order ?? [];
  let idx = prev?.idx ?? 0;

  const valid = order.length === list.length && order.every((n) => Number.isInteger(n) && n >= 0 && n < list.length);
  if (!valid) {
    order = [];
    idx = 0;
  }

  if (order.length === 0 || idx >= order.length) {
    order = shuffle([...Array(list.length)].map((_, i) => i));
    idx = 0;
  }

  const pickIndex = order[idx] ?? 0;
  const value = list[pickIndex] ?? list[0]!;
  return { value, next: { order, idx: idx + 1 } };
}

