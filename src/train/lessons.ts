import { PLATES, MOVER, dope, gun, type Shot } from './engine'
import { ammoById } from '../../shared/ballistics'
import { byRank, type Score, type ScoreInput } from '../../shared/ranking'
import { api } from '../api'
import { tr } from '../i18n'
import { scopeById, toUnit, unitLabel, clicks, type Scope } from './scopes'
import { scenario } from '../world/scenarios'
import { n } from '../hud/stages'

// estado mutavel do treino, lido pela cena 3D (todo quadro) e pelo painel (a cada 70 ms)
export const train = {
  phase: 'setup' as 'setup' | 'run',
  mode: 'lessons' as 'lessons' | 'free',
  scenarioId: 'desert',
  scopeId: 'tactical',
  lesson: 0,
  target: 3,
  windX: 0,
  windOn: true, // so no treino livre
  mag: 20,
  breath: 1,
  holding: false,
  shot: null as Shot | null,
  shotStart: 0,
  resolved: false,
  shots: 0,
  hits: 0,
  answer: null as number | null,
  dialElev: 0, // torre de elevacao, em mrad
  dialWind: 0, // torre de deriva, em mrad (positivo = direita)
  log: [] as { d: number; hit: boolean; up: number; right: number }[],
  locked: false, // mouse travado na luneta
  ammoId: '338',
  replay: 0, // instante em que o replay lateral comecou (0 = sem replay)
  gusts: false, // rajadas: o vento muda de forca durante a prova e no treino livre
  saved: false, // a prova atual ja foi gravada no ranking
  // resultado do ultimo tiro para o aviso fixo embaixo da luneta
  mark: null as { x: number; y: number; hit: boolean; age: number } | null
}

// so em desenvolvimento: permite inspecionar e testar o treino pelo console
if (import.meta.env.DEV) (window as Window & { __train?: typeof train }).__train = train

export const air = () => scenario.current.air
export const windFromScenario = () => -scenario.current.wind
// as licoes usam sempre a luneta tatica: as explicacoes falam da arvore de Natal
export const activeScope = (): Scope => scopeById(train.mode === 'lessons' ? 'tactical' : train.scopeId)

export type Lesson = {
  id: string
  num: string
  title: string
  body: () => string[]
  task: () => string
  wind: boolean
  target: () => number
  kind: 'shoot' | 'range'
  options?: number[]
  shots?: number
  after?: (s: Shot) => string
  // numeros principais da licao, mostrados grandes no painel
  big?: () => [string, string][]
}

const side = (v: number) => (v >= 0 ? tr('à direita', 'right') : tr('à esquerda', 'left'))
const vert = (v: number) => (v >= 0 ? tr('acima', 'high') : tr('abaixo', 'low'))
export const hitTarget = (s: Shot) => s.hit?.id === s.target.id
export const missText = (s: Shot) =>
  hitTarget(s) ? tr(`Acertou a placa de ${s.target.d} m.`, `Hit the ${s.target.d} m plate.`)
  : s.hit ? tr(`Acertou a placa de ${s.hit.d} m, não a de ${s.target.d} m.`, `Hit the ${s.hit.d} m plate, not the ${s.target.d} m one.`)
  : tr(
    `Passou ${n(Math.abs(s.up), 1)} mrad ${vert(s.up)} e ${n(Math.abs(s.right), 1)} mrad ${side(s.right)} do centro da placa de ${s.target.d} m.`,
    `Went ${n(Math.abs(s.up), 1)} mrad ${vert(s.up)} and ${n(Math.abs(s.right), 1)} mrad ${side(s.right)} of the ${s.target.d} m plate center.`
  )

const W = () => scenario.current.wind
const at = (d: number, wind: boolean) => dope(d, wind ? windFromScenario() : 0, air())
const clk = (mrad: number) => Math.round(Math.abs(mrad) * 10)

export const TEST_PLATES = [3, 4, 5, 6]

