import Phaser from 'phaser';

export type EnemyKind = 'ghoul';

export type EnemyConfig = {
  kind: EnemyKind;
  hp: number;
  speed: number;
  damage: number;
};

const DEFAULTS: Record<EnemyKind, EnemyConfig> = {
  ghoul: { kind: 'ghoul', hp: 18, speed: 105, damage: 4 },
};

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  public readonly kind: EnemyKind;
  public hp: number;
  public speed: number;
  public damage: number;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, kind: EnemyKind = 'ghoul') {
    super(scene, x, y, texture);

    const cfg = DEFAULTS[kind];
    this.kind = cfg.kind;
    this.hp = cfg.hp;
    this.speed = cfg.speed;
    this.damage = cfg.damage;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setDamping(true);
    this.setDrag(900, 900);
    this.setMaxVelocity(250, 250);
  }

  takeDamage(amount: number): boolean {
    this.hp = Math.max(0, this.hp - amount);
    return this.hp <= 0;
  }
}
