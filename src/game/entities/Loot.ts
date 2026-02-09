import Phaser from 'phaser';

export type LootKind = 'gold' | 'rune' | 'item';

export class Loot extends Phaser.Physics.Arcade.Sprite {
  public readonly kind: LootKind;
  public readonly amount: number;
  public readonly itemId?: string;
  public readonly itemName?: string;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture: string,
    kind: LootKind,
    amount: number,
    opts?: { itemId?: string; itemName?: string },
  ) {
    super(scene, x, y, texture);
    this.kind = kind;
    this.amount = amount;
    this.itemId = opts?.itemId;
    this.itemName = opts?.itemName;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setDamping(true);
    this.setDrag(1200, 1200);
    this.setMaxVelocity(300, 300);
  }
}
