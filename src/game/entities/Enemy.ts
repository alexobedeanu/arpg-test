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

export type EnemyAttackProfile = {
  windupMs: number;
  cooldownMs: number;
  range: number;
};

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  public readonly kind: EnemyKind;
  public hp: number;
  public speed: number;
  public damage: number;

  public attack: EnemyAttackProfile;
  public nextAttackAt = 0;
  public windupEndsAt = 0;
  public isWindingUp = false;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, kind: EnemyKind = 'ghoul') {
    super(scene, x, y, texture);

    const cfg = DEFAULTS[kind];
    this.kind = cfg.kind;
    this.hp = cfg.hp;
    this.speed = cfg.speed;
    this.damage = cfg.damage;

    this.attack = { windupMs: 260, cooldownMs: 950, range: 26 };

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

  canStartAttack(now: number): boolean {
    return now >= this.nextAttackAt && !this.isWindingUp;
  }

  startAttack(now: number): void {
    this.isWindingUp = true;
    this.windupEndsAt = now + this.attack.windupMs;
    this.nextAttackAt = now + this.attack.cooldownMs;
  }

  consumeAttackIfReady(now: number): boolean {
    if (!this.isWindingUp) return false;
    if (now < this.windupEndsAt) return false;
    this.isWindingUp = false;
    return true;
  }
}
