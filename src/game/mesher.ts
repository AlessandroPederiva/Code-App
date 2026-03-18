import * as THREE from 'three'
import type { BlockDef, BlockId } from './blocks'
import type { World } from './world'

export type TriangleMeta = {
  blockX: number
  blockY: number
  blockZ: number
  normalX: number
  normalY: number
  normalZ: number
}

const FACE_DEFS = [
  // +X
  {
    n: [1, 0, 0] as const,
    corners: [
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
      [1, 0, 1],
    ] as const,
    neighbor: [1, 0, 0] as const,
  },
  // -X
  {
    n: [-1, 0, 0] as const,
    corners: [
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
      [0, 0, 0],
    ] as const,
    neighbor: [-1, 0, 0] as const,
  },
  // +Y
  {
    n: [0, 1, 0] as const,
    corners: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ] as const,
    neighbor: [0, 1, 0] as const,
  },
  // -Y
  {
    n: [0, -1, 0] as const,
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ] as const,
    neighbor: [0, -1, 0] as const,
  },
  // +Z
  {
    n: [0, 0, 1] as const,
    corners: [
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
      [0, 0, 1],
    ] as const,
    neighbor: [0, 0, 1] as const,
  },
  // -Z
  {
    n: [0, 0, -1] as const,
    corners: [
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
      [1, 0, 0],
    ] as const,
    neighbor: [0, 0, -1] as const,
  },
] as const

export function buildChunkGeometry(
  world: World,
  blockDefs: Record<BlockId, BlockDef>,
): {
  opaque: { geometry: THREE.BufferGeometry; triangles: TriangleMeta[] }
  transparent: { geometry: THREE.BufferGeometry; triangles: TriangleMeta[] }
} {
  const opaque = buildByFilter(
    (x, y, z) => world.get(x, y, z),
    world.sizeX,
    world.sizeY,
    world.sizeZ,
    0,
    0,
    0,
    blockDefs,
    (id) => !blockDefs[id]?.transparent,
  )
  const transparent = buildByFilter(
    (x, y, z) => world.get(x, y, z),
    world.sizeX,
    world.sizeY,
    world.sizeZ,
    0,
    0,
    0,
    blockDefs,
    (id) => !!blockDefs[id]?.transparent,
  )
  return { opaque, transparent }
}

export function buildRegionGeometry(opts: {
  getBlock: (x: number, y: number, z: number) => BlockId
  sizeX: number
  sizeY: number
  sizeZ: number
  originX: number
  originY: number
  originZ: number
  blockDefs: Record<BlockId, BlockDef>
}): {
  opaque: { geometry: THREE.BufferGeometry; triangles: TriangleMeta[] }
  transparent: { geometry: THREE.BufferGeometry; triangles: TriangleMeta[] }
} {
  const { getBlock, sizeX, sizeY, sizeZ, originX, originY, originZ, blockDefs } = opts
  const opaque = buildByFilter(
    getBlock,
    sizeX,
    sizeY,
    sizeZ,
    originX,
    originY,
    originZ,
    blockDefs,
    (id) => !blockDefs[id]?.transparent,
  )
  const transparent = buildByFilter(
    getBlock,
    sizeX,
    sizeY,
    sizeZ,
    originX,
    originY,
    originZ,
    blockDefs,
    (id) => !!blockDefs[id]?.transparent,
  )
  return { opaque, transparent }
}

function buildByFilter(
  getBlock: (x: number, y: number, z: number) => BlockId,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  originX: number,
  originY: number,
  originZ: number,
  blockDefs: Record<BlockId, BlockDef>,
  include: (id: BlockId) => boolean,
): { geometry: THREE.BufferGeometry; triangles: TriangleMeta[] } {
  const positions: number[] = []
  const normals: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  const triangles: TriangleMeta[] = []

  let vertexCount = 0
  let triangleCount = 0

  const pushVertex = (
    x: number,
    y: number,
    z: number,
    nx: number,
    ny: number,
    nz: number,
    color: THREE.Color,
  ) => {
    positions.push(x, y, z)
    normals.push(nx, ny, nz)
    colors.push(color.r, color.g, color.b)
    vertexCount++
  }

  const pushFaceMeta = (
    bx: number,
    by: number,
    bz: number,
    nx: number,
    ny: number,
    nz: number,
  ) => {
    // 2 triangles per face
    triangles.push(
      { blockX: bx, blockY: by, blockZ: bz, normalX: nx, normalY: ny, normalZ: nz },
      { blockX: bx, blockY: by, blockZ: bz, normalX: nx, normalY: ny, normalZ: nz },
    )
    triangleCount += 2
  }

  const color = new THREE.Color()

  for (let z = 0; z < sizeZ; z++) {
    for (let y = 0; y < sizeY; y++) {
      for (let x = 0; x < sizeX; x++) {
        const gx = originX + x
        const gy = originY + y
        const gz = originZ + z
        const id = getBlock(gx, gy, gz)
        if (id === (0 as BlockId)) continue
        if (!include(id)) continue

        const def = blockDefs[id]
        color.setHex(def.color)

        for (const face of FACE_DEFS) {
          const nx = face.n[0]
          const ny = face.n[1]
          const nz = face.n[2]
          const ax = face.neighbor[0]
          const ay = face.neighbor[1]
          const az = face.neighbor[2]

          const neighborId = getBlock(gx + ax, gy + ay, gz + az)
          if (neighborId === id) continue
          if (neighborId !== (0 as BlockId)) {
            const nDef = blockDefs[neighborId]
            if (nDef?.occludes) continue
          }

          const baseIndex = vertexCount

          // 4 corners -> 4 vertices (quad)
          for (const c of face.corners) {
            pushVertex(gx + c[0], gy + c[1], gz + c[2], nx, ny, nz, color)
          }

          // Two triangles: (0,1,2) (0,2,3)
          indices.push(
            baseIndex + 0,
            baseIndex + 1,
            baseIndex + 2,
            baseIndex + 0,
            baseIndex + 2,
            baseIndex + 3,
          )

          pushFaceMeta(gx, gy, gz, nx, ny, nz)
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)

  // sanity: indices / 3 equals triangleCount
  // (left as runtime invariant; no throwing in prod)
  if (process.env.NODE_ENV !== 'production') {
    const actualTriangles = Math.floor(indices.length / 3)
    if (actualTriangles !== triangleCount) {
      // eslint-disable-next-line no-console
      console.warn('Triangle meta mismatch', { actualTriangles, triangleCount })
    }
  }

  return { geometry, triangles }
}

