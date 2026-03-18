import { BlockId } from './blocks'
import { clampHeight, fbm2, rand2i } from './noise'

export type ChunkCoord = { cx: number; cz: number }

type Chunk = {
  cx: number
  cz: number
  data: Uint8Array
  dirty: boolean
}

export class ChunkedWorld {
  readonly chunkSize: number
  readonly height: number
  readonly seed: number

  // terrain params
  readonly baseHeight: number
  readonly heightScale: number
  readonly freq: number
  readonly octaves: number
  readonly lacunarity: number
  readonly persistence: number
  readonly stoneDepth: number
  readonly pondLevel: number

  private chunks = new Map<string, Chunk>()

  constructor(opts: {
    seed: number
    chunkSize: number
    height: number
    baseHeight: number
    heightScale: number
    freq: number
    octaves: number
    lacunarity: number
    persistence: number
    stoneDepth: number
    pondLevel: number
  }) {
    this.seed = opts.seed
    this.chunkSize = opts.chunkSize
    this.height = opts.height
    this.baseHeight = opts.baseHeight
    this.heightScale = opts.heightScale
    this.freq = opts.freq
    this.octaves = opts.octaves
    this.lacunarity = opts.lacunarity
    this.persistence = opts.persistence
    this.stoneDepth = opts.stoneDepth
    this.pondLevel = opts.pondLevel
  }

  key(cx: number, cz: number): string {
    return `${cx},${cz}`
  }

  getChunk(cx: number, cz: number): Chunk {
    const k = this.key(cx, cz)
    const existing = this.chunks.get(k)
    if (existing) return existing

    const chunk: Chunk = {
      cx,
      cz,
      data: new Uint8Array(this.chunkSize * this.height * this.chunkSize),
      dirty: true,
    }
    this.generateChunk(chunk)
    this.chunks.set(k, chunk)
    return chunk
  }

  hasChunk(cx: number, cz: number): boolean {
    return this.chunks.has(this.key(cx, cz))
  }

  markDirty(cx: number, cz: number): void {
    const c = this.chunks.get(this.key(cx, cz))
    if (c) c.dirty = true
  }

  consumeDirty(cx: number, cz: number): boolean {
    const c = this.chunks.get(this.key(cx, cz))
    if (!c) return false
    const was = c.dirty
    c.dirty = false
    return was
  }

  unloadFar(keep: Set<string>): string[] {
    const removed: string[] = []
    for (const k of this.chunks.keys()) {
      if (!keep.has(k)) {
        this.chunks.delete(k)
        removed.push(k)
      }
    }
    return removed
  }

  globalToChunk(x: number, z: number): { cx: number; cz: number; lx: number; lz: number } {
    const cs = this.chunkSize
    const cx = Math.floor(x / cs)
    const cz = Math.floor(z / cs)
    const lx = x - cx * cs
    const lz = z - cz * cs
    return { cx, cz, lx, lz }
  }

  indexLocal(lx: number, y: number, lz: number): number {
    return lx + this.chunkSize * (y + this.height * lz)
  }

  get(x: number, y: number, z: number): BlockId {
    if (y < 0 || y >= this.height) return BlockId.Air
    const { cx, cz, lx, lz } = this.globalToChunk(x, z)
    const c = this.getChunk(cx, cz)
    return c.data[this.indexLocal(lx, y, lz)] as BlockId
  }

  set(x: number, y: number, z: number, id: BlockId): void {
    if (y < 0 || y >= this.height) return
    const { cx, cz, lx, lz } = this.globalToChunk(x, z)
    const c = this.getChunk(cx, cz)
    c.data[this.indexLocal(lx, y, lz)] = id
    c.dirty = true
  }

  // For meshing: local get within a specific chunk (avoids repeated globalToChunk)
  getInChunk(cx: number, cz: number, lx: number, y: number, lz: number): BlockId {
    if (y < 0 || y >= this.height) return BlockId.Air
    if (lx < 0 || lx >= this.chunkSize || lz < 0 || lz >= this.chunkSize) {
      // neighbor chunk lookup
      const gx = cx * this.chunkSize + lx
      const gz = cz * this.chunkSize + lz
      return this.get(gx, y, gz)
    }
    const c = this.getChunk(cx, cz)
    return c.data[this.indexLocal(lx, y, lz)] as BlockId
  }

  getTopSolidY(x: number, z: number): number {
    for (let y = this.height - 1; y >= 0; y--) {
      const id = this.get(x, y, z)
      if (id !== BlockId.Air && id !== BlockId.Water) return y
    }
    return -1
  }

