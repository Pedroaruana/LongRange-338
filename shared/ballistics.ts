// motor balistico de massa pontual com arrasto G7, vento, Coriolis e spin drift (Litz)
// eixos: x = leste (direita), y = cima, d = alcance (norte, para frente)

export type Ammo = {
  id: string
  name: string
  bullet: string
  grain: number
  v0: number
  bcG7: number
  mass: number
  sg: number
  twist: string
}

// municoes de precisao com dados de fabrica (velocidade de cano tipica e BC G7 publicado)
export const AMMOS: Ammo[] = [
  { id: '338', name: '.338 Lapua Magnum', bullet: 'Scenar 250 gr', grain: 250, v0: 915, bcG7: 0.31, mass: 0.0162, sg: 2.1, twist: '1:10"' },
  { id: '308', name: '.308 Winchester', bullet: 'Sierra MatchKing 175 gr', grain: 175, v0: 790, bcG7: 0.243, mass: 0.01134, sg: 1.7, twist: '1:11,25"' },
  { id: '65', name: '6.5 Creedmoor', bullet: 'Hornady ELD-M 140 gr', grain: 140, v0: 825, bcG7: 0.326, mass: 0.00907, sg: 1.9, twist: '1:8"' },
  { id: '50', name: '.50 BMG', bullet: 'Hornady A-MAX 750 gr', grain: 750, v0: 860, bcG7: 0.52, mass: 0.0486, sg: 2.0, twist: '1:15"' }
]

// a municao do tiro de 2000 m
export const AMMO = AMMOS[0]
export const ammoById = (id: string) => AMMOS.find((a) => a.id === id) ?? AMMO

export const ENV = {
  tempC: 31,
  pressHPa: 912,
  windX: -5, // vento de 5 m/s vindo da direita (3h)
  latDeg: 36
}

export const RANGE = 2000
const RANGE_FULL = RANGE
const G = 9.80665
const OMEGA = 7.292115e-5
const R_AIR = 287.05

// tabela padrao G7: [mach, Cd]
const G7: [number, number][] = [
  [0, 0.1198], [0.5, 0.1197], [0.7, 0.1196], [0.8, 0.1194], [0.85, 0.1194], [0.875, 0.1213],
  [0.9, 0.1286], [0.925, 0.1478], [0.95, 0.1884], [0.975, 0.2701], [1.0, 0.3803], [1.025, 0.4015],
  [1.05, 0.4043], [1.1, 0.4014], [1.15, 0.3955], [1.2, 0.3884], [1.3, 0.3732], [1.4, 0.358],
  [1.5, 0.344], [1.6, 0.3315], [1.8, 0.3093], [2.0, 0.2904], [2.2, 0.2745], [2.4, 0.2609],
  [2.6, 0.2494], [2.8, 0.2392], [3.0, 0.2302], [4.0, 0.1983]
]

export const BC_SI = AMMO.bcG7 * 703.0696 // lb/in² para kg/m²
export const OMEGA_EARTH = 7.292115e-5

export const cdG7 = (m: number) => {
  if (m <= G7[0][0]) return G7[0][1]
  for (let i = 1; i < G7.length; i++) {
    const [m1, c1] = G7[i]
    if (m <= m1) {
      const [m0, c0] = G7[i - 1]
      return c0 + ((c1 - c0) * (m - m0)) / (m1 - m0)
    }
  }
  return G7[G7.length - 1][1]
}

type Air = { tempC: number; pressHPa: number }
// windX e range opcionais: o simulador de treino usa outros ventos e alcances
type Opts = { air: Air; wind: boolean; coriolis: boolean; windX?: number; range?: number; ammo?: Ammo }
export type Point = { x: number; y: number; t: number; v: number; mach: number }
export const STD_AIR: Air = { tempC: ENV.tempC, pressHPa: ENV.pressHPa }

export const airDensity = ({ tempC, pressHPa }: Air) => (pressHPa * 100) / (R_AIR * (tempC + 273.15))
export const soundSpeed = (tempC: number) => 20.05 * Math.sqrt(tempC + 273.15)

// desaceleracao por arrasto: a = rho * v^2 * Cd(M) * pi / (8 * BC)
export const dragDecel = (rho: number, v: number, mach: number) => (rho * v * v * cdG7(mach) * Math.PI) / (8 * BC_SI)

