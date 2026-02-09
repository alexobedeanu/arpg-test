import Phaser from 'phaser';

export type LootKind = 'gold' | 'rune';

export class Loot extends Phaser.Physics.Arcade.Sprite {
  public readonly kind: LootKind;
  public readonly amount: number;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, kind: LootKind, amount: number) {
    super(scene, x, y, texture);
    this.kind = kind;
    this.amount = amount;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setDamping(true);
    this.setDrag(1200, 1200);
    this.setMaxVelocity(300, 300);
  }
}
