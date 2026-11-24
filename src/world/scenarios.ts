import * as THREE from 'three'
import { SUN_DIR, SUN_COLOR, FOG_COLOR, ZENITH, GROUND, groundUniforms, skyUniforms, TINT } from './atmosphere'
import { tr } from '../i18n'

// cada cenario muda a luz, as cores e tambem o ar: temperatura e pressao entram na balistica
// do treino, entao a mesma placa pede correcoes diferentes em cada lugar

type RGB = [number, number, number]

export type Scenario = {
  id: string
  name: string
  line: string
  air: { tempC: number; pressHPa: number }
  wind: number // m/s, sempre da direita
  sunDir: RGB
  sunColor: RGB
  sunPower: number
  fog: RGB
  fogK: number
  zenith: RGB
  ambient: RGB
  ground: { sand: RGB; ochre: RGB; rock: RGB; dark: RGB }
  snow: number
  grass: RGB
  bush: RGB
  rock: RGB
  hemi: [RGB, RGB, number]
  sunLight: number
  sunDisk: number
  clouds: number
  stars?: number
  env?: number // intensidade do reflexo do ceu nos metais e no atirador
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'desert',
    get name() { return tr('Deserto', 'Desert') },
    get line() { return tr('Cânion de arenito no fim da tarde. Ar quente e rarefeito.', 'Sandstone canyon at sunset. Hot, thin air.') },
    air: { tempC: 31, pressHPa: 912 },
    wind: 5,
    sunDir: [0.22, 0.075, -0.97],
    sunColor: [1.0, 0.68, 0.42],
    sunPower: 3.4,
    fog: [0.74, 0.5, 0.36],
    fogK: 0.00034,
    zenith: [0.05, 0.065, 0.11],
    ambient: [0.16, 0.2, 0.32],
    ground: { sand: [0.66, 0.46, 0.31], ochre: [0.55, 0.31, 0.18], rock: [0.34, 0.2, 0.14], dark: [0.13, 0.085, 0.07] },
    snow: 0,
    grass: [1, 1, 1],
    bush: [0.36, 0.27, 0.19],
    rock: [0.64, 0.49, 0.35],
    hemi: [[0.32, 0.38, 0.55], [0.42, 0.27, 0.17], 0.7],
    sunLight: 3.2,
    sunDisk: 1,
    clouds: 0
  },
  {
    id: 'mountain',
    get name() { return tr('Montanha a 3.000 m', 'Mountain at 3,000 m') },
    get line() { return tr('Neve, céu limpo e ar 30% mais leve. A bala cai menos.', 'Snow, clear sky and 30% lighter air. The bullet drops less.') },
    air: { tempC: -6, pressHPa: 701 },
    wind: 7,
    sunDir: [0.45, 0.32, -0.83],
    sunColor: [1.0, 0.95, 0.88],
    sunPower: 2.6,
    fog: [0.7, 0.77, 0.86],
    fogK: 0.00022,
    zenith: [0.08, 0.18, 0.4],
    ambient: [0.3, 0.36, 0.5],
    ground: { sand: [0.78, 0.8, 0.84], ochre: [0.5, 0.5, 0.52], rock: [0.3, 0.3, 0.32], dark: [0.12, 0.12, 0.13] },
    snow: 1,
    grass: [0.75, 0.72, 0.62],
    bush: [0.22, 0.2, 0.18],
    rock: [0.5, 0.5, 0.52],
    hemi: [[0.5, 0.6, 0.8], [0.6, 0.6, 0.62], 0.9],
    sunLight: 3.6,
    sunDisk: 1,
    clouds: 0.15
  },
  {
    id: 'overcast',
    get name() { return tr('Campo nublado', 'Overcast field') },
    get line() { return tr('Planície de capim sob céu fechado. Ar denso do nível do mar.', 'Grass plain under a closed sky. Dense sea-level air.') },
    air: { tempC: 12, pressHPa: 1008 },
    wind: 4,
    sunDir: [0.15, 0.55, -0.82],
    sunColor: [0.78, 0.8, 0.8],
    sunPower: 1.4,
    fog: [0.6, 0.64, 0.66],
    fogK: 0.0006,
    zenith: [0.42, 0.46, 0.5],
    ambient: [0.42, 0.46, 0.5],
    ground: { sand: [0.34, 0.36, 0.22], ochre: [0.3, 0.29, 0.18], rock: [0.3, 0.29, 0.26], dark: [0.12, 0.12, 0.1] },
    snow: 0,
    grass: [0.62, 0.78, 0.5],
    bush: [0.16, 0.2, 0.12],
    rock: [0.42, 0.42, 0.4],
    hemi: [[0.6, 0.64, 0.68], [0.3, 0.32, 0.24], 1.2],
    sunLight: 1.3,
    sunDisk: 0,
    clouds: 1
  },
  {
    id: 'saltflat',
    get name() { return tr('Salinas ao amanhecer', 'Salt flats at dawn') },
    get line() { return tr('Lago de sal ao nível do mar, luz rosada e quase sem relevo.', 'Sea-level salt lake, pink light and almost no relief.') },
    air: { tempC: 18, pressHPa: 1015 },
    wind: 3,
    sunDir: [-0.55, 0.06, -0.83],
    sunColor: [1.0, 0.62, 0.55],
    sunPower: 3.0,
    fog: [0.84, 0.66, 0.66],
    fogK: 0.0003,
    zenith: [0.2, 0.22, 0.38],
    ambient: [0.3, 0.3, 0.42],
    ground: { sand: [0.88, 0.84, 0.8], ochre: [0.72, 0.62, 0.58], rock: [0.45, 0.38, 0.36], dark: [0.2, 0.16, 0.16] },
    snow: 0,
    grass: [0.9, 0.82, 0.78],
    bush: [0.3, 0.24, 0.22],
    rock: [0.6, 0.52, 0.5],
    hemi: [[0.55, 0.5, 0.65], [0.7, 0.6, 0.58], 0.9],
    sunLight: 2.8,
    sunDisk: 1,
    clouds: 0.2
  },
  {
    // mesmo ar do deserto: o tiro de 2000 m continua com os mesmos numeros a noite
    id: 'night',
    get name() { return tr('Deserto à noite', 'Desert at night') },
    get line() { return tr('Lua cheia sobre o cânion. Céu estrelado e luz fria, mas tudo ainda visível.', 'Full moon over the canyon. Starry sky and cold light, everything still visible.') },
    air: { tempC: 31, pressHPa: 912 },
    wind: 5,
    sunDir: [-0.35, 0.42, -0.84],
    sunColor: [0.55, 0.64, 0.85],
    // luar: cerca de 1/10 da luz do dia, quase sem cor
    sunPower: 0.38,
    fog: [0.018, 0.024, 0.045],
    fogK: 0.00045,
    zenith: [0.002, 0.004, 0.012],
    ambient: [0.035, 0.045, 0.085],
    // a areia perde a cor sob o luar: tons frios e mais escuros
    ground: { sand: [0.36, 0.34, 0.36], ochre: [0.3, 0.26, 0.27], rock: [0.2, 0.17, 0.18], dark: [0.07, 0.06, 0.07] },
    snow: 0,
    grass: [0.7, 0.75, 0.85],
    bush: [0.2, 0.2, 0.24],
    rock: [0.42, 0.42, 0.5],
    hemi: [[0.12, 0.15, 0.26], [0.03, 0.03, 0.04], 0.45],
    sunLight: 0.55,
    sunDisk: 0.5,
    clouds: 0.1,
    stars: 1,
    env: 0.18
  }
]

