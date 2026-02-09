import Phaser from 'phaser';
import { Enemy } from '../entities/Enemy';
import { Loot, type LootKind } from '../entities/Loot';
import { Projectile } from '../entities/Projectile';
import { Inventory } from '../systems/Inventory';
import { Hud } from '../ui/Hud';
import { ensureTextures } from '../assets/generateTextures';
import { createProceduralTilemap } from '../world/tilemap';
import { pickWeighted } from '../systems/loot';

import classesData from '../data/classes/classes.v1.json';
import itemsData from '../data/items/items.starter.v1.json';
import lootData from '../data/loot/lootTables.v1.json';

type PlayerClass = 'warden' | 'hexbinder' | 'gunslinger';

const CLASSES: Record<PlayerClass, { name: string; color: number; speed: number; damage: number; attackRange: number; attackCdMs: number }> = {
  warden: { name: 'Warden', color: 0x4ade80, speed: 185, damage: 7, attackRange: 48, attackCdMs: 320 },
  hexbinder: { name: 'Hexbinder', color: 0xa78bfa, speed: 195, damage: 5, attackRange: 72, attackCdMs: 260 },
  gunslinger: { name: 'Gunslinger', color: 0x60a5fa, speed: 205, damage: 4, attackRange: 90, attackCdMs: 180 },
};

type LootDrop =
  | { kind: 'gold'; amount: number }
  | { kind: 'rune'; amount: number }
  | { kind: 'item'; amount: number; itemId: string };

