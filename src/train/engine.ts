import * as THREE from 'three'
import { simulate, spinDrift as spinFor, AMMO, type Ammo } from '../ballistics'
import { SCOPE_EYE } from '../world/layout'
import { heightAt } from '../world/height'

// escola de tiro: mesma fisica do tiro de 2000 m, com o fuzil zerado em 100 m no ar do cenario.
// a correcao vai no retículo (segurar) ou na torre (girar), como num campo de tiro de verdade

export type Air = { tempC: number; pressHPa: number }

export const EYE = SCOPE_EYE.clone()
const SIGHT = 0.075 // luneta 7,5 cm acima do cano
export const BORE = EYE.clone().add(new THREE.Vector3(0, -SIGHT, 0))
const MAX_RANGE = 1500

// municao em uso no treino (escolhida na preparacao)
export const gun = { ammo: AMMO as Ammo }
const spinDrift = (t: number) => spinFor(t, gun.ammo.sg)

const shoot = (elev: number, az: number, windX: number, air: Air) =>
  simulate(elev, az, { air, wind: windX !== 0, windX, coriolis: true, range: MAX_RANGE, ammo: gun.ammo })

// angulo de zero: a bala cruza a linha de visada exatamente a 100 m. muda com o ar e a municao
const zeros = new Map<string, number>()
export const zeroFor = (air: Air) => {
  const key = `${gun.ammo.id}/${air.tempC}/${air.pressHPa}`
  let e = zeros.get(key)
  if (e === undefined) {
    e = 0
    for (let i = 0; i < 10; i++) e -= (shoot(e, 0, 0, air)[100].y - SIGHT) / 100
    zeros.set(key, e)
  }
  return e
}

export type Plate = { id: number; d: number; base: THREE.Vector3; move?: { amp: number; speed: number } }

// placas de 1 x 1 m espalhadas pelo corredor; a ultima anda de um lado para o outro
const DEF: [number, number][] = [[300, -7], [400, 8], [500, -12], [600, 5], [800, -9], [1000, 13], [1300, -3]]
export const PLATES: Plate[] = DEF.map(([d, x], id) => {
  const z = EYE.z - d
  return { id, d, base: new THREE.Vector3(x, heightAt(x, z) + 1.05, z) }
})
export const MOVER = PLATES.length
PLATES.push({ id: MOVER, d: 450, base: new THREE.Vector3(1, heightAt(1, EYE.z - 450) + 1.05, EYE.z - 450), move: { amp: 7, speed: 2 } })
export const PLATE_HALF = 0.5

// posicao no tempo: vai e volta em velocidade constante (onda triangular)
export const platePos = (pl: Plate, time: number, out = new THREE.Vector3()) => {
  out.copy(pl.base)
  if (!pl.move) return out
  const period = (4 * pl.move.amp) / pl.move.speed
  const ph = (((time % period) + period) % period) / period
  out.x += pl.move.amp * (ph < 0.5 ? -1 + 4 * ph : 3 - 4 * ph)
  return out
}
export const plateVel = (pl: Plate, time: number) => {
  if (!pl.move) return 0
  const period = (4 * pl.move.amp) / pl.move.speed
  const ph = (((time % period) + period) % period) / period
  return ph < 0.5 ? pl.move.speed : -pl.move.speed
}

export const losDir = (yaw: number, pitch: number, out = new THREE.Vector3()) =>
  out.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch))

export const anglesTo = (p: THREE.Vector3) => {
  const v = p.clone().sub(EYE)
  return { yaw: Math.atan2(v.x, -v.z), pitch: Math.atan2(v.y, Math.hypot(v.x, v.z)) }
}

// tabela de tiro com zero em 100 m: queda (positiva = abaixo) e deriva (negativa = esquerda), em mrad
export const dope = (d: number, windX: number, air: Air) => {
  const q = shoot(zeroFor(air), 0, windX, air)[d]
  return { drop: (-(q.y - SIGHT) / d) * 1000, wind: ((q.x + spinDrift(q.t)) / d) * 1000, t: q.t, v: q.v }
}

export type Shot = {
  path: THREE.Vector3[]
  times: number[]
  tImpact: number
  impact: THREE.Vector3
  hit: Plate | null
  // desvio no plano da placa visada, em mrad (cima e direita positivos)
  up: number
  right: number
  target: Plate
  // onde a placa estava quando a bala chegou (para a marca e o grafico de agrupamento)
  local: { x: number; y: number } | null
}

export const fire = (
  yaw: number, pitch: number, windX: number, target: Plate, air: Air, fireTime: number, active: (p: Plate) => boolean
): Shot => {
  const pts = shoot(pitch + zeroFor(air), yaw, windX, air)
  const path: THREE.Vector3[] = []
  const times: number[] = []
  let hit: Plate | null = null
  let end = pts.length - 1
  let local: Shot['local'] = null
  const pp = new THREE.Vector3()

  for (let i = 0; i < pts.length; i++) {
    const q = pts[i]
    const p = new THREE.Vector3(BORE.x + q.x + spinDrift(q.t), BORE.y + q.y, BORE.z - i)
    path.push(p)
    times.push(q.t)
    if (i < 5) continue
    const plate = PLATES.find((pl) => pl.d === i && active(pl))
    if (plate) {
      platePos(plate, fireTime + q.t, pp)
      if (Math.abs(p.x - pp.x) < PLATE_HALF && Math.abs(p.y - pp.y) < PLATE_HALF) {
        hit = plate
        local = { x: p.x - pp.x, y: p.y - pp.y }
        end = i
        break
      }
    }
    if (p.y < heightAt(p.x, p.z)) {
      end = i
      break
    }
  }

  const at = pts[Math.min(target.d, pts.length - 1)]
  const tp = platePos(target, fireTime + at.t)
  const dx = BORE.x + at.x + spinDrift(at.t) - tp.x
  const dy = BORE.y + at.y - tp.y
  return {
    path: path.slice(0, end + 1),
    times: times.slice(0, end + 1),
    tImpact: times[end],
    impact: path[end].clone(),
    hit,
    up: (dy / target.d) * 1000,
    right: (dx / target.d) * 1000,
    target,
    local: local ?? { x: dx, y: dy }
  }
}
