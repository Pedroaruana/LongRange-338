// lunetas do simulador. o que muda entre elas e exatamente o que muda na vida real:
// faixa de aumento, plano focal do retículo, unidade (mrad ou MOA) e o valor de cada clique da torre

import { tr } from '../i18n'

export const MOA = 0.290888 // 1 MOA em mrad

export type Scope = {
  id: string
  name: string
  model: string
  line: string
  magMin: number
  magMax: number
  ffp: boolean // primeiro plano focal: retículo cresce com o zoom e vale em qualquer aumento
  unit: 'mrad' | 'moa'
  reticle: 'tree' | 'mildot' | 'moa' | 'duplex'
  click: number // valor do clique na unidade da luneta
}

export const SCOPES: Scope[] = [
  {
    id: 'tactical',
    get name() { return tr('Tática', 'Tactical') },
    get model() { return tr('5-25×56 FFP · árvore mrad', '5-25×56 FFP · mrad tree') },
    get line() { return tr('Árvore de Natal com pontos de vento. Segura queda e vento sem tocar na torre.', 'Christmas-tree reticle with wind dots. Hold drop and wind without touching the turret.') },
    magMin: 5, magMax: 25, ffp: true, unit: 'mrad', reticle: 'tree', click: 0.1
  },
  {
    id: 'precision',
    get name() { return tr('Precisão', 'Precision') },
    model: '4-16×50 FFP · mil-dot',
    get line() { return tr('O clássico mil-dot militar: um ponto a cada miliradiano.', 'The classic military mil-dot: one dot per milliradian.') },
    magMin: 4, magMax: 16, ffp: true, unit: 'mrad', reticle: 'mildot', click: 0.1
  },
  {
    id: 'competition',
    get name() { return tr('Competição', 'Competition') },
    model: '6-24×50 SFP · MOA',
    get line() { return tr('Marcas em MOA no segundo plano focal: só valem certo no aumento máximo.', 'MOA marks in the second focal plane: only true at maximum power.') },
    magMin: 6, magMax: 24, ffp: false, unit: 'moa', reticle: 'moa', click: 0.25
  },
  {
    id: 'hunting',
    get name() { return tr('Caça', 'Hunting') },
    model: '3-9×40 SFP · duplex',
    get line() { return tr('Sem marcas no retículo: toda correção vai na torre, clique a clique.', 'No reticle marks: every correction goes on the turret, click by click.') },
    magMin: 3, magMax: 9, ffp: false, unit: 'moa', reticle: 'duplex', click: 0.25
  }
]

export const scopeById = (id: string) => SCOPES.find((s) => s.id === id) ?? SCOPES[0]

// conversoes para exibir na unidade da luneta
export const toUnit = (mrad: number, s: Scope) => (s.unit === 'moa' ? mrad / MOA : mrad)
export const unitLabel = (s: Scope) => (s.unit === 'moa' ? 'MOA' : 'mrad')
export const clicks = (mrad: number, s: Scope) => Math.round(toUnit(mrad, s) / s.click)

// campo de visao vertical da camera para um aumento (aprox. 40 graus / aumento)
export const fovFor = (mag: number) => 40 / mag