export const LESSONS: Lesson[] = [
  {
    id: 'mrad',
    num: '01',
    get title() { return tr('O miliradiano', 'The milliradian') },
    body: () => [
      tr(
        'Um miliradiano (mrad) é um ângulo: 1 metro visto a 1000 metros. A 100 m ele cobre 10 cm, a 600 m cobre 60 cm.',
        'A milliradian (mrad) is an angle: 1 meter seen from 1000 meters. At 100 m it covers 10 cm, at 600 m it covers 60 cm.'
      ),
      tr(
        'Cada traço longo do retículo marca 1 mrad e os curtos, meio. O fuzil está zerado em 100 m: só nessa distância a bala cai exatamente no centro.',
        'Each long reticle hash marks 1 mrad and the short ones half. The rifle is zeroed at 100 m: only at that distance does the bullet land exactly on the center.'
      )
    ],
    task: () => tr('Ponha o centro vermelho na placa de 600 m e clique para atirar.', 'Put the red center on the 600 m plate and click to fire.'),
    wind: false,
    target: () => 3,
    kind: 'shoot',
    big: () => [[tr('1 mrad a 100 m', '1 mrad at 100 m'), '10 cm'], [tr('1 mrad a 600 m', '1 mrad at 600 m'), '60 cm']],
    after: (s) => `${missText(s)} ${tr(
      `Com o centro na placa, a 600 m a bala cai ${n(at(600, false).drop, 1)} mrad: é por isso que existe a escada abaixo do centro.`,
      `With the center on the plate, at 600 m the bullet drops ${n(at(600, false).drop, 1)} mrad: that is why there is a ladder below the center.`
    )}`
  },
  {
    id: 'range',
    num: '02',
    get title() { return tr('Medir a distância', 'Ranging a target') },
    body: () => [
      tr('A placa tem 1 metro de altura. Medida no retículo, distância = altura × 1000 / mrad.', 'The plate is 1 meter tall. Measured in the reticle, distance = height × 1000 / mrad.'),
      tr(
        'As barras 3, 4, 5 e 6 dos lados já fazem a conta: apoie a base da placa na linha horizontal e veja qual barra tem a mesma altura. O número é a distância em centenas de metros.',
        'The 3, 4, 5 and 6 bars on the sides already do the math: rest the plate’s base on the horizontal line and see which bar matches its height. The number is the distance in hundreds of meters.'
      )
    ],
    task: () => tr('Encontre a placa com a seta, compare com as barras e escolha a distância.', 'Find the plate under the arrow, compare it with the bars and pick the distance.'),
    wind: false,
    target: () => 2,
    kind: 'range',
    options: [300, 400, 500, 600],
    big: () => [[tr('altura da placa', 'plate height'), '1 m'], [tr('distância', 'distance'), '1000 / mrad']]
  },
  {
    id: 'drop',
    num: '03',
    get title() { return tr('Segurar a queda', 'Holding for drop') },
    body: () => [
      tr(
        `Neste ar (${air().tempC} °C, ${air().pressHPa} hPa), a 600 m e com zero em 100 m, a bala cai ${n(at(600, false).drop, 1)} mrad. Em vez de girar a torre, o atirador segura a correção no retículo.`,
        `In this air (${air().tempC} °C, ${air().pressHPa} hPa), at 600 m with a 100 m zero, the bullet drops ${n(at(600, false).drop, 1)} mrad. Instead of dialing, the shooter holds the correction in the reticle.`
      ),
      tr(
        `A escada embaixo do centro é graduada em mrad, com números a cada 2. Ponha a marca de ${n(at(600, false).drop, 1)} mrad em cima da placa: o centro fica acima dela.`,
        `The ladder below the center is graduated in mrad, numbered every 2. Put the ${n(at(600, false).drop, 1)} mrad mark on the plate: the center ends up above it.`
      )
    ],
    task: () => tr(
      `Ponha a marca de ${n(at(600, false).drop, 1)} da escada na placa de 600 m. Segure espaço para prender a respiração e atire.`,
      `Put the ${n(at(600, false).drop, 1)} ladder mark on the 600 m plate. Hold space to hold your breath and fire.`
    ),
    wind: false,
    target: () => 3,
    kind: 'shoot',
    big: () => [[tr('segurar abaixo', 'hold low'), `${n(at(600, false).drop, 1)} mrad ↓`]],
    after: missText
  },
  {
    id: 'wind',
    num: '04',
    get title() { return tr('Ler o vento', 'Reading the wind') },
    body: () => {
      const d = at(500, true)
      return [
        tr(
          `As bandeiras agora mostram ${W()} m/s vindo da direita. A 500 m o vento leva a bala ${n(Math.abs(d.wind), 1)} mrad para a esquerda, e ela cai ${n(d.drop, 1)} mrad.`,
          `The flags now show ${W()} m/s coming from the right. At 500 m the wind carries the bullet ${n(Math.abs(d.wind), 1)} mrad left, and it drops ${n(d.drop, 1)} mrad.`
        ),
        tr(
          'Cada ponto da árvore vale 1 mrad para o lado. O ponto onde a bala vai cair fica à esquerda e abaixo do centro: ponha esse ponto na placa. O centro fica à direita, contra o vento.',
          'Each tree dot is 1 mrad sideways. The point where the bullet will land is left of and below the center: put that point on the plate. The center ends up to the right, into the wind.'
        )
      ]
    },
    task: () => {
      const d = at(500, true)
      return tr(
        `Ponha na placa de 500 m o ponto que fica ${n(d.drop, 1)} abaixo e ${n(Math.abs(d.wind), 1)} à esquerda do centro.`,
        `Put the point ${n(d.drop, 1)} below and ${n(Math.abs(d.wind), 1)} left of center on the 500 m plate.`
      )
    },
    wind: true,
    target: () => 2,
    kind: 'shoot',
    big: () => {
      const d = at(500, true)
      return [[tr('queda', 'drop'), `${n(d.drop, 1)} mrad ↓`], [tr('vento', 'wind'), `${n(Math.abs(d.wind), 1)} mrad ←`]]
    },
    after: missText
  },
  {
    id: 'dial',
    num: '05',
    get title() { return tr('Girar a torre', 'Dialing the turret') },
    body: () => {
      const d = at(800, true)
      return [
        tr(
          'Segurar é rápido, mas a 800 m a correção já passa de quatro traços. Em tiros longos o atirador gira a torre: a luneta inteira se inclina e o centro volta a ficar em cima do alvo.',
          'Holding is fast, but at 800 m the correction is already past four hashes. On long shots the shooter dials the turret: the whole scope tilts and the center goes back on the target.'
        ),
        tr(
          `Cada clique vale 0,1 mrad. A 800 m a bala cai ${n(d.drop, 1)} mrad (${clk(d.drop)} cliques para cima) e deriva ${n(Math.abs(d.wind), 1)} mrad (${clk(d.wind)} cliques para a direita).`,
          `Each click is 0.1 mrad. At 800 m the bullet drops ${n(d.drop, 1)} mrad (${clk(d.drop)} clicks up) and drifts ${n(Math.abs(d.wind), 1)} mrad (${clk(d.wind)} clicks right).`
        )
      ]
    },
    task: () => {
      const d = at(800, true)
      return tr(
        `Gire a elevação com W (${clk(d.drop)} cliques) e a deriva com D (${clk(d.wind)} cliques). Depois ponha o centro na placa de 800 m e atire. Shift gira de 5 em 5, R zera.`,
        `Dial elevation with W (${clk(d.drop)} clicks) and windage with D (${clk(d.wind)} clicks). Then put the center on the 800 m plate and fire. Shift dials 5 at a time, R resets.`
      )
    },
    wind: true,
    target: () => 4,
    kind: 'shoot',
    big: () => {
      const d = at(800, true)
      return [[tr('elevação', 'elevation'), `${clk(d.drop)} ${tr('cliques', 'clicks')} ↑`], [tr('deriva', 'windage'), `${clk(d.wind)} ${tr('cliques', 'clicks')} →`]]
    },
    after: missText
  },
  {
    id: 'move',
    num: '06',
    get title() { return tr('Alvo em movimento', 'Moving target') },
    body: () => {
      const d = at(450, false)
      const lead = (2 * d.t * 1000) / 450
      return [
        tr(
          `A placa de 450 m anda a 2 m/s. A bala leva ${n(d.t, 2)} s para chegar: nesse tempo a placa anda ${n(2 * d.t, 2)} m, ou ${n(lead, 1)} mrad.`,
          `The 450 m plate moves at 2 m/s. The bullet takes ${n(d.t, 2)} s to arrive: in that time the plate moves ${n(2 * d.t, 2)} m, or ${n(lead, 1)} mrad.`
        ),
        tr(
          `Atire à frente dela, do lado para onde está indo: ${n(lead, 1)} mrad de avanço e ${n(d.drop, 1)} mrad de queda. O vento está calmo.`,
          `Shoot ahead of it, on the side it is moving to: ${n(lead, 1)} mrad of lead and ${n(d.drop, 1)} mrad of drop. The wind is calm.`
        )
      ]
    },
    task: () => {
      const d = at(450, false)
      return tr(
        `Ponha na placa o ponto ${n(d.drop, 1)} abaixo e ${n((2 * d.t * 1000) / 450, 1)} para trás do movimento, e atire antes de ela virar.`,
        `Put the point ${n(d.drop, 1)} below and ${n((2 * d.t * 1000) / 450, 1)} behind the motion on the plate, and fire before it turns around.`
      )
    },
    wind: false,
    target: () => MOVER,
    kind: 'shoot',
    big: () => {
      const d = at(450, false)
      return [[tr('avanço', 'lead'), `${n((2 * d.t * 1000) / 450, 1)} mrad`], [tr('queda', 'drop'), `${n(d.drop, 1)} mrad ↓`]]
    },
    after: missText
  },
  {
    id: 'test',
    num: '07',
    get title() { return tr('Prova', 'Final test') },
    body: () => [
      tr(
        `Cinco tiros em placas sorteadas, com vento de ${W()} m/s da direita em rajadas. O telêmetro dá a distância; a tabela de tiro dá a queda e o vento. Observe as bandeiras e atire quando a rajada passar.`,
        `Five shots at random plates, with ${W()} m/s gusting from the right. The rangefinder gives the distance; the dope card gives drop and wind. Watch the flags and fire when the gust passes.`
      ),
      tr('Segure no retículo ou gire a torre, prenda a respiração e atire.', 'Hold in the reticle or dial the turret, hold your breath and fire.')
    ],
    task: () => tr('Acerte o máximo de placas em cinco tiros.', 'Hit as many plates as you can in five shots.'),
    wind: true,
    target: () => TEST_PLATES[Math.floor(Math.random() * TEST_PLATES.length)],
    kind: 'shoot',
    shots: 5,
    after: missText
  }
]

