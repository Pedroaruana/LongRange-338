import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { MUZZLE, P_SHOT, P_IMPACT, SOLUTION, bulletWorld, sample } from './layout'
import { telemetry } from './telemetry'
import { RANGE } from '../../shared/ballistics'

// .338 Lapua 250gr em escala real: 8,6 mm x 41 mm. a camera chega perto o bastante para ela encher a tela
const L = 0.041
const R = 0.0043

export const bulletProfile = () => {
  const pts: THREE.Vector2[] = [new THREE.Vector2(0, -L / 2), new THREE.Vector2(R * 0.8, -L / 2)]
  pts.push(new THREE.Vector2(R * 0.82, -L / 2 + 0.0004))
  pts.push(new THREE.Vector2(R, -L / 2 + 0.0055)) // boat tail de 7 graus
  // canelura: o sulco onde o estojo crimpa a bala
  pts.push(new THREE.Vector2(R, -0.0085), new THREE.Vector2(R * 0.955, -0.008), new THREE.Vector2(R * 0.955, -0.0068), new THREE.Vector2(R, -0.0063))
  pts.push(new THREE.Vector2(R, -0.001))
  // ogiva tangente: arco de raio rho que encosta no corpo e fecha em ponta
  const lo = L / 2 + 0.001
  const rho = (R * R + lo * lo) / (2 * R)
  for (let i = 1; i <= 20; i++) {
    const x = (i / 20) * lo
    const r = Math.sqrt(rho * rho - x * x) + R - rho
    pts.push(new THREE.Vector2(Math.max(r, 0.0005), -0.001 + x))
  }
  pts.push(new THREE.Vector2(0, L / 2 + 0.0001))
  return pts
}

// marcas do raiamento gravadas na jaqueta: e o que deixa ver a bala girando
const riflingTexture = () => {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 16
  const x = c.getContext('2d')!
  x.fillStyle = '#5a5a5a'
  x.fillRect(0, 0, 256, 16)
  x.fillStyle = '#c8c8c8'
  for (let i = 0; i < 6; i++) x.fillRect(i * (256 / 6), 0, 12, 16)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = THREE.RepeatWrapping
  return t
}

const bulletGeo = () => {
  const g = new THREE.LatheGeometry(bulletProfile(), 64)
  g.rotateX(Math.PI / 2) // ponta em +z para funcionar com lookAt
  return g
}

// normal em espaco de vista: o cone tem escala nao uniforme, entao precisa da normalMatrix
const coneVertex = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vN;
  varying vec3 vV;
  varying vec2 vUv;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = -mv.xyz;
    vUv = uv;
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }
`

const coneFragment = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  uniform float uAlpha;
  varying vec3 vN;
  varying vec3 vV;
  varying vec2 vUv;
  void main() {
    #include <logdepthbuf_fragment>
    float edge = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 6.0);
    // a onda de choque e mais forte junto a ponta e se dissolve para tras
    float a = edge * smoothstep(0.0, 0.8, vUv.y) * uAlpha;
    gl_FragColor = vec4(vec3(1.0, 0.94, 0.86), a);
  }
`

const traceVertex = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute float aS;
  varying float vS;
  void main() {
    vS = aS;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`

const traceFragment = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  uniform float uS;
  uniform float uFade;
  varying float vS;
  void main() {
    #include <logdepthbuf_fragment>
    float behind = uS - vS;
    if (behind < 0.0) discard;
    float a = exp(-behind / 90.0) * 0.55 * uFade;
    gl_FragColor = vec4(vec3(1.0, 0.85, 0.65) * 1.4, a);
  }
`

const radialTexture = (spikes: number) => {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const x = c.getContext('2d')!
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.15, 'rgba(255,220,170,.8)')
  g.addColorStop(0.5, 'rgba(255,140,60,.15)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  x.fillStyle = g
  x.fillRect(0, 0, 256, 256)
  x.globalCompositeOperation = 'lighter'
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * Math.PI * 2 + Math.random() * 0.3
    const len = 60 + Math.random() * 68
    x.strokeStyle = 'rgba(255,200,140,.35)'
    x.lineWidth = 1 + Math.random() * 3
    x.beginPath()
    x.moveTo(128, 128)
    x.lineTo(128 + Math.cos(a) * len, 128 + Math.sin(a) * len)
    x.stroke()
  }
  return new THREE.CanvasTexture(c)
}

const sprite = (spikes: number, color: THREE.Color) =>
  new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTexture(spikes), color, blending: THREE.AdditiveBlending,
    depthWrite: false, transparent: true, toneMapped: false
  }))

const pos = new THREE.Vector3()
const ahead = new THREE.Vector3()
const back = new THREE.Vector3()

