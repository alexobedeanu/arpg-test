import Phaser from 'phaser';
import { Enemy } from '../entities/Enemy';
import { Loot, type LootKind } from '../entities/Loot';
import { Projectile } from '../entities/Projectile';
import { Inventory } from '../systems/Inventory';
import { Hud } from '../ui/Hud';
import { ensureTextures } from '../assets/generateTextures';
import { createProceduralTilemap } from '../world/tilemap';

type PlayerClass = 'warden' | 'hexbinder' | 'gunslinger';

const CLASSES: Record<PlayerClass, { name: string; color: number; speed: number; damage: number; attackRange: number; attackCdMs: number }> = {
  warden: { name: 'Warden', color: 0x4ade80, speed: 185, damage: 7, attackRange: 48, attackCdMs: 320 },
  hexbinder: { name: 'Hexbinder', color: 0xa78bfa, speed: 195, damage: 5, attackRange: 72, attackCdMs: 260 },
  gunslinger: { name: 'Gunslinger', color: 0x60a5fa, speed: 205, damage: 4, attackRange: 90, attackCdMs: 180 },
};

export class GameScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { w: Phaser.Input.Keyboard.Key; a: Phaser.Input.Keyboard.Key; s: Phaser.Input.Keyboard.Key; d: Phaser.Input.Keyboard.Key };
  private attackKey!: Phaser.Input.Keyboard.Key;

  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private currentClass: PlayerClass = 'warden';

  private hp = 30;
  private hpMax = 30;

  private hud!: Hud;
  private inventory = new Inventory();

  private enemies!: Phaser.Physics.Arcade.Group;
  private loots!: Phaser.Physics.Arcade.Group;
  private projectiles!: Phaser.Physics.Arcade.Group;

  private lastAttackAt = 0;
  private lastFacing = new Phaser.Math.Vector2(1, 0);

  private worldW = 2000;
  private worldH = 1200;

  constructor() {
    super('game');
  }

  create(): void {
    ensureTextures(this);

    // World map
    const { layer, width, height } = createProceduralTilemap(this);
    this.worldW = width;
    this.worldH = height;

    // Input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      w: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      d: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.attackKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Player
    this.player = this.physics.add.sprite(160, 160, 'player');
    this.player.setDamping(true);
    this.player.setDrag(1100, 1100);
    this.player.setMaxVelocity(520, 520);
    this.player.setCollideWorldBounds(true);

    // Camera & bounds
    this.physics.world.setBounds(0, 0, this.worldW, this.worldH);
    this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setRoundPixels(true);

    // Collisions
    this.physics.add.collider(this.player, layer);

    // Groups
    this.enemies = this.physics.add.group({ classType: Enemy, runChildUpdate: false });
    this.loots = this.physics.add.group({ classType: Loot, runChildUpdate: false });
    this.projectiles = this.physics.add.group({ runChildUpdate: true });

    // Enemy collisions with world and each other
    this.physics.add.collider(this.enemies, layer);
    this.physics.add.collider(this.enemies, this.enemies);

    // Projectile collisions
    this.physics.add.collider(this.projectiles, layer, (_p, _t) => this.onProjectileHitWall(_p as Projectile));
    this.physics.add.overlap(this.projectiles, this.enemies, (p, e) => this.onProjectileHitEnemy(p as Projectile, e as Enemy));

    // Pick up loot
    this.physics.add.overlap(this.player, this.loots, (_p, l) => this.onPickup(l as Loot));

    // Damage player on contact
    this.physics.add.overlap(this.player, this.enemies, (_p, e) => this.onPlayerHit(e as Enemy));

    // Spawn loop
    this.time.addEvent({
      delay: 1400,
      loop: true,
      callback: () => this.spawnEnemy(),
    });

    // HUD
    this.hud = new Hud(this);
    this.setClass(this.currentClass);
    this.hud.setHP(this.hp, this.hpMax);
    this.hud.setInventory(this.inventory.snapshot());

    // Class switching
    this.input.keyboard!.on('keydown-ONE', () => this.setClass('warden'));
    this.input.keyboard!.on('keydown-TWO', () => this.setClass('hexbinder'));
    this.input.keyboard!.on('keydown-THREE', () => this.setClass('gunslinger'));

    // Mouse click attack
    this.input.on('pointerdown', () => this.tryAttack());

    // (Optional) show spawn area bounds
  }

  update(time: number): void {
    this.handleMovement();

    if (Phaser.Input.Keyboard.JustDown(this.attackKey)) {
      this.tryAttack();
    }

    this.updateEnemyAI();

    // auto regen tiny (so it's playable)
    if (time % 5000 < 16 && this.hp < this.hpMax) {
      this.hp = Math.min(this.hpMax, this.hp + 1);
      this.hud.setHP(this.hp, this.hpMax);
    }
  }

  private handleMovement(): void {
    const cls = CLASSES[this.currentClass];

    let vx = 0;
    let vy = 0;

    const left = this.cursors.left.isDown || this.wasd.a.isDown;
    const right = this.cursors.right.isDown || this.wasd.d.isDown;
    const up = this.cursors.up.isDown || this.wasd.w.isDown;
    const down = this.cursors.down.isDown || this.wasd.s.isDown;

    if (left) vx -= 1;
    if (right) vx += 1;
    if (up) vy -= 1;
    if (down) vy += 1;

    const len = Math.hypot(vx, vy);
    if (len > 0) {
      vx = (vx / len) * cls.speed;
      vy = (vy / len) * cls.speed;
      this.lastFacing.set(vx, vy).normalize();
    }

    this.player.setVelocity(vx, vy);
  }

  private setClass(cls: PlayerClass): void {
    this.currentClass = cls;
    this.player.setTint(CLASSES[cls].color);
    this.hud?.setClass(CLASSES[cls].name);
  }

  private tryAttack(): void {
    const now = this.time.now;
    const cls = CLASSES[this.currentClass];
    if (now - this.lastAttackAt < cls.attackCdMs) return;
    this.lastAttackAt = now;

    if (this.currentClass === 'gunslinger') {
      this.fireGunslingerShot(cls.damage);
      return;
    }

    // Melee / short-range AoE
    const dir = this.lastFacing.clone();
    const range = cls.attackRange;

    const cx = this.player.x + dir.x * range;
    const cy = this.player.y + dir.y * range;

    const radius = this.currentClass === 'warden' ? 28 : 22;

    // Attack effect
    const fx = this.add.circle(cx, cy, radius, 0xffffff, 0.12).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: fx, alpha: 0, duration: 140, onComplete: () => fx.destroy() });

    // Hit enemies in circle
    const enemies = this.enemies.getChildren() as Enemy[];
    for (const e of enemies) {
      if (!e.active) continue;
      const d = Phaser.Math.Distance.Between(cx, cy, e.x, e.y);
      if (d <= radius + 12) {
        const dead = e.takeDamage(cls.damage);
        // knockback
        const k = new Phaser.Math.Vector2(e.x - this.player.x, e.y - this.player.y).normalize().scale(140);
        (e.body as Phaser.Physics.Arcade.Body).velocity.add(k);

        if (dead) {
          this.onEnemyKilled(e);
        } else {
          // brief flash
          this.tweens.add({ targets: e, alpha: 0.5, yoyo: true, duration: 60, repeat: 1 });
        }
      }
    }
  }

  private fireGunslingerShot(damage: number): void {
    // Prefer aiming at mouse cursor if available.
    const ptr = this.input.activePointer;
    const aim = new Phaser.Math.Vector2(ptr.worldX - this.player.x, ptr.worldY - this.player.y);
    const dir = aim.lengthSq() > 32 ? aim.normalize() : this.lastFacing.clone();

    // Spawn just in front of the player so we don't instantly collide with walls.
    const muzzleDist = 18;
    const x = this.player.x + dir.x * muzzleDist;
    const y = this.player.y + dir.y * muzzleDist;

    const speed = 760;
    const lifeMs = 700;

    const p = new Projectile(this, x, y, 'bullet', { dir, speed, damage, lifeMs });
    this.projectiles.add(p);

    // Muzzle flash
    const flash = this.add.circle(x, y, 6, 0xffffff, 0.18).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: flash, scale: 1.8, alpha: 0, duration: 90, onComplete: () => flash.destroy() });

    // Tiny recoil
    const recoil = dir.clone().scale(-14);
    (this.player.body as Phaser.Physics.Arcade.Body).velocity.add(recoil);
  }

  private onProjectileHitEnemy(p: Projectile, e: Enemy): void {
    if (!p.active || !e.active) return;

    const dead = e.takeDamage(p.damage);

    // Impact VFX
    const hit = this.add.circle(p.x, p.y, 10, 0xffffff, 0.14).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: hit, scale: 2.2, alpha: 0, duration: 140, onComplete: () => hit.destroy() });

    // Knockback away from projectile travel
    const body = e.body as Phaser.Physics.Arcade.Body;
    const kb = new Phaser.Math.Vector2(body.x - p.x, body.y - p.y).normalize().scale(160);
    body.velocity.add(kb);

    // Brief flash
    if (!dead) this.tweens.add({ targets: e, alpha: 0.55, yoyo: true, duration: 50, repeat: 1 });

    p.destroy();

    if (dead) this.onEnemyKilled(e);
  }

  private onProjectileHitWall(p: Projectile): void {
    if (!p.active) return;

    const spark = this.add.circle(p.x, p.y, 8, 0xffffff, 0.10).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: spark, scale: 2.0, alpha: 0, duration: 120, onComplete: () => spark.destroy() });

    p.destroy();
  }

  private spawnEnemy(): void {
    const minDist = 340;

    for (let i = 0; i < 12; i++) {
      const x = Phaser.Math.Between(40, this.worldW - 40);
      const y = Phaser.Math.Between(40, this.worldH - 40);
      const d = Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y);
      if (d < minDist) continue;

      const e = new Enemy(this, x, y, 'enemy', 'ghoul');
      e.setTint(0xf97316);
      e.setDepth(1);
      this.enemies.add(e);
      return;
    }
  }

  private updateEnemyAI(): void {
    const enemies = this.enemies.getChildren() as Enemy[];

    for (const e of enemies) {
      if (!e.active) continue;
      const body = e.body as Phaser.Physics.Arcade.Body;

      const dist = Phaser.Math.Distance.Between(e.x, e.y, this.player.x, this.player.y);
      if (dist > 520) {
        // idle drift
        body.setAcceleration(0, 0);
        continue;
      }

      const dir = new Phaser.Math.Vector2(this.player.x - e.x, this.player.y - e.y);
      if (dir.lengthSq() < 0.0001) continue;
      dir.normalize();

      const accel = e.speed * 7;
      body.setAcceleration(dir.x * accel, dir.y * accel);
    }
  }

  private onEnemyKilled(e: Enemy): void {
    // Spawn loot
    const roll = Phaser.Math.Between(1, 100);
    const kind: LootKind = roll <= 75 ? 'gold' : 'rune';
    const amount = kind === 'gold' ? Phaser.Math.Between(3, 12) : 1;

    const lootTex = kind === 'gold' ? 'lootGold' : 'lootRune';
    const l = new Loot(this, e.x, e.y, lootTex, kind, amount);
    l.setDepth(2);

    // toss a bit
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const v = new Phaser.Math.Vector2(Math.cos(angle), Math.sin(angle)).scale(120);
    (l.body as Phaser.Physics.Arcade.Body).setVelocity(v.x, v.y);

    this.loots.add(l);

    // Death effect
    const puff = this.add.circle(e.x, e.y, 18, 0xffffff, 0.08).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: puff, scale: 2.1, alpha: 0, duration: 260, onComplete: () => puff.destroy() });

    e.destroy();
  }

  private onPickup(l: Loot): void {
    if (!l.active) return;
    if (l.kind === 'gold') this.inventory.addGold(l.amount);
    if (l.kind === 'rune') this.inventory.addRune(l.amount);

    this.hud.setInventory(this.inventory.snapshot());

    const t = this.add.text(l.x, l.y - 8, l.kind === 'gold' ? `+${l.amount}g` : '+rune', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif',
      fontSize: '12px',
      color: l.kind === 'gold' ? '#fde68a' : '#bfdbfe',
    });
    this.tweens.add({ targets: t, y: t.y - 18, alpha: 0, duration: 550, onComplete: () => t.destroy() });

    l.destroy();
  }

  private lastHurtAt = 0;
  private onPlayerHit(e: Enemy): void {
    const now = this.time.now;
    if (now - this.lastHurtAt < 500) return;
    this.lastHurtAt = now;

    this.hp = Math.max(0, this.hp - e.damage);
    this.hud.setHP(this.hp, this.hpMax);

    // screen shake
    this.cameras.main.shake(80, 0.004);

    if (this.hp <= 0) {
      this.hp = this.hpMax;
      this.player.setPosition(160, 160);
      this.hud.setHP(this.hp, this.hpMax);
    }
  }
}