// tabela de tiro na unidade da luneta, para as distancias pedidas
export const dopeTable = (ids: number[], windX: number, s: Scope) =>
  ids.map((id) => {
    const d = PLATES[id].d
    const v = dope(d, windX, air())
    return {
      id, d,
      drop: toUnit(v.drop, s), wind: toUnit(v.wind, s),
      dropClicks: clicks(v.drop, s), windClicks: clicks(Math.abs(v.wind), s),
      unit: unitLabel(s)
    }
  })

const resetShot = () => {
  train.shot = null
  train.resolved = false
  train.answer = null
  train.dialElev = 0
  train.dialWind = 0
}

// ---------- ranking da prova: global pela API, com copia no navegador para quando ela estiver fora ----------
const RANK_KEY = 'longrange.ranking'
export type { Score }

const loadLocal = (): Score[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(RANK_KEY) ?? '[]')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

// o painel le daqui a cada redesenho; global diz se a lista veio da API ou do navegador
export const ranking = { list: loadLocal(), global: false }

export const refreshRanking = async () => {
  try {
    ranking.list = (await api.ranking(10)).ranking
    ranking.global = true
  } catch {
    ranking.list = loadLocal()
    ranking.global = false
  }
}

export const saveScore = (s: ScoreInput) => {
  const local = [...loadLocal(), { ...s, date: Date.now() }].sort(byRank).slice(0, 10)
  try {
    localStorage.setItem(RANK_KEY, JSON.stringify(local))
  } catch {
    // armazenamento cheio ou bloqueado: a copia local so nao persiste
  }
  ranking.list = local
  ranking.global = false
  // manda para o ranking global e recarrega; se a API falhar fica a lista local
  api.addScore(s).then(refreshRanking, () => {})
}

export const startLesson = (i: number) => {
  const l = LESSONS[i]
  gun.ammo = ammoById(train.ammoId)
  train.mode = 'lessons'
  train.lesson = i
  train.gusts = l.id === 'test'
  train.saved = false
  train.replay = 0
  train.windX = l.wind ? windFromScenario() : 0
  train.target = l.target()
  train.shots = 0
  train.hits = 0
  train.mag = 20
  resetShot()
}

export const startFree = () => {
  gun.ammo = ammoById(train.ammoId)
  train.mode = 'free'
  train.gusts = train.windOn
  train.replay = 0
  train.target = 3
  train.windX = train.windOn ? windFromScenario() : 0
  train.shots = 0
  train.hits = 0
  train.log = []
  const s = activeScope()
  train.mag = s.magMax
  resetShot()
}
