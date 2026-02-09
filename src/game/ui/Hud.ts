import Phaser from 'phaser';
import type { InventoryState } from '../systems/Inventory';

export class Hud {
  private classText: Phaser.GameObjects.Text;
  private hpText: Phaser.GameObjects.Text;
  private invText: Phaser.GameObjects.Text;
  private helpText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {

    const baseStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif',
      fontSize: '13px',
      color: '#e5e7eb',
    };

    this.classText = scene.add.text(16, 14, '', baseStyle).setScrollFactor(0);
    this.hpText = scene.add.text(16, 34, '', baseStyle).setScrollFactor(0);
    this.invText = scene.add.text(16, 54, '', baseStyle).setScrollFactor(0);

    this.helpText = scene.add.text(16, 78, 'WASD/Arrows move • Click/Space attack • 1/2/3 class', {
      ...baseStyle,
      fontSize: '12px',
      color: '#94a3b8',
    }).setScrollFactor(0);
  }

  setClass(name: string): void {
    this.classText.setText(`Class: ${name}`);
  }

  setHP(hp: number, max: number): void {
    this.hpText.setText(`HP: ${hp}/${max}`);
  }

  setInventory(inv: InventoryState): void {
    this.invText.setText(`Loot:  🪙 ${inv.gold}   ◇ ${inv.runes}`);
  }

  destroy(): void {
    this.classText.destroy();
    this.hpText.destroy();
    this.invText.destroy();
    this.helpText.destroy();
  }
}
