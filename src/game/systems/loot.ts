export type WeightedEntry<T> = { weight: number; value: T };

export function pickWeighted<T>(entries: WeightedEntry<T>[], roll01: () => number): T {
  const total = entries.reduce((a, e) => a + Math.max(0, e.weight), 0);
  if (total <= 0) throw new Error('pickWeighted: total weight must be > 0');

  let r = roll01() * total;
  for (const e of entries) {
    const w = Math.max(0, e.weight);
    if (r < w) return e.value;
    r -= w;
  }
  return entries[entries.length - 1].value;
}
