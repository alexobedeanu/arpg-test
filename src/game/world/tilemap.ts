import Phaser from 'phaser';

export type WorldMap = {
  map: Phaser.Tilemaps.Tilemap;
  layer: Phaser.Tilemaps.TilemapLayer;
  width: number;
  height: number;
};

export function createProceduralTilemap(scene: Phaser.Scene, opts?: { width?: number; height?: number; tileSize?: number }): WorldMap {
  const tileSize = opts?.tileSize ?? 16;
  const width = opts?.width ?? 70;
  const height = opts?.height ?? 42;

  const data: number[][] = [];
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      // Kenney tileset is 12x11 tiles (packed). Indices here are "good enough" defaults.
      const FLOOR_A = 0;
      const FLOOR_B = 1;
      const WALL_A = 36;
      const WALL_B = 37;

      // Border walls
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        row.push(((x + y) % 2 === 0) ? WALL_A : WALL_B);
        continue;
      }

      const r = (x * 928371 + y * 1237) % 97;

      // scattered walls
      if (r < 3) {
        row.push((r % 2 === 0) ? WALL_A : WALL_B);
        continue;
      }

      // floor variation
      row.push(r < 52 ? FLOOR_A : FLOOR_B);
    }
    data.push(row);
  }

  // Create tilemap from array
  const map = scene.make.tilemap({ data, tileWidth: tileSize, tileHeight: tileSize });
  const tileset = map.addTilesetImage('kenneyTiles', 'kenneyTiles', tileSize, tileSize, 0, 0);
  if (!tileset) throw new Error('Failed to create tileset');

  const layer = map.createLayer(0, tileset, 0, 0);
  if (!layer) throw new Error('Failed to create tile layer');

  layer.setCollision([36, 37]);

  return { map, layer, width: width * tileSize, height: height * tileSize };
}
