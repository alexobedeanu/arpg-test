import Phaser from 'phaser';
import { Enemy } from '../entities/Enemy';

export type SpawnDirectorConfig = {
  hardCapAlive: number;
  softTargetAlive: number;

  maxAggressors: number; // (enforced later by AI)

  packMin: number;
  packMax: number;
  packSpawnSpanMs: number; // time to spread spawns inside a pack
  breatherMs: number;

  ringMin: number;
  ringMax: number;
  retryCandidates: number;

  retryDelayMs: number;
  maxConsecutiveFailures: number;
};

type SpawnHooks = {
  getAliveCount: () => number;
  spawnEnemyAt: (x: number, y: number) => Enemy | null;
  isSpawnValid: (x: number, y: number) => boolean;
  randInt: (min: number, max: number) => number;
  randFloat: (min: number, max: number) => number;
  now: () => number;
};

export class SpawnDirector {
  private cfg: SpawnDirectorConfig;
  private hooks: SpawnHooks;
  private player: Phaser.GameObjects.Components.Transform;

  private nextPackAt = 0;
  private breatherUntil = 0;

  private remainingInPack = 0;
  private nextSpawnInPackAt = 0;
  private consecutiveFailures = 0;

  constructor(cfg: SpawnDirectorConfig, hooks: SpawnHooks, player: Phaser.GameObjects.Components.Transform) {
    this.cfg = cfg;
    this.hooks = hooks;
    this.player = player;
    this.nextPackAt = hooks.now() + 800;
  }

  update(): void {
    const now = this.hooks.now();

    const alive = this.hooks.getAliveCount();
    if (alive >= this.cfg.hardCapAlive) return;

    if (now < this.breatherUntil) return;

    // Spawn inside an active pack
    if (this.remainingInPack > 0) {
      if (now < this.nextSpawnInPackAt) return;
      this.spawnOneFromRing();
      return;
    }

    // Start a new pack if below target and pack timer allows
    if (alive < this.cfg.softTargetAlive && now >= this.nextPackAt) {
      const packCount = this.hooks.randInt(this.cfg.packMin, this.cfg.packMax);
      this.remainingInPack = packCount;
      this.consecutiveFailures = 0;
      this.nextSpawnInPackAt = now;
    }
  }

  private spawnOneFromRing(): void {
    const now = this.hooks.now();

    const packCount = Math.max(1, this.remainingInPack);
    const step = Math.max(120, Math.floor(this.cfg.packSpawnSpanMs / packCount));

    const pos = this.pickValidSpawn();
    if (!pos) {
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= this.cfg.maxConsecutiveFailures) {
        // End pack early to avoid infinite retries
        this.remainingInPack = 0;
        this.enterBreather(now);
        return;
      }
      this.nextSpawnInPackAt = now + this.cfg.retryDelayMs;
      return;
    }

    const spawned = this.hooks.spawnEnemyAt(pos.x, pos.y);
    if (!spawned) {
      this.nextSpawnInPackAt = now + this.cfg.retryDelayMs;
      return;
    }

    this.consecutiveFailures = 0;
    this.remainingInPack -= 1;
    this.nextSpawnInPackAt = now + step;

    if (this.remainingInPack <= 0) {
      this.enterBreather(now);
    }
  }

  private enterBreather(now: number): void {
    this.breatherUntil = now + this.cfg.breatherMs;
    this.nextPackAt = this.breatherUntil + this.hooks.randFloat(0, 1500);
  }

  private pickValidSpawn(): { x: number; y: number } | null {
    const px = this.player.x;
    const py = this.player.y;

    for (let i = 0; i < this.cfg.retryCandidates; i++) {
      const ang = this.hooks.randFloat(0, Math.PI * 2);
      const r = this.hooks.randFloat(this.cfg.ringMin, this.cfg.ringMax);
      const x = px + Math.cos(ang) * r;
      const y = py + Math.sin(ang) * r;

      if (!this.hooks.isSpawnValid(x, y)) continue;
      return { x, y };
    }

    return null;
  }
}
