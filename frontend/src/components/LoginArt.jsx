import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import * as THREE from "three"

// A slow-flowing cloud-like field (fbm noise) in the app's own brand blue,
// rendered on a single full-screen triangle. The cursor continuously pushes
// and swirls the flow underneath it like a finger trailing through still
// water — a smooth, low-frequency effect (no thin bands, no high-frequency
// waves, no divide-by-near-zero) so it never aliases into flicker — plus a
// soft trailing ripple wake and the occasional flash of lightning in the cloud.
const VERTEX_SHADER = `
  void main() {
    gl_Position = vec4(position, 1.0);
  }
`

const FRAGMENT_SHADER = `
  precision highp float;
  uniform vec2 u_resolution;
  uniform float u_time;
  uniform vec2 u_pointer;
  uniform float u_pointerActive;
  uniform int u_rippleCount;
  uniform vec3 u_ripples[10];
  uniform float u_flashTime;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float a = hash(i), b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.05; a *= 0.55; }
    return v;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    float aspect = u_resolution.x / max(u_resolution.y, 1.0);
    vec2 p = uv * vec2(aspect, 1.0);
    vec2 pointerP = u_pointer * vec2(aspect, 1.0);

    // Continuous push + swirl centred on the cursor — this is the actual
    // "water flowing where you hover" motion. The swirl direction is faded
    // to zero right at the cursor (smoothstep floor) instead of normalizing
    // a near-zero vector, which is what caused the flicker: dividing by a
    // distance that hovers around zero flips the direction chaotically
    // frame to frame right under the pointer.
    vec2 toPointer = p - pointerP;
    float distP = length(toPointer);
    float influence = u_pointerActive * exp(-distP * 2.4) * smoothstep(0.0, 0.02, distP);
    vec2 dir = toPointer / max(distP, 0.02);
    vec2 swirl = vec2(-dir.y, dir.x) * influence * 0.14;
    vec2 push  = dir * influence * 0.06;

    // Soft trailing ripple wake — few, wide, low-frequency waves (no thin
    // bands) so they read as gentle swells rather than flickering dots.
    float rippleWave = 0.0;
    for (int i = 0; i < 10; i++) {
      if (i >= u_rippleCount) break;
      vec3 r = u_ripples[i];
      vec2 rp = r.xy * vec2(aspect, 1.0);
      float age = u_time - r.z;
      if (age < 0.0 || age > 1.2) continue;
      float d = distance(p, rp);
      float envelope = exp(-age * 2.6) * exp(-d * 1.7);
      rippleWave += sin(d * 13.0 - age * 5.5) * envelope;
    }

    vec2 flowUv = p + swirl + push + rippleWave * 0.012;

    float t = u_time * 0.045;
    float flowA = fbm(flowUv * 2.0 + vec2(t, -t * 0.6));
    float flowB = fbm(flowUv * 3.2 - vec2(t * 0.4, t * 0.85));
    float glow = flowA * 0.6 + flowB * 0.4 + influence * 0.3 + rippleWave * 0.14;

    vec3 deep   = vec3(0.020, 0.035, 0.078);
    vec3 indigo = vec3(0.145, 0.165, 0.46);
    vec3 blue   = vec3(0.145, 0.388, 0.922);
    vec3 sky    = vec3(0.30, 0.62, 0.98);

    vec3 col = mix(deep, indigo, smoothstep(0.15, 0.65, glow));
    col = mix(col, blue, smoothstep(0.45, 0.92, glow) * 0.75);
    col = mix(col, sky, smoothstep(0.72, 1.05, flowB) * 0.35);
    col += influence * vec3(0.35, 0.55, 1.0) * 0.35;

    // Lightning: a quick double-pulse of near-white brightness washing
    // through the whole cloud, biased toward wherever the flow is already
    // brightest so it reads as light catching the cloud, not a flat overlay.
    float fa = u_time - u_flashTime;
    float flash = 0.0;
    if (fa > 0.0 && fa < 0.6) {
      flash = exp(-fa * 14.0) * 0.85 + exp(-abs(fa - 0.14) * 20.0) * 0.6;
    }
    col = mix(col, vec3(0.86, 0.92, 1.0), clamp(flash * (0.35 + glow * 0.4), 0.0, 0.75));
    col += flash * 0.18;

    float vignette = smoothstep(1.15, 0.15, length(uv - 0.5));
    col *= mix(0.5, 1.0, vignette);

    gl_FragColor = vec4(col, 1.0);
  }
`