export const simulate = (elev: number, az: number, o: Opts): Point[] => {
  const A = o.ammo ?? AMMO
  const rho = airDensity(o.air)
  const c = soundSpeed(o.air.tempC)
  const k = (rho * Math.PI) / (8 * A.bcG7 * 703.0696)
  const lat = (ENV.latDeg * Math.PI) / 180
  const om = o.coriolis ? [0, OMEGA * Math.sin(lat), OMEGA * Math.cos(lat)] : [0, 0, 0]
  const wx = o.wind ? (o.windX ?? ENV.windX) : 0
  const RANGE = o.range ?? RANGE_FULL

  const acc = (vx: number, vy: number, vd: number) => {
    const rx = vx - wx
    const sp = Math.hypot(rx, vy, vd)
    const a = k * cdG7(sp / c) * sp
    // -2 Omega x v; o sistema (leste, cima, norte) e de mao esquerda, entao o produto vetorial troca de sinal
    const cx = 2 * (om[1] * vd - om[2] * vy)
    const cy = 2 * (om[2] * vx - om[0] * vd)
    const cd = 2 * (om[0] * vy - om[1] * vx)
    return [-a * rx + cx, -a * vy - G + cy, -a * vd + cd]
  }

  let x = 0, y = 0, d = 0, t = 0
  let vx = A.v0 * Math.cos(elev) * Math.sin(az)
  let vy = A.v0 * Math.sin(elev)
  let vd = A.v0 * Math.cos(elev) * Math.cos(az)
  const dt = 0.0004
  const out: Point[] = [{ x: 0, y: 0, t: 0, v: A.v0, mach: A.v0 / c }]

  while (out.length <= RANGE && t < 10) {
    // ponto medio (RK2)
    const a1 = acc(vx, vy, vd)
    const mx = vx + a1[0] * dt * 0.5, my = vy + a1[1] * dt * 0.5, md = vd + a1[2] * dt * 0.5
    const a2 = acc(mx, my, md)
    const nx = x + mx * dt, ny = y + my * dt, nd = d + md * dt
    const nvx = vx + a2[0] * dt, nvy = vy + a2[1] * dt, nvd = vd + a2[2] * dt

    // registra cada metro inteiro cruzado neste passo
    while (out.length <= RANGE && nd >= out.length) {
      const f = (out.length - d) / (nd - d)
      const v = Math.hypot(vx + (nvx - vx) * f, vy + (nvy - vy) * f, vd + (nvd - vd) * f)
      out.push({ x: x + (nx - x) * f, y: y + (ny - y) * f, t: t + dt * f, v, mach: v / c })
    }
    x = nx; y = ny; d = nd; vx = nvx; vy = nvy; vd = nvd; t += dt
  }
  return out
}

export const spinDrift = (t: number, sg = AMMO.sg) => 1.25 * (sg + 1.2) * Math.pow(t, 1.83) * 0.0254

export type Sample = {
  s: number; x: number; y: number; t: number; v: number; mach: number; energy: number
  drop: number; wind: number; spin: number; corH: number; corV: number; density: number
}

export type Solution = {
  samples: Sample[]
  elevMrad: number
  azMrad: number
  rho: number
  c: number
  transonicAt: number
  subsonicAt: number
}

// resolve elevacao e deriva para acertar um alvo a `ty` metros acima/abaixo do cano
export const solve = (ty: number): Solution => {
  const air = { tempC: ENV.tempC, pressHPa: ENV.pressHPa }
  const full = { air, wind: true, coriolis: true }
  let elev = 0, az = 0
  for (let i = 0; i < 12; i++) {
    const end = simulate(elev, az, full)[RANGE]
    elev -= (end.y - ty) / RANGE
    az -= (end.x + spinDrift(end.t)) / RANGE
  }

  const p = simulate(elev, az, full)
  const noWind = simulate(elev, az, { ...full, wind: false })
  const noCor = simulate(elev, az, { ...full, coriolis: false })
  const std = simulate(elev, az, { ...full, air: { tempC: 15, pressHPa: 1013.25 } })

  const samples = p.map((q, s): Sample => {
    const spin = spinDrift(q.t)
    return {
      s, t: q.t, v: q.v, mach: q.mach,
      x: q.x + spin,
      y: q.y,
      energy: 0.5 * AMMO.mass * q.v * q.v,
      drop: s * Math.tan(elev) - q.y,
      wind: q.x - noWind[s].x,
      spin,
      corH: q.x - noCor[s].x,
      corV: q.y - noCor[s].y,
      density: q.y - std[s].y
    }
  })

  return {
    samples,
    elevMrad: elev * 1000,
    azMrad: az * 1000,
    rho: airDensity(air),
    c: soundSpeed(ENV.tempC),
    transonicAt: samples.find((q) => q.mach < 1.2)?.s ?? RANGE,
    subsonicAt: samples.find((q) => q.mach < 1)?.s ?? RANGE
  }
}

export const sampleAt = (sol: Solution, s: number): Sample => {
  const i = Math.max(0, Math.min(RANGE - 1, Math.floor(s)))
  const a = sol.samples[i], b = sol.samples[i + 1]
  const f = Math.max(0, Math.min(1, s - i))
  const out = { ...a }
  for (const key of Object.keys(a) as (keyof Sample)[]) out[key] = a[key] + (b[key] - a[key]) * f
  return out
}
