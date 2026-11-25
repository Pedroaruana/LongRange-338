import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import {
  SHOOTER, TARGET, P_SHOT, P_IMPACT, P_SCOPE_IN, P_SCOPE, SCOPE_EYE, SCOPE_AIM, SCOPE_FOV, BASE_FOV,
  bulletWorld, sample, distanceAt
} from './layout'
import { telemetry } from './telemetry'
import { heightAt, valleyX } from './height'
import { perf } from '../perf'
import { RANGE } from '../ballistics'

// enquadramentos da camera de perseguicao ao longo do voo, no referencial da bala:
// [distancia (m), atras, lado, cima]
const CHASE: [number, number, number, number][] = [
  [0, 0.16, 0.05, 0.02],
  [150, 0.2, 0.12, 0.04],
  [400, 0.1, 0.2, 0.03],
  [700, 0.3, -0.18, 0.06],
  [1000, 1.4, 1.1, 0.5],
  [1300, 0.1, 0.16, -0.03],
  [1600, -0.14, 0.2, 0.04],
  [1900, 0.3, 0.22, 0.06],
  [RANGE, 0.9, 1.4, 0.15]
]

const smooth = (t: number) => t * t * (3 - 2 * t)

const chaseOffset = (s: number) => {
  let i = 0
  while (i < CHASE.length - 2 && s > CHASE[i + 1][0]) i++
  const [s0, ...a] = CHASE[i]
  const [s1, ...b] = CHASE[i + 1]
  const f = smooth(THREE.MathUtils.clamp((s - s0) / (s1 - s0), 0, 1))
  return a.map((v, k) => v + (b[k] - v) * f)
}

const pos = new THREE.Vector3()
const look = new THREE.Vector3()
const bp = new THREE.Vector3()
const fwd = new THREE.Vector3()
const right = new THREE.Vector3()
const upv = new THREE.Vector3()
const camA = new THREE.Vector3()
const lookA = new THREE.Vector3()
const Y = new THREE.Vector3(0, 1, 0)

// abertura do lado direito do fuzil: a boca do cano aponta para a direita do quadro e o corpo fica atras.
// depois a camera entra na luneta: posicao no olho, campo de visao de 25x, mira no ponto segurado
const intro = (p: number, pointer: { x: number; y: number }) => {
  const f = smooth(THREE.MathUtils.clamp(p / P_SCOPE_IN, 0, 1))
  camA.set(2.1 - 0.85 * f, 0.75 - 0.28 * f, 1.6 - 0.9 * f).add(SHOOTER)
  camA.x += pointer.x * 0.08
  camA.y += pointer.y * 0.04
  lookA.set(-0.15, 0.25, 0.1 - 0.7 * f).add(SHOOTER)

  const k = smooth(THREE.MathUtils.clamp((p - P_SCOPE_IN) / (P_SCOPE - P_SCOPE_IN), 0, 1))
  camA.lerp(SCOPE_EYE, k)
  // o ponto de mira entra por ultimo para a camera nao girar de supetao
  lookA.lerp(SCOPE_AIM, smooth(THREE.MathUtils.clamp(k * 1.4 - 0.2, 0, 1)))
  return k
}

// interpolacao exponencial do campo de visao: o zoom parece continuo como numa luneta de verdade
const fovMix = (a: number, b: number, k: number) => a * Math.pow(b / a, k)

const chase = (s: number) => {
  const q = sample(s)
  bulletWorld(q, bp)
  bulletWorld(sample(Math.min(RANGE, s + 1)), fwd)
  bulletWorld(sample(Math.max(0, s - 1)), look)
  fwd.sub(look).normalize()
  right.crossVectors(fwd, Y).normalize()
  upv.crossVectors(right, fwd)
  const [back, side, up] = chaseOffset(s)
  pos.copy(bp).addScaledVector(fwd, -back).addScaledVector(right, side).addScaledVector(upv, up)
  look.copy(bp).addScaledVector(fwd, 0.03)
}

// ---------- tela inicial: voo rasante pelo canion, sem fim ----------
const FLY_START = 4800
const FLY_END = -4800
const FLY_SPEED = 92
const FLY_FADE = FLY_SPEED * 1.6
const fly = { z: FLY_START, y: 0, roll: 0, t: 0, init: false }
const flyLook = new THREE.Vector3()
const flyLookSmooth = new THREE.Vector3()

