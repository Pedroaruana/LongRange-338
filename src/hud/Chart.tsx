import { SOLUTION } from '../world/layout'
import { RANGE } from '../ballistics'
import { losY, n } from './stages'
import { tr } from '../i18n'

// perfil e vista de cima da trajetoria inteira, com a parte ja percorrida acesa.
// mostra o que nenhum numero mostra sozinho: a bala sobe ~20 m e o vento a traz de volta ao centro

const W = 300
const H = 64
const STEP = 10
const pts = SOLUTION.samples.filter((_, i) => i % STEP === 0 || i === RANGE)

const rise = pts.map((q) => q.y - losY(q.s))
const lat = pts.map((q) => q.x)
const maxRise = Math.max(...rise) * 1.15
const maxLat = Math.max(...lat.map(Math.abs)) * 1.3

const toPath = (vals: number[], scale: (v: number) => number, count = vals.length) =>
  vals.slice(0, count).map((v, i) => `${i ? 'L' : 'M'}${((pts[i].s / RANGE) * W).toFixed(1)},${scale(v).toFixed(1)}`).join('')

const yRise = (v: number) => H - (v / maxRise) * (H - 6) - 3
const yLat = (v: number) => H / 2 - (v / maxLat) * (H / 2 - 4)

const MARKS = [400, 900, 1300, 1650, 1850]

const Plot = ({ label, vals, scale, base, s, unit, value }: {
  label: string; vals: number[]; scale: (v: number) => number; base: number; s: number; unit: string; value: string
}) => {
  const count = Math.max(1, Math.floor(s / STEP) + 1)
  const i = Math.min(count - 1, pts.length - 1)
  return (
    <div>
      <div className="flex justify-between text-[0.6rem] tracking-[0.3em] text-[#ece0cf]/45">
        <span>{label}</span>
        <span className="tabular-nums text-[#ece0cf]/80">{value} {unit}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 block w-full overflow-visible">
        <line x1={0} x2={W} y1={base} y2={base} stroke="#ece0cf" strokeOpacity={0.18} strokeDasharray="2 4" />
        {MARKS.map((m) => (
          <line key={m} x1={(m / RANGE) * W} x2={(m / RANGE) * W} y1={0} y2={H} stroke="#ece0cf" strokeOpacity={0.08} />
        ))}
        <path d={toPath(vals, scale)} fill="none" stroke="#ece0cf" strokeOpacity={0.22} strokeWidth={1} />
        <path d={toPath(vals, scale, count)} fill="none" stroke="#e8a76b" strokeWidth={1.6} />
        {s > 0 && <circle cx={(pts[i].s / RANGE) * W} cy={scale(vals[i])} r={2.6} fill="#ffd2a6" />}
      </svg>
    </div>
  )
}

export const Chart = ({ s }: { s: number }) => {
  const i = Math.min(Math.floor(s / STEP), pts.length - 1)
  return (
    <div className="w-[min(19rem,80vw)] space-y-3">
      <Plot label={tr('PERFIL · ACIMA DA VISADA', 'PROFILE · ABOVE SIGHT LINE')} vals={rise} scale={yRise} base={yRise(0)} s={s} unit="m" value={n(rise[i], 1)} />
      <Plot label={tr('VISTA DE CIMA · LATERAL', 'TOP VIEW · LATERAL')} vals={lat} scale={yLat} base={H / 2} s={s} unit="m" value={n(lat[i], 2)} />
    </div>
  )
}
