export type InventoryState = {
  gold: number;
  runes: number;
  items: Record<string, number>;
};

export class Inventory {
  private gold = 0;
  private runes = 0;
  private items = new Map<string, number>();

  constructor(initial?: Partial<InventoryState>) {
    this.gold = initial?.gold ?? 0;
    this.runes = initial?.runes ?? 0;
    if (initial?.items) {
      for (const [k, v] of Object.entries(initial.items)) this.items.set(k, v);
    }
  }

  addGold(amount: number): void {
    this.gold += Math.max(0, amount);
  }

  addRune(amount: number): void {
    this.runes += Math.max(0, amount);
  }

  addItem(itemId: string, amount = 1): void {
    const cur = this.items.get(itemId) ?? 0;
    this.items.set(itemId, cur + Math.max(0, amount));
  }

  count(itemId: string): number {
    return this.items.get(itemId) ?? 0;
  }

  snapshot(): InventoryState {
    const obj: Record<string, number> = {};
    for (const [k, v] of this.items.entries()) obj[k] = v;
    return { gold: this.gold, runes: this.runes, items: obj };
  }
}
