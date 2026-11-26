import { AMMO, ENV, RANGE, BC_SI, OMEGA_EARTH, cdG7, dragDecel, soundSpeed, type Sample } from '../../shared/ballistics'
import { SOLUTION, TARGET, MUZZLE } from '../world/layout'
import { tr, num } from '../i18n'

// conteudo de cada etapa: texto, a formula com os valores do instante substituidos, e leituras ao vivo.
// tudo sai da simulacao; nenhum numero aqui e digitado a mao. textos sao getters para trocar de idioma na hora

export const n = num

const S = SOLUTION
const end = S.samples[RANGE]
const G = 9.80665
const T_K = ENV.tempC + 273.15
const LAT = (ENV.latDeg * Math.PI) / 180
const RPM = (AMMO.v0 / 0.254) * 60
const WIND = Math.abs(ENV.windX)
const C = soundSpeed(ENV.tempC)
const E0 = 0.5 * AMMO.mass * AMMO.v0 * AMMO.v0

export const losY = (s: number) => ((TARGET.y - MUZZLE.y) * s) / RANGE
const mrad = (m: number, s: number) => (s > 1 ? (m / s) * 1000 : 0)
const side = (v: number) => (v >= 0 ? tr('à direita', 'right') : tr('à esquerda', 'left'))
// inclinacao da trajetoria em relacao ao horizonte
const pitch = (s: number) => {
  const a = S.samples[Math.max(0, Math.floor(s) - 1)]
  const b = S.samples[Math.min(RANGE, Math.floor(s) + 1)]
  return Math.atan2(b.y - a.y, b.s - a.s) * 1000
}

export type Calc = { formula: string; steps: string[]; result: string; note?: string }
export type Stage = {
  id: string
  tag: string
  title: string
  text: string
  calc: (q: Sample) => Calc
  rows: (q: Sample) => [string, string][]
}

export const INTRO: Stage = {
  id: 'intro',
  get tag() { return tr('00 / SOLUÇÃO DE TIRO', '00 / FIRING SOLUTION') },
  title: '0 m',
  get text() {
    return tr(
      'Antes de tocar no gatilho, o atirador mede vento, temperatura e pressão, e o computador balístico resolve o tiro. Depois do disparo, nada mais depende dele.',
      'Before touching the trigger, the shooter measures wind, temperature and pressure, and the ballistic computer solves the shot. After the shot breaks, nothing depends on him anymore.'
    )
  },
  calc: () => ({
    formula: tr('elevação = θ · R', 'elevation = θ · R'),
    steps: [
      `${n(S.elevMrad, 1)} mrad · ${n(RANGE)} m = ${n((S.elevMrad / 1000) * RANGE, 1)} m ${tr('acima da placa', 'above the plate')}`,
      `${n(S.elevMrad, 1)} mrad = ${n(S.elevMrad * 3.4377, 1)} MOA = ${n(S.elevMrad * 10)} ${tr('cliques de 0,1 mrad', 'clicks of 0.1 mrad')}`
    ],
    result: `${n(S.elevMrad, 1)} mrad ${tr('para cima', 'up')} · ${n(Math.abs(S.azMrad), 1)} mrad ${side(S.azMrad)}`
  }),
  rows: () => [
    [tr('munição', 'cartridge'), `${AMMO.name} ${AMMO.grain} gr`],
    [tr('massa', 'mass'), `${n(AMMO.mass * 1000, 1)} g`],
    [tr('velocidade inicial', 'muzzle velocity'), `${AMMO.v0} m/s`],
    [tr('energia na boca', 'muzzle energy'), `${n(E0)} J`],
    [tr('coef. balístico', 'ballistic coef.'), `G7 ${n(AMMO.bcG7, 3)}`],
    [tr('atmosfera', 'atmosphere'), `${ENV.tempC} °C · ${ENV.pressHPa} hPa · ${n(S.rho, 3)} kg/m³`],
    [tr('vento', 'wind'), `${WIND} m/s, ${tr('90° da direita', '90° from the right')}`],
    ['latitude', `${ENV.latDeg}° N · ${tr('tiro para o norte', 'firing north')}`]
  ]
}

