import { useEffect, useRef } from 'react'
import * as THREE from 'three'

interface ShaderAnimationProps {
  className?: string
  opacity?: number
  speed?: number
  intensity?: number
}

export default function ShaderAnimation({
  className = '',
  opacity = 0.15,
  speed = 0.008,
  intensity = 0.0003
}: ShaderAnimationProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer
    animationId: number
  } | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current

    const vertexShader = `
      void main() {
        gl_Position = vec4(position, 1.0);
      }
    `

    const fragmentShader = `
      precision highp float;
      uniform vec2 resolution;
      uniform float time;
      uniform float intensity;

      void main(void) {
        vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y) / 6.0;
        float t = time * 0.008;
        float lineWidth = intensity;

        vec3 color = vec3(0.0);
        for(int j = 0; j < 3; j++){
          for(int i = 0; i < 5; i++){
            color[j] += lineWidth * float(i * i) / abs(fract(t - 0.01 * float(j) + float(i) * 0.01) * 5.0 - length(uv) + mod(uv.x + uv.y, 0.2));
          }
        }

        gl_FragColor = vec4(color[0], color[1], color[2], 1.0);
      }
    `

    const camera = new THREE.Camera()
    camera.position.z = 1

    const scene = new THREE.Scene()
    const geometry = new THREE.PlaneGeometry(2, 2)

    const uniforms = {
      time: { type: 'f', value: 1.0 },
      resolution: { type: 'v2', value: new THREE.Vector2() },
      intensity: { type: 'f', value: intensity }
    }

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader
    })

    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true })
    renderer.setPixelRatio(1)
    renderer.setClearColor(0x000000, 0)

    container.appendChild(renderer.domElement)

    const onWindowResize = (): void => {
      const width = container.clientWidth
      const height = container.clientHeight
      renderer.setSize(width, height)
      uniforms.resolution.value.x = renderer.domElement.width
      uniforms.resolution.value.y = renderer.domElement.height
    }

    onWindowResize()
    window.addEventListener('resize', onWindowResize, false)

    const startTime = performance.now()
    let lastRenderTime = 0
    const targetFPS = 10
    const frameInterval = 1000 / targetFPS

    const animate = (currentTime: number): void => {
      const animationId = requestAnimationFrame(animate)

      if (currentTime - lastRenderTime < frameInterval) {
        if (sceneRef.current) {
          sceneRef.current.animationId = animationId
        }
        return
      }
      lastRenderTime = currentTime

      const elapsed = (performance.now() - startTime) * 0.001
      const oscillation = Math.sin(elapsed * speed) * 6
      uniforms.time.value = oscillation

      renderer.render(scene, camera)

      if (sceneRef.current) {
        sceneRef.current.animationId = animationId
      }
    }

    sceneRef.current = {
      renderer,
      animationId: 0
    }

    requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('resize', onWindowResize)

      if (sceneRef.current) {
        cancelAnimationFrame(sceneRef.current.animationId)

        if (container && sceneRef.current.renderer.domElement) {
          container.removeChild(sceneRef.current.renderer.domElement)
        }

        sceneRef.current.renderer.dispose()
        geometry.dispose()
        material.dispose()
      }
    }
  }, [speed, intensity])

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 h-full w-full pointer-events-none ${className}`}
      style={{
        opacity,
        overflow: 'hidden'
      }}
    />
  )
}