const homeFlight = (camera: THREE.Camera, pointer: { x: number; y: number }, dt: number) => {
  fly.t += dt
  fly.z -= FLY_SPEED * dt
  if (fly.z < FLY_END) {
    fly.z = FLY_START
    fly.init = false
  }
  const { z, t } = fly
  const x = valleyX(z) + Math.sin(t * 0.23) * 32
  // olha a frente para subir antes dos morros
  const ground = Math.max(heightAt(x, z), heightAt(x, z - 50), heightAt(x, z - 110))
  const targetY = ground + 40 + Math.sin(t * 0.37) * 12
  const lz = z - 240
  if (!fly.init) {
    fly.y = targetY
    flyLookSmooth.set(valleyX(lz), heightAt(valleyX(lz), lz) + 18, lz)
    fly.init = true
  }
  fly.y += (targetY - fly.y) * Math.min(1, dt * 2.2)
  const lx = valleyX(lz) + pointer.x * 60
  flyLook.set(lx, heightAt(lx, lz) + 18 + pointer.y * 30, lz)
  flyLookSmooth.lerp(flyLook, Math.min(1, dt * 2.5))

  camera.position.set(x, fly.y, z)
  camera.lookAt(flyLookSmooth)
  // inclina nas curvas como uma aeronave
  const curve = valleyX(z - 160) - valleyX(z)
  fly.roll += (-curve * 0.0016 - fly.roll) * Math.min(1, dt * 1.5)
  camera.rotateZ(fly.roll)

  telemetry.homeAlt = fly.y - heightAt(x, z)
  telemetry.homeFade = Math.min(1, Math.max(0, 1 - (FLY_START - z) / FLY_FADE, 1 - (z - FLY_END) / FLY_FADE))
}

// ?cam=x,y,z,lx,ly,lz trava a camera num ponto relativo ao atirador (so para desenvolvimento)
const debugCam = import.meta.env.DEV
  ? new URLSearchParams(location.search).get('cam')?.split(',').map(Number)
  : undefined

export const CameraRig = () => {
  useFrame(({ camera, pointer }, dtRaw) => {
    if (import.meta.env.DEV) {
      const w = window as Window & { __frames?: number }
      w.__frames = (w.__frames ?? 0) + 1
      if (w.__frames === 1) perf('primeiro quadro')
    }
    if (debugCam?.length === 6) {
      camera.position.set(debugCam[0], debugCam[1], debugCam[2]).add(SHOOTER)
      camera.lookAt(new THREE.Vector3(debugCam[3], debugCam[4], debugCam[5]).add(SHOOTER))
      return
    }
    const dt = Math.min(dtRaw, 0.05)

    if (telemetry.mode !== 'shot') {
      const persp = camera as THREE.PerspectiveCamera
      if (persp.fov !== BASE_FOV) {
        persp.fov = BASE_FOV
        persp.updateProjectionMatrix()
      }
      homeFlight(camera, pointer, dt)
      return
    }

    // scroll suavizado: a bala desacelera junto com o dedo
    const max = document.documentElement.scrollHeight - innerHeight
    const target = max > 0 ? scrollY / max : 0
    telemetry.p += (target - telemetry.p) * Math.min(1, dt * 5)
    const p = telemetry.p
    const s = distanceAt(p)
    telemetry.s = s

    const kIn = intro(p, pointer)
    let kOut = 0
    if (p < P_SHOT) {
      pos.copy(camA)
      look.copy(lookA)
    } else {
      chase(s)
      // saindo da luneta direto para tras da bala, abrindo o zoom
      kOut = smooth(THREE.MathUtils.clamp((p - P_SHOT) / 0.035, 0, 1))
      pos.lerpVectors(camA, pos, kOut)
      look.lerpVectors(lookA, look, kOut)
    }
    const zoom = kIn * (1 - kOut)
    telemetry.scope = zoom
    const persp = camera as THREE.PerspectiveCamera
    const fov = fovMix(BASE_FOV, SCOPE_FOV, zoom)
    if (Math.abs(persp.fov - fov) > 1e-4) {
      persp.fov = fov
      persp.updateProjectionMatrix()
    }

    // depois do impacto a camera se afasta e orbita a placa
    if (p > P_IMPACT) {
      const k = smooth(THREE.MathUtils.clamp((p - P_IMPACT) / 0.05, 0, 1))
      const a = 0.9 + (p - P_IMPACT) * 4
      camA.set(Math.sin(a) * 4.5, 0.6, Math.cos(a) * 4.5).add(TARGET)
      pos.lerp(camA, k)
      look.lerp(TARGET, k)
    }

    camera.position.copy(pos)
    camera.lookAt(look)

    // shake curto no disparo
    const sk = p - P_SHOT
    if (sk > 0 && sk < 0.03) {
      const amp = Math.exp(-sk * 120) * 0.012
      camera.rotateZ((Math.random() - 0.5) * amp)
      camera.rotateX((Math.random() - 0.5) * amp)
    }
  })

  return null
}