export const SCOPE: Stage = {
  id: 'scope',
  get tag() { return tr('00 / NA LUNETA', '00 / IN THE SCOPE') },
  title: '25×',
  get text() {
    return tr(
      'A placa de um metro, a dois quilômetros, ocupa meio miliradiano no retículo. A elevação já está girada na torre. O vento é segurado no retículo: o centro aponta à direita da placa para o vento trazer a bala de volta.',
      'The one-meter plate, two kilometers away, covers half a milliradian in the reticle. Elevation is already dialed on the turret. Wind is held in the reticle: the center sits right of the plate so the wind carries the bullet back.'
    )
  },
  calc: () => ({
    formula: tr('ângulo = tamanho / distância', 'angle = size / distance'),
    steps: [
      `1 m / ${n(RANGE)} m = ${n(0.5, 2)} mrad`,
      `${tr('vento', 'wind')}: ${n(Math.abs(S.azMrad), 1)} mrad · ${n(RANGE)} m = ${n((Math.abs(S.azMrad) / 1000) * RANGE, 1)} m ${side(S.azMrad)}`
    ],
    result: `${tr('placa na marca de', 'plate on the')} ${n(Math.abs(S.azMrad), 1)} mrad${tr('', ' mark')}`
  }),
  rows: () => [
    [tr('aumento', 'magnification'), '25×'],
    [tr('campo de visão', 'field of view'), `28 mrad (${n(1.6, 1)}°)`],
    [tr('torre de elevação', 'elevation turret'), `${n(S.elevMrad * 10)} ${tr('cliques', 'clicks')}`],
    [tr('segurar vento', 'wind hold'), `${n(Math.abs(S.azMrad), 1)} mrad`],
    [tr('tempo até o alvo', 'time to target'), `${n(end.t, 2)} s`]
  ]
}

