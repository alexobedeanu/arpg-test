import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    // Kenney Tiny Dungeon (CC0)
    const url = '/assets/kenney/tiny-dungeon/Tilemap/tilemap_packed.png';
    this.load.image('kenneyTilesImg', url);
    this.load.spritesheet('kenneySheet', url, { frameWidth: 16, frameHeight: 16 });
  }

  create(): void {
    this.scene.start('game');
  }
}
