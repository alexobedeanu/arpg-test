export type InventoryState = {
  gold: number;
  runes: number;
};

export class Inventory {
  private state: InventoryState;

  constructor(initial?: Partial<InventoryState>) {
    this.state = {
      gold: initial?.gold ?? 0,
      runes: initial?.runes ?? 0,
    };
  }

  addGold(amount: number): void {
    this.state.gold += Math.max(0, amount);
  }

  addRune(amount: number): void {
    this.state.runes += Math.max(0, amount);
  }

  snapshot(): InventoryState {
    return { ...this.state };
  }
}