export const FLIGHT: (Stage & { to: number })[] = [
  {
    id: 'gravity',
    to: 400,
    get tag() { return tr('01 / GRAVIDADE', '01 / GRAVITY') },
    get title() { return tr('0 a 400 m', '0 to 400 m') },
    get text() {
      return tr(
        `A bala começa a cair no instante em que sai do cano, como uma pedra solta da mão. O cano aponta ${n(S.elevMrad, 1)} mrad para cima: a subida e a queda terminam juntas na placa.`,
        `The bullet starts falling the instant it leaves the muzzle, like a stone dropped from a hand. The barrel points ${n(S.elevMrad, 1)} mrad up: the climb and the fall end together on the plate.`
      )
    },
    calc: (q) => ({
      formula: 'd = ½ · g · t²',
      steps: [`½ · ${n(9.807, 3)} · ${n(q.t, 3)}²`],
      result: `${n(0.5 * G * q.t * q.t, 2)} m`,
      note: tr(
        `queda medida abaixo do eixo do cano: ${n(q.drop, 2)} m. O arrasto não muda a gravidade; ele só alonga o tempo de voo.`,
        `drop measured below the bore axis: ${n(q.drop, 2)} m. Drag does not change gravity; it only stretches the time of flight.`
      )
    }),
    rows: (q) => [
      [tr('tempo', 'time'), `${n(q.t, 3)} s`],
      [tr('velocidade', 'velocity'), `${n(q.v)} m/s`],
      [tr('acima da linha de visada', 'above line of sight'), `${n(q.y - losY(q.s), 2)} m`],
      [tr('inclinação da trajetória', 'trajectory angle'), `${n(pitch(q.s), 1)} mrad`]
    ]
  },
  {
    id: 'wind',
    to: 900,
    get tag() { return tr('02 / VENTO', '02 / WIND') },
    get title() { return tr('400 a 900 m', '400 to 900 m') },
    get text() {
      return tr(
        'O vento empurra a bala pelo atraso que o arrasto impõe: o tempo real de voo menos o tempo que ela levaria no vácuo. Por isso uma bala de coeficiente balístico alto deriva menos, mesmo voando o mesmo tempo.',
        'Wind pushes the bullet by the lag that drag imposes: real time of flight minus the time it would take in a vacuum. That is why a high-BC bullet drifts less, even when flying the same time.'
      )
    },
    calc: (q) => {
      const lag = q.t - q.s / AMMO.v0
      return {
        formula: 'WD = Vw · (t − R / V0)',
        steps: [`${WIND} · (${n(q.t, 3)} − ${n(q.s)} / ${AMMO.v0})`, `${WIND} · ${n(lag, 3)}`],
        result: `${n(WIND * lag, 2)} m`,
        note: `${tr('simulação 3D', '3D simulation')}: ${n(Math.abs(q.wind), 2)} m (${n(mrad(Math.abs(q.wind), q.s), 2)} mrad)`
      }
    },
    rows: (q) => [
      [tr('vento cruzado', 'crosswind'), `${WIND} m/s`],
      [tr('tempo de voo', 'time of flight'), `${n(q.t, 3)} s`],
      [tr('tempo no vácuo', 'vacuum time'), `${n(q.s / AMMO.v0, 3)} s`],
      [tr('velocidade', 'velocity'), `${n(q.v)} m/s`]
    ]
  },
  {
    id: 'density',
    to: 1300,
    get tag() { return tr('03 / DENSIDADE DO AR', '03 / AIR DENSITY') },
    get title() { return tr('900 a 1300 m', '900 to 1300 m') },
    get text() {
      return tr(
        `O arrasto cresce com a densidade do ar. A ${ENV.tempC} °C e ${ENV.pressHPa} hPa o ar pesa ${n((1 - S.rho / 1.225) * 100)}% menos que no nível do mar, e a bala perde velocidade mais devagar.`,
        `Drag grows with air density. At ${ENV.tempC} °C and ${ENV.pressHPa} hPa the air weighs ${n((1 - S.rho / 1.225) * 100)}% less than at sea level, and the bullet sheds speed more slowly.`
      )
    },
    calc: (q) => {
      const cd = cdG7(q.mach)
      return {
        formula: 'a = ρ · v² · Cd · π / (8 · BC)',
        steps: [
          `ρ = ${n(ENV.pressHPa * 100)} / (${n(287.05, 2)} · ${n(T_K, 2)}) = ${n(S.rho, 3)} kg/m³`,
          `a = ${n(S.rho, 3)} · ${n(q.v)}² · ${n(cd, 3)} · π / (8 · ${n(BC_SI)})`
        ],
        result: `${n(dragDecel(S.rho, q.v, q.mach))} m/s²`,
        note: tr(
          `num dia padrão (1,225 kg/m³) a bala estaria ${n(q.density, 2)} m mais baixa neste ponto.`,
          `on a standard day (1.225 kg/m³) the bullet would be ${n(q.density, 2)} m lower at this point.`
        )
      }
    },
    rows: (q) => [
      [tr('velocidade', 'velocity'), `${n(q.v)} m/s`],
      ['mach', n(q.mach, 2)],
      ['Cd (G7)', n(cdG7(q.mach), 3)],
      [tr('energia', 'energy'), `${n(q.energy)} J (${n((q.energy / E0) * 100)}%)`]
    ]
  },
  {
    id: 'transonic',
    to: 1650,
    get tag() { return tr('04 / BARREIRA DO SOM', '04 / SOUND BARRIER') },
    get title() { return tr('1300 a 1650 m', '1300 to 1650 m') },
    get text() {
      return tr(
        `Perto de Mach 1 o coeficiente de arrasto dispara e a onda de choque passa por cima do corpo da bala. É o trecho mais instável do voo. Aos ${n(S.subsonicAt)} m ela fica subsônica e o cone de choque desaparece.`,
        `Near Mach 1 the drag coefficient spikes and the shock wave slides over the bullet body. It is the least stable part of the flight. At ${n(S.subsonicAt)} m it goes subsonic and the shock cone disappears.`
      )
    },
    calc: (q) => {
      const steps = [`c = ${n(20.05, 2)} · √${n(T_K, 2)} = ${n(C, 1)} m/s`, `M = ${n(q.v)} / ${n(C, 1)} = ${n(q.mach, 3)}`]
      if (q.mach > 1) steps.push(`μ = ${tr('arcsen', 'arcsin')}(1 / ${n(q.mach, 3)}) = ${n((Math.asin(1 / q.mach) * 180) / Math.PI, 1)}°`)
      else steps.push(tr('M < 1: não existe mais cone de choque', 'M < 1: there is no shock cone anymore'))
      return {
        formula: `M = v / c · μ = ${tr('arcsen', 'arcsin')}(1 / M)`,
        steps,
        result: q.mach > 1.2 ? tr('supersônica', 'supersonic') : q.mach > 1 ? tr('transônica', 'transonic') : tr('subsônica', 'subsonic')
      }
    },
    rows: (q) => [
      [tr('velocidade', 'velocity'), `${n(q.v)} m/s`],
      [tr('Cd agora', 'Cd now'), n(cdG7(q.mach), 3)],
      [tr('Cd na boca', 'Cd at muzzle'), n(cdG7(AMMO.v0 / C), 3)],
      [tr('tempo', 'time'), `${n(q.t, 2)} s`]
    ]
  },
  {
    id: 'spin',
    to: 1850,
    get tag() { return '05 / SPIN DRIFT' },
    get title() { return tr('1650 a 1850 m', '1650 to 1850 m') },
    get text() {
      return tr(
        `O raiamento ${AMMO.twist} faz a bala girar a mais de ${n(Math.floor(RPM / 1000))} mil rpm. O giro a mantém estável, mas o nariz fica um pouco acima da trajetória e a sustentação empurra a bala para o lado do giro, à direita, sem vento nenhum.`,
        `The ${AMMO.twist} rifling spins the bullet at over ${n(Math.floor(RPM / 1000))} thousand rpm. Spin keeps it stable, but the nose rides slightly above the trajectory and the resulting lift pushes the bullet toward the spin, to the right, with no wind at all.`
      )
    },
    calc: (q) => ({
      formula: `SD = ${n(1.25, 2)} · (SG + ${n(1.2, 1)}) · t^${n(1.83, 2)}`,
      steps: [
        `${tr('rotação', 'spin')} = ${AMMO.v0} / ${n(0.254, 3)} · 60 = ${n(RPM)} rpm`,
        `${n(1.25, 2)} · (${n(AMMO.sg, 1)} + ${n(1.2, 1)}) · ${n(q.t, 3)}^${n(1.83, 2)} = ${n(q.spin / 0.0254, 1)} ${tr('pol', 'in')}`
      ],
      result: `${n(q.spin, 2)} m ${tr('à direita', 'right')}`
    }),
    rows: (q) => [
      [tr('estabilidade SG', 'stability SG'), n(AMMO.sg, 1)],
      [tr('deriva de giro', 'spin drift'), `${n(mrad(q.spin, q.s), 2)} mrad`],
      ['mach', n(q.mach, 2)],
      [tr('tempo', 'time'), `${n(q.t, 2)} s`]
    ]
  },
  {
    id: 'coriolis',
    to: RANGE + 1,
    get tag() { return '06 / CORIOLIS' },
    get title() { return tr('1850 a 2000 m', '1850 to 2000 m') },
    get text() {
      return tr(
        `Durante ${n(end.t, 1)} segundos de voo a Terra gira por baixo da bala. No hemisfério norte o impacto se desloca para a direita. A dois quilômetros isso já são ${n(end.corH * 100)} centímetros.`,
        `During ${n(end.t, 1)} seconds of flight the Earth turns under the bullet. In the northern hemisphere the impact shifts to the right. At two kilometers that is already ${n(end.corH * 100)} centimeters.`
      )
    },
    calc: (q) => ({
      formula: `X ≈ Ω · R · t · ${tr('sen', 'sin')} λ`,
      steps: [`${n(OMEGA_EARTH * 1e5, 3)}·10⁻⁵ · ${n(q.s)} · ${n(q.t, 2)} · ${tr('sen', 'sin')} ${ENV.latDeg}°`],
      result: `${n(OMEGA_EARTH * q.s * q.t * Math.sin(LAT) * 100, 1)} cm`,
      note: tr(
        `simulação com −2Ω × v completo: ${n(q.corH * 100, 1)} cm. A fórmula supõe velocidade média; a integração passo a passo é mais exata.`,
        `simulation with full −2Ω × v: ${n(q.corH * 100, 1)} cm. The formula assumes average velocity; step-by-step integration is more accurate.`
      )
    }),
    rows: (q) => [
      [tr('rotação da Terra', 'Earth rotation'), `${n(7.292, 3)}·10⁻⁵ rad/s`],
      ['latitude', `${ENV.latDeg}° N`],
      [tr('tempo de voo', 'time of flight'), `${n(q.t, 2)} s`],
      [tr('velocidade', 'velocity'), `${n(q.v)} m/s`]
    ]
  }
]

