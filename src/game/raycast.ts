import * as THREE from 'three'
import type { TriangleMeta } from './mesher'

export type BlockTarget = {
  blockX: number
  blockY: number
  blockZ: number
  normalX: number
  normalY: number
  normalZ: number
  hitPoint: THREE.Vector3
}

export function pickBlockTarget(opts: {
  raycaster: THREE.Raycaster
  camera: THREE.Camera
  object: THREE.Object3D
  triangles: TriangleMeta[]
  maxDistance: number
}): BlockTarget | null {
  const { raycaster, camera, object, triangles, maxDistance } = opts
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera)
  raycaster.far = maxDistance

  const hits = raycaster.intersectObject(object, false)
  const hit = hits[0]
  if (!hit) return null
  if (hit.faceIndex == null) return null

  const meta = triangles[hit.faceIndex]
  if (!meta) return null

  return {
    blockX: meta.blockX,
    blockY: meta.blockY,
    blockZ: meta.blockZ,
    normalX: meta.normalX,
    normalY: meta.normalY,
    normalZ: meta.normalZ,
    hitPoint: hit.point.clone(),
  }
}