export const Projectile = () => {
  const bullet = useRef<THREE.Group>(null)
  const spin = useRef<THREE.Mesh>(null)
  const cone = useRef<THREE.Mesh>(null)

  const parts = useMemo(() => {
    const geo = bulletGeo()
    const mat = new THREE.MeshStandardMaterial({ color: 0xc9825a, metalness: 1, roughness: 0.24, roughnessMap: riflingTexture() })

    const coneGeo = new THREE.ConeGeometry(1, 1, 48, 1, true)
    coneGeo.translate(0, -0.5, 0)
    coneGeo.rotateX(Math.PI / 2) // apice na ponta, base para tras
    const coneMat = new THREE.ShaderMaterial({
      vertexShader: coneVertex, fragmentShader: coneFragment, transparent: true, depthWrite: false,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { uAlpha: { value: 0 } }
    })

    // rastro: a trajetoria inteira ja calculada, revelada conforme a bala avanca
    const n = SOLUTION.samples.length
    const arr = new Float32Array(n * 3)
    const sArr = new Float32Array(n)
    SOLUTION.samples.forEach((q, i) => {
      bulletWorld(q, pos).toArray(arr, i * 3)
      sArr[i] = q.s
    })
    const traceGeo = new THREE.BufferGeometry()
    traceGeo.setAttribute('position', new THREE.BufferAttribute(arr, 3))
    traceGeo.setAttribute('aS', new THREE.BufferAttribute(sArr, 1))
    const traceMat = new THREE.ShaderMaterial({
      vertexShader: traceVertex, fragmentShader: traceFragment, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, uniforms: { uS: { value: 0 }, uFade: { value: 0 } }
    })
    const trace = new THREE.Line(traceGeo, traceMat)
    trace.frustumCulled = false

    const flash = sprite(0, new THREE.Color(7, 5, 3.2))
    const glow = sprite(0, new THREE.Color(2.2, 1.3, 0.6))
    flash.position.copy(MUZZLE).add(new THREE.Vector3(0, 0, -0.12))
    glow.position.copy(MUZZLE).add(new THREE.Vector3(0, 0, -0.3))

    return { geo, mat, coneGeo, coneMat, trace, traceMat, flash, glow }
  }, [])

  useFrame(() => {
    const { p, s } = telemetry
    const flying = p >= P_SHOT && s < RANGE
    const b = bullet.current
    if (!b || !spin.current || !cone.current) return

    b.visible = flying
    if (flying) {
      const q = sample(s)
      bulletWorld(q, pos)
      // direcao pela tangente da trajetoria
      bulletWorld(sample(Math.min(RANGE, s + 1)), ahead)
      bulletWorld(sample(Math.max(0, s - 1)), back)
      ahead.sub(back).add(pos)
      b.position.copy(pos)
      b.lookAt(ahead)
      // giro visual: 200 mil rpm reais seriam invisiveis, aqui segue o scroll
      spin.current.rotation.z = s * 0.9

      // cone de Mach: semi-angulo = asin(1/M); some ao ficar subsonica
      const M = q.mach
      const show = THREE.MathUtils.smoothstep(M, 1.0, 1.15)
      const mu = Math.asin(Math.min(1, 1 / Math.max(M, 1.0001)))
      const H = 0.12
      cone.current.scale.set(Math.tan(mu) * H, Math.tan(mu) * H, H)
      cone.current.position.z = L / 2
      parts.coneMat.uniforms.uAlpha.value = show * 0.12
    }

    parts.traceMat.uniforms.uS.value = s
    parts.traceMat.uniforms.uFade.value = p >= P_SHOT ? 1 - THREE.MathUtils.smoothstep(p, P_IMPACT + 0.02, P_IMPACT + 0.06) * 0.6 : 0

    // clarao de boca: pico logo no disparo, decai rapido
    const k = p - P_SHOT
    const f = k > 0 ? Math.exp(-k * 260) * Math.min(1, k * 4000) : 0
    parts.flash.material.opacity = f
    // o freio de boca joga o clarao para os lados: chama larga e baixa, nao uma estrela
    parts.flash.scale.set(0.2 + f * 1.3, 0.08 + f * 0.3, 1)
    parts.glow.material.opacity = f * 0.9
    parts.glow.scale.set(2.2 * f + 0.01, 1.0 * f + 0.01, 1)
  })

  return (
    <>
      <group ref={bullet}>
        <mesh ref={spin} geometry={parts.geo} material={parts.mat} />
        <mesh ref={cone} geometry={parts.coneGeo} material={parts.coneMat} />
      </group>
      <primitive object={parts.trace} />
      <primitive object={parts.flash} />
      <primitive object={parts.glow} />
    </>
  )
}
