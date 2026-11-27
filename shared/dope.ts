import { ammoById, simulate, spinDrift } from './ballistics'

// tabela de tiro: zera o fuzil na distancia escolhida e roda o voo inteiro com vento e Coriolis.
// usada pela calculadora do site e pela rota /api/solve, para os dois darem sempre o mesmo numero

export const SIGHT = 0.075 // altura da luneta acima do cano, em metros

export type DopeInput = {
  ammo: string
  range: number
  tempC: number
  pressHPa: number
  wind: number // m/s vindo da direita (positivo) ou da esquerda (negativo)
  zero: number
}

export type DopeRow = {
  s: number
  t: number
  v: number
  mach: number
  drop: number // metros abaixo da linha de visada
  wind: number // metros para a esquerda (positivo)
  energy: number
}

export const dope = (i: DopeInput): DopeRow[] => {
  const a = ammoById(i.ammo)
  const air = { tempC: i.tempC, pressHPa: i.pressHPa }
  const opts = (w: boolean) => ({ air, wind: w && i.wind !== 0, windX: -i.wind, coriolis: true, range: i.range, ammo: a })
  // angulo de zero para a distancia escolhida
  let e = 0
  for (let k = 0; k < 10; k++) e -= (simulate(e, 0, { ...opts(false), range: i.zero })[i.zero].y - SIGHT) / i.zero
  return simulate(e, 0, opts(true)).map((q, s) => ({
    s, t: q.t, v: q.v, mach: q.mach,
    drop: SIGHT - q.y,
    wind: -(q.x + spinDrift(q.t, a.sg)),
    energy: 0.5 * a.mass * q.v * q.v
  }))
}
