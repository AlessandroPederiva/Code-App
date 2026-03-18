import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import '../styles/FlatMapGame.css'

export function FlatMapGame() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [score, setScore] = useState(0)
  const [coinsLeft, setCoinsLeft] = useState(10)

  useEffect(() => {
    if (!containerRef.current) return

    const containerEl = containerRef.current

    // === SCENE SETUP ===
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x87ceeb) // Sky blue

    const width = window.innerWidth
    const height = window.innerHeight

    // Camera prima persona
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
    camera.position.set(0, 1.6, 0) // Altezza occhi umani ~1.6m

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    containerEl.appendChild(renderer.domElement)

    // === LIGHTING ===
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
    directionalLight.position.set(10, 10, 5)
    scene.add(directionalLight)
    scene.add(new THREE.AmbientLight(0xffffff, 0.5))

    // === PAVIMENTO a y=0 ===
    const floorSize = 300
    const floorGeometry = new THREE.PlaneGeometry(floorSize, floorSize)
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x4ade80, // Verde brillante
      side: THREE.DoubleSide,
    })
    const floor = new THREE.Mesh(floorGeometry, floorMaterial)
    floor.rotation.x = -Math.PI / 2
    floor.position.y = 0
    scene.add(floor)

    // Griglia sul pavimento
    const gridHelper = new THREE.GridHelper(floorSize, 60, 0xffffff, 0x888888)
    gridHelper.position.y = 0.01
    scene.add(gridHelper)

    // === ORIZZONTE ===
    // Piano lontano per l'orizzonte
    const horizonSize = 1200
    const horizonGeometry = new THREE.PlaneGeometry(horizonSize, horizonSize)
    const horizonMaterial = new THREE.MeshStandardMaterial({
      color: 0x98d8c8, // Verde acqua per orizzonte
      side: THREE.DoubleSide,
    })
    const horizon = new THREE.Mesh(horizonGeometry, horizonMaterial)
    horizon.rotation.x = -Math.PI / 2
    horizon.position.y = -0.1 // Sotto il pavimento principale
    scene.add(horizon)

    // === PLAYER POSITION (invisibile in prima persona) ===
    const playerPos = new THREE.Vector3(0, 0, 0)
    const eyeHeight = 1.6

    // === JUMP / GRAVITY ===
    let verticalVelocity = 0
    const gravity = 0.012
    const jumpVelocity = 0.22
    const groundY = 0
    const isOnGround = () => playerPos.y <= groundY + 1e-6

    // === MONETE ===
    const coins: THREE.Mesh[] = []
    const coinGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 16)
    const coinMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.8,
      roughness: 0.2,
    })

    for (let i = 0; i < 10; i++) {
      const coin = new THREE.Mesh(coinGeometry, coinMaterial)
      coin.rotation.x = Math.PI / 2
      const coinSpawnRadius = floorSize * 0.45
      coin.position.set(
        (Math.random() - 0.5) * coinSpawnRadius,
        0.15,
        (Math.random() - 0.5) * coinSpawnRadius,
      )
      scene.add(coin)
      coins.push(coin)
    }

    // === CONTROLLI TASTIERA ===
    const keys: Record<string, boolean> = {}

    const handleKeyDown = (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = true
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

    // === MOVIMENTO ===
    const moveSpeed = 0.15
    const runMultiplier = 2
    const halfFloor = floorSize / 2 - 2

    // === ANIMATION LOOP ===
    let animationId: number

    const animate = () => {
      animationId = requestAnimationFrame(animate)

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

      if (direction.length() > 0) {
        direction.normalize()
        const speed = moveSpeed * (keys['shift'] ? runMultiplier : 1)
        playerPos.add(direction.multiplyScalar(speed))
        playerPos.x = Math.max(-halfFloor, Math.min(halfFloor, playerPos.x))
        playerPos.z = Math.max(-halfFloor, Math.min(halfFloor, playerPos.z))
      }

      // Gravity integration
      verticalVelocity -= gravity
      playerPos.y += verticalVelocity
      if (playerPos.y < groundY) {
        playerPos.y = groundY
        verticalVelocity = 0
      }

      // Aggiorna posizione camera
      camera.position.x = playerPos.x
      camera.position.y = eyeHeight + playerPos.y
      camera.position.z = playerPos.z

      // Rotazione monete
      coins.forEach((coin) => {
        coin.rotation.z += 0.02
      })

      // Raccolta monete
      for (let i = coins.length - 1; i >= 0; i--) {
        const coin = coins[i]
        const dx = playerPos.x - coin.position.x
        const dz = playerPos.z - coin.position.z
        const dist = Math.sqrt(dx * dx + dz * dz)

        if (dist < 1) {
          scene.remove(coin)
          coins.splice(i, 1)
          setScore((prev) => prev + 10)
          setCoinsLeft((prev) => Math.max(0, prev - 1))
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

      if (containerEl && renderer.domElement.parentNode) {
        containerEl.removeChild(renderer.domElement)
      }

      floorGeometry.dispose()
      floorMaterial.dispose()
      horizonGeometry.dispose()
      horizonMaterial.dispose()
      coinGeometry.dispose()
      coinMaterial.dispose()
      renderer.dispose()
    }
  }, [])

  return (
    <div ref={containerRef} className="flat-map-game-container" tabIndex={0}>
      <div className="flat-map-hud">
        <h2>🎮 Gioco Prima Persona</h2>
        <p>Score: {score}</p>
        <p>Monete: {coinsLeft}</p>
        <p>👆 Clicca per attivare mouse</p>
        <p>WASD: muoviti</p>
        <p>Shift: corri</p>
        <p>Mouse: guarda in giro</p>
      </div>
    </div>
  )
}
