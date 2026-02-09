import Phaser from 'phaser';

export type ProjectileOpts = {
  dir: Phaser.Math.Vector2;
  speed: number;
  damage: number;
  lifeMs: number;
};

/**
 * Simple hitscan-like bullet using Arcade physics.
 * - constant velocity
 * - lifetime-based cleanup
 * - intended to be used via Scene physics overlap/collider callbacks
 */
export class Projectile extends Phaser.Physics.Arcade.Image {
  public damage: number;

  private bornAt = 0;
  private lifeMs = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, opts: ProjectileOpts) {
    super(scene, x, y, texture);

    this.damage = opts.damage;
    this.lifeMs = opts.lifeMs;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);

    // Small, fast-moving projectile: use a slightly larger body for reliability.
    // Texture is ~10x4.
    body.setCircle(4, 1, 0);

    const dir = opts.dir.clone();
    if (dir.lengthSq() < 0.0001) dir.set(1, 0);
    dir.normalize();

    body.setVelocity(dir.x * opts.speed, dir.y * opts.speed);

    this.setDepth(3);
    this.setRotation(Math.atan2(dir.y, dir.x));

    this.bornAt = scene.time.now;
  }

  update(time: number, _delta: number): void {
    if (time - this.bornAt > this.lifeMs) {
      this.destroy();
      return;
    }

    const body = this.body as Phaser.Physics.Arcade.Body;
    const v = body.velocity;
    if (v.lengthSq() > 0.01) {
      this.setRotation(Math.atan2(v.y, v.x));
    }
  }
}
