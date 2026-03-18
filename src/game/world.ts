import { BlockId } from './blocks'
import { clampHeight, fbm2 } from './noise'

export class World {
  readonly sizeX: number
  readonly sizeY: number
  readonly sizeZ: number
  private data: Uint8Array

  constructor(sizeX: number, sizeY: number, sizeZ: number) {
    this.sizeX = sizeX
    this.sizeY = sizeY
    this.sizeZ = sizeZ
    this.data = new Uint8Array(sizeX * sizeY * sizeZ)
  }

  index(x: number, y: number, z: number): number {
    return x + this.sizeX * (y + this.sizeY * z)
  }

  inBounds(x: number, y: number, z: number): boolean {
    return (
      x >= 0 &&
      x < this.sizeX &&
      y >= 0 &&
      y < this.sizeY &&
      z >= 0 &&
      z < this.sizeZ
    )
  }

  get(x: number, y: number, z: number): BlockId {
    if (!this.inBounds(x, y, z)) return BlockId.Air
    return this.data[this.index(x, y, z)] as BlockId
  }

  set(x: number, y: number, z: number, id: BlockId): void {
    if (!this.inBounds(x, y, z)) return
    this.data[this.index(x, y, z)] = id
  }

  fill(id: BlockId): void {
    this.data.fill(id)
  }

  fillFlat(opts: {
    groundY: number
    groundBlock: BlockId
    underBlock: BlockId
    underDepth: number
  }): void {
    const { groundY, groundBlock, underBlock, underDepth } = opts
    this.fill(BlockId.Air)

    for (let z = 0; z < this.sizeZ; z++) {
      for (let x = 0; x < this.sizeX; x++) {
        if (this.inBounds(x, groundY, z)) {
          this.set(x, groundY, z, groundBlock)
        }
        for (let d = 1; d <= underDepth; d++) {
          const y = groundY - d
          if (this.inBounds(x, y, z)) {
            this.set(x, y, z, underBlock)
          }
        }
      }
    }
  }

  fillTerrain(opts: {
    baseHeight: number
    amplitude: number
    freq: number
    groundBlock: BlockId
    underBlock: BlockId
    stoneBlock: BlockId
    stoneDepth: number
  }): void {
    const {
      baseHeight,
      amplitude,
      freq,
      groundBlock,
      underBlock,
      stoneBlock,
      stoneDepth,
    } = opts

    this.fill(BlockId.Air)

    for (let z = 0; z < this.sizeZ; z++) {
      for (let x = 0; x < this.sizeX; x++) {
        const hRaw =
          baseHeight +
          Math.sin((x + 13.37) * freq) * amplitude +
          Math.cos((z - 4.2) * freq) * amplitude * 0.85 +
          Math.sin((x + z) * freq * 0.7) * amplitude * 0.35

        const h = Math.max(1, Math.min(this.sizeY - 2, Math.floor(hRaw)))

        for (let y = 0; y <= h; y++) {
          // top
          if (y === h) {
            this.set(x, y, z, groundBlock)
            continue
          }

          // deeper layers
          if (h - y >= stoneDepth) {
            this.set(x, y, z, stoneBlock)
          } else {
            this.set(x, y, z, underBlock)
          }
        }
      }
    }
  }

  fillTerrainNoise(opts: {
    seed: number
    baseHeight: number
    heightScale: number
    freq: number
    octaves: number
    lacunarity: number
    persistence: number
    groundBlock: BlockId
    underBlock: BlockId
    stoneBlock: BlockId
    stoneDepth: number
  }): void {
    const {
      seed,
      baseHeight,
      heightScale,
      freq,
      octaves,
      lacunarity,
      persistence,
      groundBlock,
      underBlock,
      stoneBlock,
      stoneDepth,
    } = opts

    this.fill(BlockId.Air)

    for (let z = 0; z < this.sizeZ; z++) {
      for (let x = 0; x < this.sizeX; x++) {
        const nx = x / this.sizeX
        const nz = z / this.sizeZ
        const e = fbm2(nx, nz, seed, freq, octaves, lacunarity, persistence) // [0..1]ish
        const h = clampHeight(
          Math.floor(baseHeight + (e - 0.5) * 2 * heightScale),
          1,
          this.sizeY - 2,
        )

        for (let y = 0; y <= h; y++) {
          if (y === h) {
            this.set(x, y, z, groundBlock)
            continue
          }
          if (h - y >= stoneDepth) {
            this.set(x, y, z, stoneBlock)
          } else {
            this.set(x, y, z, underBlock)
          }
        }
      }
    }
  }

  getTopSolidY(x: number, z: number): number {
    for (let y = this.sizeY - 1; y >= 0; y--) {
      const id = this.get(x, y, z)
      if (id !== BlockId.Air) return y
    }
    return -1
  }
}