export const scenario = { current: SCENARIOS[0] }

const set = (c: THREE.Color, v: RGB) => c.setRGB(v[0], v[1], v[2])

export const applyScenario = (id: string) => {
  const s = SCENARIOS.find((x) => x.id === id) ?? SCENARIOS[0]
  scenario.current = s
  SUN_DIR.set(...s.sunDir).normalize()
  set(SUN_COLOR, s.sunColor)
  set(FOG_COLOR, s.fog)
  set(ZENITH, s.zenith)
  set(GROUND.sand, s.ground.sand)
  set(GROUND.ochre, s.ground.ochre)
  set(GROUND.rock, s.ground.rock)
  set(GROUND.dark, s.ground.dark)
  skyUniforms.uSunDisk.value = s.sunDisk
  skyUniforms.uCloudCover.value = s.clouds
  skyUniforms.uStars.value = s.stars ?? 0
  groundUniforms.uSnow.value = s.snow
  groundUniforms.uFogK.value = s.fogK
  groundUniforms.uSunPower.value = s.sunPower
  set(groundUniforms.uAmbient.value, s.ambient)
  // as tintas dos materiais padrao estao em sRGB (como cores hex); as do shader, em linear
  TINT.grass.setRGB(...s.grass, THREE.SRGBColorSpace)
  TINT.bush.setRGB(...s.bush, THREE.SRGBColorSpace)
  TINT.rock.setRGB(...s.rock, THREE.SRGBColorSpace)
  return s
}