const lateral = end.wind + end.spin + end.corH

export const IMPACT: Stage = {
  id: 'impact',
  get tag() { return tr('07 / IMPACTO', '07 / IMPACT') },
  get title() { return `${n(RANGE)} m` },
  get text() {
    return tr(
      `Sem nenhuma correção, a bala teria passado ${n(end.drop, 1)} m abaixo e ${n(Math.abs(lateral), 1)} m ${side(lateral)} da placa. Tudo isso foi resolvido antes do disparo.`,
      `With no correction at all, the bullet would have passed ${n(end.drop, 1)} m low and ${n(Math.abs(lateral), 1)} m ${side(lateral)} of the plate. All of it was solved before the shot.`
    )
  },
  calc: () => ({
    formula: tr('soma dos desvios', 'sum of deflections'),
    steps: [
      `${tr('gravidade', 'gravity')}: ${n(end.drop, 1)} m ${tr('abaixo', 'low')}`,
      `${tr('vento', 'wind')}: ${n(Math.abs(end.wind), 2)} m ${side(end.wind)}`,
      `spin drift: ${n(end.spin, 2)} m ${side(end.spin)}`,
      `Coriolis: ${n(end.corH * 100, 1)} cm ${side(end.corH)}`
    ],
    result: `${n(S.elevMrad, 1)} mrad ${tr('acima', 'up')} · ${n(Math.abs(S.azMrad), 1)} mrad ${side(S.azMrad)}`
  }),
  rows: () => [
    [tr('tempo de voo', 'time of flight'), `${n(end.t, 2)} s`],
    [tr('velocidade no alvo', 'impact velocity'), `${n(end.v)} m/s (Mach ${n(end.mach, 2)})`],
    [tr('energia no alvo', 'impact energy'), `${n(end.energy)} J (${n((end.energy / E0) * 100)}% ${tr('da boca', 'of muzzle')})`],
    [tr('ângulo de chegada', 'descent angle'), `${n(Math.abs(pitch(RANGE - 1)), 1)} mrad ${tr('descendo', 'down')}`]
  ]
}
