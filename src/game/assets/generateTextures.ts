import Phaser from 'phaser';

export function ensureTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists('player')) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.setVisible(false);

    // Player: outlined, shaded
    g.fillStyle(0x0b0f14, 1);
    g.fillRoundedRect(1, 1, 22, 26, 8);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(0, 0, 22, 26, 8);
    g.fillStyle(0xffffff, 0.18);
    g.fillRoundedRect(3, 3, 10, 6, 4);
    g.fillStyle(0x0b0f14, 0.22);
    g.fillEllipse(11, 23, 14, 6);
    g.generateTexture('player', 23, 27);
    g.clear();

    // Enemy: outlined + "face" + spikes
    g.fillStyle(0x0b0f14, 1);
    g.fillCircle(15, 15, 14);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(14, 14, 13);
    g.fillStyle(0x0b0f14, 0.20);
    g.fillCircle(10, 12, 3);
    g.fillCircle(18, 12, 3);
    g.fillStyle(0x0b0f14, 0.10);
    g.fillTriangle(6, 20, 22, 20, 14, 27);
    g.fillStyle(0xffffff, 0.08);
    g.fillTriangle(4, 6, 8, 2, 10, 7);
    g.fillTriangle(20, 6, 24, 2, 24, 8);
    g.generateTexture('enemy', 30, 30);
    g.clear();

    // Loot: gold coin
    g.fillStyle(0xffd54a, 1);
    g.fillCircle(10, 10, 9);
    g.lineStyle(2, 0xfff1a8, 1);
    g.strokeCircle(10, 10, 8);
    g.lineStyle(2, 0xb45309, 0.35);
    g.strokeCircle(10, 10, 6);
    g.generateTexture('lootGold', 20, 20);
    g.clear();

    // Loot: rune
    g.fillStyle(0x93c5fd, 1);
    g.fillRoundedRect(0, 0, 18, 18, 4);
    g.lineStyle(2, 0x1d4ed8, 0.6);
    g.strokeRoundedRect(1, 1, 16, 16, 4);
    g.lineStyle(2, 0xeff6ff, 0.8);
    g.strokeLineShape(new Phaser.Geom.Line(5, 12, 13, 6));
    g.generateTexture('lootRune', 18, 18);
    g.clear();

    // Bullet
    g.fillStyle(0x0b0f14, 1);
    g.fillRoundedRect(0, 0, 10, 4, 2);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(1, 1, 8, 2, 1);
    g.fillStyle(0xffffff, 0.35);
    g.fillRoundedRect(6, 1, 3, 1, 1);
    g.generateTexture('bullet', 10, 4);
    g.clear();

    g.destroy();
  }

  // Tiles are now loaded from Kenney (preloaded in BootScene).
}