export class GameScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { w: Phaser.Input.Keyboard.Key; a: Phaser.Input.Keyboard.Key; s: Phaser.Input.Keyboard.Key; d: Phaser.Input.Keyboard.Key };
  private attackKey!: Phaser.Input.Keyboard.Key;

  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private currentClass: PlayerClass = 'warden';

  private hp = 30;
  private hpMax = 30;

  private enemyLootTableId = 'lt_enemy_bandit_t1';
  private itemsById = new Map<string, { id: string; name: string }>();

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
    this.bootstrapData();

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

    // Player (Kenney sprite)
    this.player = this.physics.add.sprite(160, 160, 'kenneySheet', 96);
    this.player.setScale(2);
    this.player.setDamping(true);
    this.player.setDrag(1100, 1100);
    this.player.setMaxVelocity(520, 520);
    this.player.setCollideWorldBounds(true);

    // Shadow
    const shadow = this.add.ellipse(this.player.x, this.player.y + 18, 26, 10, 0x000000, 0.25);
    shadow.setDepth(0);
    this.events.on('postupdate', () => {
      shadow.setPosition(this.player.x, this.player.y + 18);
    });

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

    // Aim direction: mouse if meaningful, otherwise lastFacing.
    const ptr = this.input.activePointer;
    const aim = new Phaser.Math.Vector2(ptr.worldX - this.player.x, ptr.worldY - this.player.y);
    const dir = aim.lengthSq() > 32 ? aim.normalize() : this.lastFacing.clone();
    this.lastFacing.copy(dir);

    if (this.currentClass === 'gunslinger') {
      this.fireGunslingerShot(cls.damage, dir);
      return;
    }

    // Melee / short-range AoE
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

  private fireGunslingerShot(damage: number, dir: Phaser.Math.Vector2): void {

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

      const e = new Enemy(this, x, y, 'kenneySheet', 'ghoul');
      // Pick a Kenney creature-ish frame (placeholder until we import Tiny Creatures)
      e.setFrame(24);
      e.setScale(2);
      e.setTint(0xffffff);
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
    // Spawn loot (data-driven table first, fallback to simple currency)
    const drops = this.rollLootTable(this.enemyLootTableId);
    if (drops.length === 0) {
      const kind: LootKind = Phaser.Math.Between(1, 100) <= 75 ? 'gold' : 'rune';
      const amount = kind === 'gold' ? Phaser.Math.Between(3, 12) : 1;
      this.spawnLoot(e.x, e.y, kind, amount);
    } else {
      for (const d of drops) {
        if (d.kind === 'gold' || d.kind === 'rune') this.spawnLoot(e.x, e.y, d.kind, d.amount);
        if (d.kind === 'item') this.spawnItemLoot(e.x, e.y, d.itemId);
      }
    }

    // Death effect
    const puff = this.add.circle(e.x, e.y, 18, 0xffffff, 0.08).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: puff, scale: 2.1, alpha: 0, duration: 260, onComplete: () => puff.destroy() });

    e.destroy();
  }

  private onPickup(l: Loot): void {
    if (!l.active) return;

    if (l.kind === 'gold') this.inventory.addGold(l.amount);
    if (l.kind === 'rune') this.inventory.addRune(l.amount);
    if (l.kind === 'item' && l.itemId) this.inventory.addItem(l.itemId, l.amount);

    this.hud.setInventory(this.inventory.snapshot());

    const label = l.kind === 'gold'
      ? `+${l.amount}g`
      : l.kind === 'rune'
        ? '+rune'
        : `+${l.itemName ?? l.itemId}`;

    const color = l.kind === 'gold' ? '#fde68a' : l.kind === 'rune' ? '#bfdbfe' : '#e5e7eb';

    const t = this.add.text(l.x, l.y - 8, label, {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif',
      fontSize: '12px',
      color,
    });
    this.tweens.add({ targets: t, y: t.y - 18, alpha: 0, duration: 650, onComplete: () => t.destroy() });

    l.destroy();
  }

  private bootstrapData(): void {
    // Items lookup (for tooltips/pickups)
    for (const it of (itemsData as any).items as Array<{ id: string; name: string }>) {
      this.itemsById.set(it.id, { id: it.id, name: it.name });
    }

    // Apply a real starting class to HP/Inventory (no UI yet; pick Ranger by default)
    const cls = (classesData as any).classes?.find((c: any) => c.id === 'cls_ranger') ?? (classesData as any).classes?.[0];
    if (cls?.startingStats?.maxHealth) {
      this.hpMax = cls.startingStats.maxHealth;
      this.hp = this.hpMax;
    }
    if (Array.isArray(cls?.startingItemIds)) {
      for (const id of cls.startingItemIds) this.inventory.addItem(id, 1);
    }
  }

  private spawnLoot(x: number, y: number, kind: LootKind, amount: number): void {
    const lootTex = kind === 'gold' ? 'lootGold' : 'lootRune';
    const l = new Loot(this, x, y, lootTex, kind, amount);
    l.setDepth(2);
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const v = new Phaser.Math.Vector2(Math.cos(angle), Math.sin(angle)).scale(120);
    (l.body as Phaser.Physics.Arcade.Body).setVelocity(v.x, v.y);
    this.loots.add(l);
  }

  private spawnItemLoot(x: number, y: number, itemId: string): void {
    // For now use rune sprite for items; later replace with real item icons.
    const meta = this.itemsById.get(itemId);
    const l = new Loot(this, x, y, 'lootRune', 'item', 1, { itemId, itemName: meta?.name });
    l.setTint(0xe5e7eb);
    l.setDepth(2);
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const v = new Phaser.Math.Vector2(Math.cos(angle), Math.sin(angle)).scale(120);
    (l.body as Phaser.Physics.Arcade.Body).setVelocity(v.x, v.y);
    this.loots.add(l);
  }

  private rollLootTable(tableId: string): LootDrop[] {
    const tables = (lootData as any).tables as any[];
    const table = tables?.find((t) => t.id === tableId);
    if (!table) return [];

    const rolls = table.rolls?.[0]?.count as [number, number] | undefined;
    const n = rolls ? Phaser.Math.Between(rolls[0], rolls[1]) : 0;
    if (n <= 0) return [];

    const entries = (table.entries as any[]).map((e) => ({ weight: e.weight ?? 0, value: e }));
    const out: LootDrop[] = [];

    for (let i = 0; i < n; i++) {
      const chosen = pickWeighted(entries, () => Math.random());
      if (chosen.type === 'nothing') continue;
      if (chosen.type === 'itemId') {
        const ids: string[] = chosen.itemIds ?? [];
        if (ids.length === 0) continue;
        const itemId = ids[Phaser.Math.Between(0, ids.length - 1)];
        out.push({ kind: 'item', amount: 1, itemId });
        continue;
      }
      if (chosen.type === 'tableRef') {
        const innerId: string | undefined = chosen.tableId;
        if (!innerId) continue;
        out.push(...this.rollLootTable(innerId));
        continue;
      }
    }

    return out;
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
