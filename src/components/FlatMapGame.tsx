import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import '../styles/FlatMapGame.css'
import { BlockId, BLOCKS, DEFAULT_HOTBAR, isSolidBlock } from '../game/blocks'
import { ChunkedWorld } from '../game/chunkedWorld'
import { buildRegionGeometry, type TriangleMeta } from '../game/mesher.ts'
import { pickBlockTarget } from '../game/raycast.ts'

export function FlatMapGame() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [selectedSlot, setSelectedSlot] = useState(0)
  const hotbar = useMemo(() => DEFAULT_HOTBAR, [])
  const selectedBlock: BlockId = hotbar[Math.max(0, Math.min(8, selectedSlot))]
  const selectedBlockRef = useRef<BlockId>(selectedBlock)
  selectedBlockRef.current = selectedBlock

  useEffect(() => {
    if (!containerRef.current) return

    const containerEl = containerRef.current

    // === SCENE SETUP ===
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x87ceeb) // Sky blue

    const width = window.innerWidth
    const height = window.innerHeight

    // Camera prima persona
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 2000)
    camera.position.set(16, 2.6, 16) // start near center

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    containerEl.appendChild(renderer.domElement)

    // === LIGHTING ===
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
    directionalLight.position.set(10, 10, 5)
    scene.add(directionalLight)
    scene.add(new THREE.AmbientLight(0xffffff, 0.5))

    // === CHUNKED WORLD (bigger map) ===
    const seed = 1337
    const world = new ChunkedWorld({
      seed,
      chunkSize: 16,
      height: 64,
      baseHeight: 26,
      heightScale: 18,
      freq: 2.2,
      octaves: 4,
      lacunarity: 2,
      persistence: 0.5,
      stoneDepth: 8,
      pondLevel: 22,
    })

    // === CHUNK MESH (single chunk for MVP) ===
    const chunkMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
    })
    const waterMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.35,
      metalness: 0,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    })
    type ChunkRender = {
      cx: number
      cz: number
      opaqueMesh: THREE.Mesh
      waterMesh: THREE.Mesh
      triangleMetaOpaque: TriangleMeta[]
      triangleMetaWater: TriangleMeta[]
    }
    const chunkRenders = new Map<string, ChunkRender>()

    const ensureChunkRender = (cx: number, cz: number) => {
      const key = `${cx},${cz}`
      const existing = chunkRenders.get(key)
      if (existing) return existing

      const opaque = new THREE.Mesh(new THREE.BufferGeometry(), chunkMaterial)
      const water = new THREE.Mesh(new THREE.BufferGeometry(), waterMaterial)
      water.renderOrder = 1
      scene.add(opaque)
      scene.add(water)

      const cr: ChunkRender = {
        cx,
        cz,
        opaqueMesh: opaque,
        waterMesh: water,
        triangleMetaOpaque: [],
        triangleMetaWater: [],
      }
      chunkRenders.set(key, cr)
      return cr
    }

    const rebuildChunk = (cx: number, cz: number) => {
      // ensure chunk exists
      world.getChunk(cx, cz)
      const cr = ensureChunkRender(cx, cz)

      const originX = cx * world.chunkSize
      const originZ = cz * world.chunkSize
      const built = buildRegionGeometry({
        getBlock: (x, y, z) => world.get(x, y, z),
        sizeX: world.chunkSize,
        sizeY: world.height,
        sizeZ: world.chunkSize,
        originX,
        originY: 0,
        originZ,
        blockDefs: BLOCKS,
      })

      cr.triangleMetaOpaque = built.opaque.triangles
      cr.triangleMetaWater = built.transparent.triangles

      cr.opaqueMesh.geometry.dispose()
      cr.waterMesh.geometry.dispose()
      cr.opaqueMesh.geometry = built.opaque.geometry
      cr.waterMesh.geometry = built.transparent.geometry
      cr.opaqueMesh.geometry.computeBoundingSphere()
      cr.waterMesh.geometry.computeBoundingSphere()
    }

    const chunkRadius = 2
    const updateActiveChunks = () => {
      const pcx = Math.floor(playerPos.x / world.chunkSize)
      const pcz = Math.floor(playerPos.z / world.chunkSize)

      const keep = new Set<string>()
      for (let dz = -chunkRadius; dz <= chunkRadius; dz++) {
        for (let dx = -chunkRadius; dx <= chunkRadius; dx++) {
          const cx = pcx + dx
          const cz = pcz + dz
          const k = `${cx},${cz}`
          keep.add(k)
          world.getChunk(cx, cz)
          const cr = ensureChunkRender(cx, cz)
          if (world.consumeDirty(cx, cz)) {
            rebuildChunk(cx, cz)
          } else if (cr.opaqueMesh.geometry.getAttribute('position') == null) {
            rebuildChunk(cx, cz)
          }
        }
      }

      for (const [k, cr] of chunkRenders.entries()) {
        if (keep.has(k)) continue
        scene.remove(cr.opaqueMesh)
        scene.remove(cr.waterMesh)
        cr.opaqueMesh.geometry.dispose()
        cr.waterMesh.geometry.dispose()
        chunkRenders.delete(k)
      }
      world.unloadFar(keep)
    }

    // === SAVE/LOAD (simple edits log; global coords) ===
    const SAVE_KEY = 'voxel_world_edits_v1'
    const loadEdits = () => {
      try {
        const raw = localStorage.getItem(SAVE_KEY)
        if (!raw) return
        const parsed = JSON.parse(raw) as Array<{
          x: number
          y: number
          z: number
          id: number
        }>
        for (const e of parsed) world.set(e.x, e.y, e.z, e.id as BlockId)
      } catch {
        // ignore
      }
    }
    const saveEditsRef = { current: [] as Array<{ x: number; y: number; z: number; id: BlockId }> }
    const persistEdits = () => {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(saveEditsRef.current))
      } catch {
        // ignore
      }
    }

    loadEdits()

    // === TARGET HIGHLIGHT ===
    const raycaster = new THREE.Raycaster()
    const highlightMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
    })
    const highlightGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1))
    const highlight = new THREE.LineSegments(highlightGeometry, highlightMaterial)
    highlight.visible = false
    scene.add(highlight)

    // === PLAYER POSITION (feet position in world units) ===
    const playerPos = new THREE.Vector3(8, 55, 8)
    const eyeHeight = 1.6

    // === JUMP / GRAVITY ===
    let verticalVelocity = 0
    const gravity = 0.012
    const jumpVelocity = 0.22
    const playerRadius = 0.32
    const playerHeight = 1.8

    const aabbOverlapsSolid = (x: number, y: number, z: number) => {
      const minX = x - playerRadius
      const maxX = x + playerRadius
      const minY = y
      const maxY = y + playerHeight
      const minZ = z - playerRadius
      const maxZ = z + playerRadius

      const x0 = Math.floor(minX)
      const x1 = Math.floor(maxX)
      const y0 = Math.floor(minY)
      const y1 = Math.floor(maxY)
      const z0 = Math.floor(minZ)
      const z1 = Math.floor(maxZ)

      for (let bz = z0; bz <= z1; bz++) {
        for (let by = y0; by <= y1; by++) {
          for (let bx = x0; bx <= x1; bx++) {
            if (isSolidBlock(world.get(bx, by, bz))) return true
          }
        }
      }
      return false
    }

    const isOnGround = () => {
      const epsilon = 0.05
      return aabbOverlapsSolid(playerPos.x, playerPos.y - epsilon, playerPos.z)
    }

    // If we spawned inside blocks, move up a bit.
    for (let i = 0; i < 20; i++) {
      if (!aabbOverlapsSolid(playerPos.x, playerPos.y, playerPos.z)) break
      playerPos.y += 1
    }

    // === CONTROLLI TASTIERA ===
    const keys: Record<string, boolean> = {}

    const handleKeyDown = (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = true

      // Hotbar 1-9
      if (e.code.startsWith('Digit')) {
        const n = Number(e.code.replace('Digit', ''))
        if (Number.isFinite(n) && n >= 1 && n <= 9) {
          setSelectedSlot(n - 1)
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = false
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    containerEl.addEventListener('keydown', handleKeyDown)
    containerEl.addEventListener('keyup', handleKeyUp)

    // === CONTROLLI MOUSE ===
    let isPointerLocked = false
    let euler = new THREE.Euler(0, 0, 0, 'YXZ')
    const PI_2 = Math.PI / 2

    const onMouseMove = (e: MouseEvent) => {
      if (!isPointerLocked) return

      const movementX = e.movementX || 0
      const movementY = e.movementY || 0

      euler.setFromQuaternion(camera.quaternion)
      euler.y -= movementX * 0.002
      euler.x -= movementY * 0.002
      euler.x = Math.max(-PI_2, Math.min(PI_2, euler.x))
      camera.quaternion.setFromEuler(euler)
    }

    const onPointerLockChange = () => {
      isPointerLocked = document.pointerLockElement === renderer.domElement
    }

    const onPointerLockError = () => {
      console.error('Pointer lock failed')
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('pointerlockchange', onPointerLockChange)
    document.addEventListener('pointerlockerror', onPointerLockError)

    const requestPointerLock = () => {
      // In some embeds the window won't receive key events unless focused.
      containerEl.focus()
      if (document.pointerLockElement !== renderer.domElement) {
        renderer.domElement.requestPointerLock()
      }
    }

    // Click/tap anywhere in the game area to lock pointer
    containerEl.addEventListener('pointerdown', requestPointerLock)

    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault()
    }
    containerEl.addEventListener('contextmenu', preventContextMenu)

    // === MOVIMENTO ===
    const moveSpeed = 0.15
    const runMultiplier = 2
    const getTarget = () => {
      let best: ReturnType<typeof pickBlockTarget> = null
      let bestDist = Infinity

      for (const cr of chunkRenders.values()) {
        const a = pickBlockTarget({
          raycaster,
          camera,
          object: cr.opaqueMesh,
          triangles: cr.triangleMetaOpaque,
          maxDistance: 6,
        })
        if (a) {
          const d = a.hitPoint.distanceTo(camera.position)
          if (d < bestDist) {
            best = a
            bestDist = d
          }
        }

        const b = pickBlockTarget({
          raycaster,
          camera,
          object: cr.waterMesh,
          triangles: cr.triangleMetaWater,
          maxDistance: 6,
        })
        if (b) {
          const d = b.hitPoint.distanceTo(camera.position)
          if (d < bestDist) {
            best = b
            bestDist = d
          }
        }
      }

      return best
    }

    const canPlaceAt = (x: number, y: number, z: number) => {
      if (isSolidBlock(world.get(x, y, z))) return false

      // prevent placing inside player AABB
      const centerX = x + 0.5
      const centerY = y + 0.5
      const centerZ = z + 0.5
      const closestX = Math.max(
        playerPos.x - playerRadius,
        Math.min(centerX, playerPos.x + playerRadius),
      )
      const closestY = Math.max(playerPos.y, Math.min(centerY, playerPos.y + playerHeight))
      const closestZ = Math.max(
        playerPos.z - playerRadius,
        Math.min(centerZ, playerPos.z + playerRadius),
      )
      const dx = centerX - closestX
      const dy = centerY - closestY
      const dz = centerZ - closestZ
      if (dx * dx + dy * dy + dz * dz < 0.25) return false

      return true
    }

    const onActionPointerDown = (e: PointerEvent) => {
      if (!isPointerLocked) return

      const target = getTarget()
      if (!target) return

      if (e.button === 0) {
        // break
        const brokenId = world.get(target.blockX, target.blockY, target.blockZ)
        world.set(target.blockX, target.blockY, target.blockZ, BlockId.Air)
        const { cx, cz, lx, lz } = world.globalToChunk(target.blockX, target.blockZ)
        world.markDirty(cx, cz)
        if (lx === 0) world.markDirty(cx - 1, cz)
        if (lx === world.chunkSize - 1) world.markDirty(cx + 1, cz)
        if (lz === 0) world.markDirty(cx, cz - 1)
        if (lz === world.chunkSize - 1) world.markDirty(cx, cz + 1)
        saveEditsRef.current.push({
          x: target.blockX,
          y: target.blockY,
          z: target.blockZ,
          id: BlockId.Air,
        })
        persistEdits()

        // drop a pickup item (simple "object")
        if (brokenId !== BlockId.Air && brokenId !== BlockId.Water) {
          const pickup = new THREE.Mesh(
            new THREE.BoxGeometry(0.25, 0.25, 0.25),
            new THREE.MeshStandardMaterial({ color: BLOCKS[brokenId].color }),
          )
          pickup.position.set(target.blockX + 0.5, target.blockY + 0.6, target.blockZ + 0.5)
          pickup.userData = { blockId: brokenId, velY: 0.02 }
          scene.add(pickup)
          pickups.push(pickup)
        }
      } else if (e.button === 2) {
        // place adjacent
        const px = target.blockX + target.normalX
        const py = target.blockY + target.normalY
        const pz = target.blockZ + target.normalZ

        const id = selectedBlockRef.current
        if (id !== BlockId.Air && canPlaceAt(px, py, pz)) {
          world.set(px, py, pz, id)
          const { cx, cz, lx, lz } = world.globalToChunk(px, pz)
          world.markDirty(cx, cz)
          if (lx === 0) world.markDirty(cx - 1, cz)
          if (lx === world.chunkSize - 1) world.markDirty(cx + 1, cz)
          if (lz === 0) world.markDirty(cx, cz - 1)
          if (lz === world.chunkSize - 1) world.markDirty(cx, cz + 1)
          saveEditsRef.current.push({ x: px, y: py, z: pz, id })
          persistEdits()
        }
      }
    }
    containerEl.addEventListener('pointerdown', onActionPointerDown)

    // === OBJECTS: simple pickups ===
    const pickups: THREE.Mesh[] = []

    // === ANIMATION LOOP ===
    let animationId: number

    const animate = () => {
      animationId = requestAnimationFrame(animate)
      updateActiveChunks()

      // Movimento WASD
      const direction = new THREE.Vector3()
      const forward = new THREE.Vector3()
      const right = new THREE.Vector3()

      camera.getWorldDirection(forward)
      forward.y = 0
      forward.normalize()

      right.crossVectors(forward, new THREE.Vector3(0, 1, 0))

      if (keys['w'] || keys['arrowup']) {
        direction.add(forward)
      }
      if (keys['s'] || keys['arrowdown']) {
        direction.sub(forward)
      }
      if (keys['a'] || keys['arrowleft']) {
        direction.sub(right)
      }
      if (keys['d'] || keys['arrowright']) {
        direction.add(right)
      }

      // Jump (Space) - only when grounded
      if ((keys[' '] || keys['space']) && isOnGround()) {
        verticalVelocity = jumpVelocity
        // prevent re-trigger while space is held
        keys[' '] = false
        keys['space'] = false
      }

      const desiredMove = new THREE.Vector3()
      if (direction.length() > 0) {
        direction.normalize()
        const speed = moveSpeed * (keys['shift'] ? runMultiplier : 1)
        desiredMove.copy(direction).multiplyScalar(speed)
      }

      // Horizontal collision (axis-separated)
      if (desiredMove.lengthSq() > 0) {
        const nextX = playerPos.x + desiredMove.x
        if (!aabbOverlapsSolid(nextX, playerPos.y, playerPos.z)) {
          playerPos.x = nextX
        }

        const nextZ = playerPos.z + desiredMove.z
        if (!aabbOverlapsSolid(playerPos.x, playerPos.y, nextZ)) {
          playerPos.z = nextZ
        }
      }

      // Gravity + vertical collision (sub-stepped)
      verticalVelocity -= gravity
      const steps = 6
      const stepVel = verticalVelocity / steps
      for (let i = 0; i < steps; i++) {
        const nextY = playerPos.y + stepVel
        if (!aabbOverlapsSolid(playerPos.x, nextY, playerPos.z)) {
          playerPos.y = nextY
          continue
        }

        // collision: stop at current y and zero velocity
        verticalVelocity = 0
        break
      }

      // Aggiorna posizione camera
      camera.position.x = playerPos.x
      camera.position.y = eyeHeight + playerPos.y
      camera.position.z = playerPos.z

      // Update target highlight
      const target = getTarget()
      if (target) {
        highlight.visible = true
        highlight.position.set(target.blockX + 0.5, target.blockY + 0.5, target.blockZ + 0.5)
      } else {
        highlight.visible = false
      }

      // Pickups update + collect
      for (let i = pickups.length - 1; i >= 0; i--) {
        const p = pickups[i]
        const velY = (p.userData?.velY as number | undefined) ?? 0
        p.userData.velY = Math.max(-0.08, velY - 0.004)
        p.position.y += p.userData.velY

        const ground = world.get(Math.floor(p.position.x), Math.floor(p.position.y - 0.2), Math.floor(p.position.z))
        if (ground !== BlockId.Air && ground !== BlockId.Water) {
          p.position.y = Math.floor(p.position.y) + 0.35
          p.userData.velY = 0
        }

        const dx = p.position.x - playerPos.x
        const dy = p.position.y - (playerPos.y + 0.9)
        const dz = p.position.z - playerPos.z
        if (dx * dx + dy * dy + dz * dz < 1.1) {
          scene.remove(p)
          p.geometry.dispose()
          ;(p.material as THREE.Material).dispose()
          pickups.splice(i, 1)
        }
      }

      renderer.render(scene, camera)
    }

    animate()

    // === RESIZE ===
    const handleResize = () => {
      const newWidth = window.innerWidth
      const newHeight = window.innerHeight
      camera.aspect = newWidth / newHeight
      camera.updateProjectionMatrix()
      renderer.setSize(newWidth, newHeight)
    }

    window.addEventListener('resize', handleResize)

    // === CLEANUP ===
    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('resize', handleResize)
      containerEl.removeEventListener('keydown', handleKeyDown)
      containerEl.removeEventListener('keyup', handleKeyUp)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      document.removeEventListener('pointerlockerror', onPointerLockError)
      containerEl.removeEventListener('pointerdown', requestPointerLock)
      containerEl.removeEventListener('pointerdown', onActionPointerDown)
      containerEl.removeEventListener('contextmenu', preventContextMenu)

      if (containerEl && renderer.domElement.parentNode) {
        containerEl.removeChild(renderer.domElement)
      }

      chunkMaterial.dispose()
      waterMaterial.dispose()
      for (const cr of chunkRenders.values()) {
        scene.remove(cr.opaqueMesh)
        scene.remove(cr.waterMesh)
        cr.opaqueMesh.geometry.dispose()
        cr.waterMesh.geometry.dispose()
      }
      for (const p of pickups) {
        scene.remove(p)
        p.geometry.dispose()
        ;(p.material as THREE.Material).dispose()
      }
      highlightGeometry.dispose()
      highlightMaterial.dispose()
      renderer.dispose()
    }
  }, [])

  return (
    <div ref={containerRef} className="flat-map-game-container" tabIndex={0}>
      <div className="flat-map-hud">
        <h2>Voxel Prototype</h2>
        <p>👆 Clicca per attivare mouse</p>
        <p>WASD: muoviti</p>
        <p>Shift: corri</p>
        <p>Spazio: salta</p>
        <p>Click: rompi blocco</p>
        <p>Tasto destro: piazza</p>
        <p>1-9: seleziona hotbar</p>
        <p>Mouse: guarda in giro</p>
      </div>
      <div className="flat-map-crosshair" />
      <div className="flat-map-hotbar">
        {hotbar.map((id, idx) => (
          <div
            key={idx}
            className={
              'flat-map-hotbar-slot' + (idx === selectedSlot ? ' is-selected' : '')
            }
          >
            <div
              className="flat-map-hotbar-swatch"
              style={{ background: BLOCKS[id].cssColor }}
              aria-hidden
            />
            <div className="flat-map-hotbar-label">{idx + 1}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
