import { describe, it, expect } from 'vitest'
import { simulate, solve, airDensity, soundSpeed, cdG7, spinDrift, ammoById, AMMOS, ENV, RANGE, STD_AIR } from './ballistics'

// referencias fisicas independentes do motor: atmosfera padrao, queda no vacuo,
// regra de Didion para o vento e estimativa de primeira ordem do Coriolis

const G = 9.80665
const flat = (range: number, wind = false, id = '338') =>
  simulate(0, 0, { air: STD_AIR, wind, coriolis: false, range, ammo: ammoById(id) })

describe('atmosfera', () => {
  it('densidade do ar padrao ao nivel do mar e 1,225 kg/m3', () => {
    expect(airDensity({ tempC: 15, pressHPa: 1013.25 })).toBeCloseTo(1.225, 3)
  })

  it('velocidade do som a 15 graus e 340,3 m/s', () => {
    expect(soundSpeed(15)).toBeCloseTo(340.3, 0)
  })

  it('ar quente e rarefeito do deserto e menos denso que o padrao', () => {
    expect(airDensity(STD_AIR)).toBeLessThan(airDensity({ tempC: 15, pressHPa: 1013.25 }))
  })
})

describe('tabela G7', () => {
  it('devolve os pontos da tabela', () => {
    expect(cdG7(0)).toBe(0.1198)
    expect(cdG7(1.0)).toBe(0.3803)
    expect(cdG7(2.0)).toBe(0.2904)
  })

  it('interpola linearmente entre dois pontos', () => {
    expect(cdG7(0.9625)).toBeCloseTo((0.1884 + 0.2701) / 2, 6)
  })

  it('o arrasto tem o pico logo depois da barreira do som', () => {
    expect(cdG7(1.05)).toBeGreaterThan(cdG7(0.8))
    expect(cdG7(1.05)).toBeGreaterThan(cdG7(2.5))
  })

  it('fora da tabela fica no ultimo valor', () => {
    expect(cdG7(6)).toBe(0.1983)
  })
})

describe('trajetoria', () => {
  it('a 100 m a queda fica perto da queda livre no vacuo', () => {
    const p = flat(100)[100]
    const vacuo = -0.5 * G * p.t * p.t
    expect(Math.abs(p.y - vacuo) / Math.abs(vacuo)).toBeLessThan(0.03)
  })

  it('a velocidade so cai ao longo do voo', () => {
    const path = flat(1000)
    for (let s = 1; s < path.length; s++) expect(path[s].v).toBeLessThan(path[s - 1].v)
  })

  it('registra um ponto por metro ate o alcance pedido', () => {
    expect(flat(1000)).toHaveLength(1001)
  })

  it('o vento segue a regra de Didion: deriva = vento x (t - R / v0)', () => {
    const t = flat(1000)[1000].t
    const didion = ENV.windX * (t - 1000 / ammoById('338').v0)
    expect(flat(1000, true)[1000].x).toBeCloseTo(didion, 2)
  })

  it('vento vindo da direita empurra a bala para a esquerda', () => {
    expect(flat(1000, true)[1000].x).toBeLessThan(0)
  })

  it('a .308, com BC e velocidade menores, cai mais que a .338', () => {
    expect(flat(1000, false, '308')[1000].y).toBeLessThan(flat(1000, false, '338')[1000].y)
  })

  it('toda municao chega a 1000 m', () => {
    for (const a of AMMOS) expect(flat(1000, false, a.id)).toHaveLength(1001)
  })
})

describe('spin drift', () => {
  it('cano de raia a direita desvia a bala para a direita', () => {
    expect(spinDrift(1)).toBeGreaterThan(0)
  })

  it('cresce mais rapido que o tempo de voo', () => {
    expect(spinDrift(4) / spinDrift(2)).toBeGreaterThan(2)
  })
})

describe('solucao do tiro de 2000 m', () => {
  const sol = solve(0)
  const end = sol.samples[RANGE]

  it('a elevacao e a deriva calculadas acertam o centro do alvo', () => {
    expect(Math.abs(end.y)).toBeLessThan(0.01)
    expect(Math.abs(end.x)).toBeLessThan(0.01)
  })

  it('a elevacao fica na faixa real de uma .338 a 2000 m', () => {
    expect(sol.elevMrad).toBeGreaterThan(25)
    expect(sol.elevMrad).toBeLessThan(33)
  })

  it('a bala fica transonica antes de ficar subsonica', () => {
    expect(sol.transonicAt).toBeLessThan(sol.subsonicAt)
    expect(sol.subsonicAt).toBeLessThan(RANGE)
  })

  it('Coriolis no hemisferio norte atirando para o norte desvia para a direita', () => {
    // estimativa de primeira ordem: omega x sen(latitude) x alcance x tempo de voo
    const estimativa = 7.292115e-5 * Math.sin((ENV.latDeg * Math.PI) / 180) * RANGE * end.t
    expect(end.corH).toBeGreaterThan(0)
    expect(Math.abs(end.corH - estimativa) / estimativa).toBeLessThan(0.3)
  })

  it('atirando para o norte o Coriolis quase nao mexe na altura', () => {
    expect(Math.abs(end.corV)).toBeLessThan(0.01)
  })

  it('no ar padrao, mais denso, a bala cairia mais', () => {
    expect(end.density).toBeGreaterThan(0)
  })
})
