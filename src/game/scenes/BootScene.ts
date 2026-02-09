import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    // Kenney Tiny Dungeon (CC0)
    this.load.image('kenneyTiles', '/assets/kenney/tiny-dungeon/Tilemap/tilemap_packed.png');
  }

  create(): void {
    this.scene.start('game');
  }
}
