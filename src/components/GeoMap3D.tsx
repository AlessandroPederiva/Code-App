import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import '../styles/GeoMap3D.css'

export function GeoMap3D() {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Scene setup
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x000011)
    sceneRef.current = scene

    // Camera setup
    const width = window.innerWidth
    const height = window.innerHeight
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 10000)
    camera.position.set(0, 0, 3)
    cameraRef.current = camera

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Crea un globo terrestre
    const globeGeometry = new THREE.SphereGeometry(1, 64, 64)
    const canvas = document.createElement('canvas')
    canvas.width = 2048
    canvas.height = 1024

    // Disegna una texture per la Terra
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#1a472a' // Verde oceano
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Aggiungi continenti semplificati
    ctx.fillStyle = '#3a6b3a' // Verde terra
    ctx.fillRect(0, 300, 800, 400) // America
    ctx.fillRect(1000, 300, 600, 400) // Europa/Africa
    ctx.fillRect(1700, 250, 400, 300) // Asia

    // Aggiungi città marcate
    const cities = [
      { name: 'Roma', x: 1150, y: 450, color: '#ff0000' },
      { name: 'Milano', x: 1100, y: 380, color: '#0099ff' },
      { name: 'Venezia', x: 1200, y: 360, color: '#00ff00' },
    ]

    cities.forEach((city) => {
      ctx.fillStyle = city.color
      ctx.beginPath()
      ctx.arc(city.x, city.y, 15, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 20px Arial'
      ctx.fillText(city.name, city.x + 20, city.y - 10)
    })

    const texture = new THREE.CanvasTexture(canvas)
    const globeMaterial = new THREE.MeshPhongMaterial({
      map: texture,
      emissive: 0x333333,
    })

    const globe = new THREE.Mesh(globeGeometry, globeMaterial)
    scene.add(globe)

    // Lighting
    const light1 = new THREE.DirectionalLight(0xffffff, 1)
    light1.position.set(5, 3, 5)
    scene.add(light1)

    const light2 = new THREE.AmbientLight(0x404040)
    scene.add(light2)

    // Stars background
    const starsGeometry = new THREE.BufferGeometry()
    const starsMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.02 })
    const starsVertices = new Float32Array(1000 * 3)

    for (let i = 0; i < 1000 * 3; i += 3) {
      starsVertices[i] = (Math.random() - 0.5) * 2000
      starsVertices[i + 1] = (Math.random() - 0.5) * 2000
      starsVertices[i + 2] = (Math.random() - 0.5) * 2000
    }

    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starsVertices, 3))
    const stars = new THREE.Points(starsGeometry, starsMaterial)
    scene.add(stars)

    // Animation loop
    let animationId: number
    const animate = () => {
      animationId = requestAnimationFrame(animate)
      globe.rotation.y += 0.001
      renderer.render(scene, camera)
    }

    animate()

    // Handle resize
    const handleResize = () => {
      const newWidth = window.innerWidth
      const newHeight = window.innerHeight
      camera.aspect = newWidth / newHeight
      camera.updateProjectionMatrix()
      renderer.setSize(newWidth, newHeight)
    }

    window.addEventListener('resize', handleResize)

    // Mouse interaction
    let isDragging = false
    let previousMousePosition = { x: 0, y: 0 }

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true
      previousMousePosition = { x: e.clientX, y: e.clientY }
    }

    const onMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const deltaX = e.clientX - previousMousePosition.x
        const deltaY = e.clientY - previousMousePosition.y
        globe.rotation.y += deltaX * 0.005
        globe.rotation.x += deltaY * 0.005
        previousMousePosition = { x: e.clientX, y: e.clientY }
      }
    }

    const onMouseUp = () => {
      isDragging = false
    }

    renderer.domElement.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    // Scroll zoom
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      camera.position.z += e.deltaY * 0.001
      camera.position.z = Math.max(1.5, Math.min(5, camera.position.z))
    }

    renderer.domElement.addEventListener('wheel', onWheel, { passive: false })

    // Cleanup
    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', handleResize)
      renderer.domElement.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      renderer.domElement.removeEventListener('wheel', onWheel)
      containerRef.current?.removeChild(renderer.domElement)
      globeGeometry.dispose()
      globeMaterial.dispose()
      starsGeometry.dispose()
      starsMaterial.dispose()
      renderer.dispose()
    }
  }, [])

  return (
    <div ref={containerRef} className="geo-map-container">
      <div className="map-info">
        <h2>🌍 Globo Terrestre 3D Interattivo</h2>
        <p>Trascina il mouse per ruotare</p>
        <p>Scroll per zoomare</p>
        <ul>
          <li>🔴 Roma</li>
          <li>🔵 Milano</li>
          <li>🟢 Venezia</li>
        </ul>
      </div>
    </div>
  )
}