const RIPPLE_SLOTS = 10

function buildBoltPoints(xPercent) {
  const points = []
  let x = xPercent
  let y = -2
  const segments = 6
  for (let i = 0; i <= segments; i++) {
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`)
    x += (Math.random() - 0.5) * 16
    y += 78 / segments
  }
  return points.join(" ")
}

const LoginArt = forwardRef(function LoginArt(_props, ref) {
  const containerRef = useRef(null)
  const apiRef = useRef(null)
  const [bolt, setBolt] = useState(null)

  useImperativeHandle(ref, () => ({
    updatePointer(nx, ny) {
      const api = apiRef.current
      if (!api) return
      api.uniforms.u_pointer.value.set(nx, 1 - ny)
      api.uniforms.u_pointerActive.value = 1
    },
    clearPointer() {
      const api = apiRef.current
      if (!api) return
      api.uniforms.u_pointerActive.value = 0
    },
    addRipple(nx, ny) {
      const api = apiRef.current
      if (!api) return
      const idx = api.writeIndex % RIPPLE_SLOTS
      api.uniforms.u_ripples.value[idx].set(nx, 1 - ny, api.clock.getElapsedTime())
      api.writeIndex += 1
      api.uniforms.u_rippleCount.value = Math.min(api.uniforms.u_rippleCount.value + 1, RIPPLE_SLOTS)
    },
  }), [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.domElement.style.width = "100%"
    renderer.domElement.style.height = "100%"
    renderer.domElement.style.display = "block"
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    const ripples = Array.from({ length: RIPPLE_SLOTS }, () => new THREE.Vector3(-10, -10, -10))
    const uniforms = {
      u_time: { value: 0 },
      u_resolution: { value: new THREE.Vector2(1, 1) },
      u_pointer: { value: new THREE.Vector2(0.5, 0.5) },
      u_pointerActive: { value: 0 },
      u_rippleCount: { value: 0 },
      u_ripples: { value: ripples },
      u_flashTime: { value: -10 },
    }

    const material = new THREE.ShaderMaterial({ vertexShader: VERTEX_SHADER, fragmentShader: FRAGMENT_SHADER, uniforms })
    const geometry = new THREE.PlaneGeometry(2, 2)
    scene.add(new THREE.Mesh(geometry, material))

    const clock = new THREE.Clock()
    apiRef.current = { uniforms, clock, writeIndex: 0 }

    function resize() {
      const w = Math.max(container.clientWidth, 1)
      const h = Math.max(container.clientHeight, 1)
      renderer.setSize(w, h, false)
      uniforms.u_resolution.value.set(w, h)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)

    let raf
    let alive = true
    function tick() {
      if (!alive) return
      uniforms.u_time.value = clock.getElapsedTime()
      renderer.render(scene, camera)
      raf = requestAnimationFrame(tick)
    }
    tick()

    // Occasional lightning — random delay, brightens the shader and flashes
    // a jagged bolt overlay in sync.
    let flashTimeout
    function scheduleFlash() {
      const delay = 5000 + Math.random() * 6000
      flashTimeout = setTimeout(() => {
        if (!alive) return
        uniforms.u_flashTime.value = clock.getElapsedTime()
        const x = 15 + Math.random() * 70
        const id = Date.now()
        setBolt({ id, x, points: buildBoltPoints(x) })
        setTimeout(() => setBolt((b) => (b && b.id === id ? null : b)), 400)
        scheduleFlash()
      }, delay)
    }
    scheduleFlash()

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      clearTimeout(flashTimeout)
      ro.disconnect()
      geometry.dispose()
      material.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement)
      apiRef.current = null
    }
  }, [])

  return (
    <>
      <div ref={containerRef} className="absolute inset-0 z-0" aria-hidden="true" />
      <AnimatePresence>
        {bolt && (
          <svg
            key={bolt.id}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 z-[6] w-full h-full pointer-events-none"
            aria-hidden="true"
          >
            <motion.polyline
              points={bolt.points}
              fill="none"
              stroke="rgba(224,238,255,0.9)"
              strokeWidth="0.6"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              style={{ filter: "drop-shadow(0 0 4px rgba(147,197,253,0.85))" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.15, 0.8, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, times: [0, 0.12, 0.3, 0.45, 1], ease: "easeOut" }}
            />
          </svg>
        )}
      </AnimatePresence>
    </>
  )
})

export default LoginArt