  private generateChunk(chunk: Chunk): void {
    const { cx, cz } = chunk
    const cs = this.chunkSize

    for (let lz = 0; lz < cs; lz++) {
      for (let lx = 0; lx < cs; lx++) {
        const gx = cx * cs + lx
        const gz = cz * cs + lz

        const nx = gx / 512
        const nz = gz / 512

        const e = fbm2(nx, nz, this.seed, this.freq, this.octaves, this.lacunarity, this.persistence)
        let h = clampHeight(
          Math.floor(this.baseHeight + (e - 0.5) * 2 * this.heightScale),
          2,
          this.height - 3,
        )

        // --- ponds: carve local basins, then fill to pondLevel ---
        // Choose a few pond centers deterministically on a coarse grid
        const cellSize = 32
        const cellX = Math.floor(gx / cellSize)
        const cellZ = Math.floor(gz / cellSize)

        let pondInfluence = 0
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            const pxCell = cellX + dx
            const pzCell = cellZ + dz
            const r = rand2i(pxCell, pzCell, this.seed + 9001)
            if (r > 0.22) continue // ~22% of cells get a pond candidate

            const centerX = pxCell * cellSize + Math.floor(rand2i(pxCell, pzCell, this.seed + 7) * cellSize)
            const centerZ = pzCell * cellSize + Math.floor(rand2i(pxCell, pzCell, this.seed + 11) * cellSize)
            const radius = 6 + Math.floor(rand2i(pxCell, pzCell, this.seed + 13) * 8) // 6..13

            const dxp = gx - centerX
            const dzp = gz - centerZ
            const dist = Math.sqrt(dxp * dxp + dzp * dzp)
            if (dist > radius) continue

            const t = 1 - dist / radius
            pondInfluence = Math.max(pondInfluence, t)
          }
        }

        if (pondInfluence > 0) {
          const carve = Math.floor(pondInfluence * 6) // up to 6 blocks down
          h = clampHeight(h - carve, 1, this.height - 3)
        }

        // write column
        for (let y = 0; y <= h; y++) {
          const idx = this.indexLocal(lx, y, lz)
          if (y === h) {
            // sand near pond edges (only if pond exists nearby)
            if (pondInfluence > 0.2 && Math.abs(h - this.pondLevel) <= 1) {
              chunk.data[idx] = BlockId.Sand
            } else {
              chunk.data[idx] = BlockId.Grass
            }
          } else if (h - y >= this.stoneDepth) {
            chunk.data[idx] = BlockId.Stone
          } else {
            chunk.data[idx] = BlockId.Dirt
          }
        }

        // fill pond water only when basin is below pondLevel and pondInfluence is present
        if (pondInfluence > 0.25 && h < this.pondLevel) {
          const maxY = Math.min(this.pondLevel, this.height - 2)
          for (let y = h + 1; y <= maxY; y++) {
            const idx = this.indexLocal(lx, y, lz)
            if (chunk.data[idx] === BlockId.Air) {
              chunk.data[idx] = BlockId.Water
            }
          }
        }
      }
    }

    // Trees: on grass above ponds
    for (let lz = 2; lz < cs - 2; lz++) {
      for (let lx = 2; lx < cs - 2; lx++) {
        const gx = cx * cs + lx
        const gz = cz * cs + lz
        const r = rand2i(gx, gz, this.seed + 4242)
        if (r > 0.012) continue

        // find top
        let topY = -1
        for (let y = this.height - 3; y >= 1; y--) {
          const id = chunk.data[this.indexLocal(lx, y, lz)] as BlockId
          if (id !== BlockId.Air && id !== BlockId.Water) {
            topY = y
            break
          }
        }
        if (topY < 1) continue
        const topId = chunk.data[this.indexLocal(lx, topY, lz)] as BlockId
        if (topId !== BlockId.Grass) continue
        if (topY <= this.pondLevel + 2) continue

        const trunkH = 4 + Math.floor(r * 1000) % 3
        for (let t = 1; t <= trunkH; t++) {
          const y = topY + t
          if (y >= this.height - 2) break
          chunk.data[this.indexLocal(lx, y, lz)] = BlockId.Wood
        }
        const leafCenterY = topY + trunkH
        for (let dz = -2; dz <= 2; dz++) {
          for (let dx = -2; dx <= 2; dx++) {
            for (let dy = -2; dy <= 1; dy++) {
              const dist = Math.abs(dx) + Math.abs(dz) + Math.max(0, dy + 1)
              if (dist > 4) continue
              const x = lx + dx
              const z = lz + dz
              const y = leafCenterY + dy
              if (x < 0 || x >= cs || z < 0 || z >= cs || y < 0 || y >= this.height) continue
              const idx = this.indexLocal(x, y, z)
              if (chunk.data[idx] === BlockId.Air) chunk.data[idx] = BlockId.Leaves
            }
          }
        }
      }
    }
  }
}

