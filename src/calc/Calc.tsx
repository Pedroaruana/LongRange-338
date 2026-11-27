import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, type SolveRow } from '../api'
import { AMMOS, airDensity, soundSpeed, type Ammo } from '../../shared/ballistics'
import { dope } from '../../shared/dope'
import { tr, num } from '../i18n'

// calculadora balistica: o mesmo motor do site, com todos os parametros abertos.
// gera a tabela de tiro e os graficos de queda e velocidade, e compara as municoes

const MOA = 0.290888

type Inputs = { ammo: string; range: number; tempC: number; press: number; wind: number; zero: number; unit: 'mrad' | 'moa'; compare: boolean }

const run = (a: Ammo, i: Inputs) =>
  dope({ ammo: a.id, range: i.range, tempC: i.tempC, pressHPa: i.press, wind: i.wind, zero: i.zero })

const Slider = ({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void
}) => (
  <label className="block">
    <div className="flex justify-between font-mono text-[0.62rem] tracking-[0.25em] text-[#ece0cf]/55">
      <span>{label}</span>
      <span className="tabular-nums text-[#ffd2a6]">{num(value, step < 1 ? 1 : 0)} {unit}</span>
    </div>
    <input
      type="range" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="mt-2 w-full accent-[#e8a76b]"
    />
  </label>
)

const Chip = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) => (
  <button
    onClick={onClick}
    className={`cursor-pointer border-b pb-1 font-mono text-[0.64rem] tracking-[0.25em] transition-colors ${on ? 'border-[#e8a76b] text-[#ffd2a6]' : 'border-[#ece0cf]/25 text-[#ece0cf]/60 hover:text-[#ece0cf]'}`}
  >
    {children}
  </button>
)

const COLORS = ['#e8a76b', '#8fc7e8', '#a8e08a', '#e88fb4']

// grafico de linhas simples em SVG
const Chart = ({ title, series, range, yMax, yMin = 0, invert, refLine }: {
  title: string; series: { color: string; pts: [number, number][]; bold: boolean }[]
  range: number; yMax: number; yMin?: number; invert?: boolean; refLine?: { y: number; label: string }
}) => {
  const W = 520, H = 170
  const sx = (s: number) => (s / range) * W
  const sy = (v: number) => {
    const f = (v - yMin) / (yMax - yMin)
    return invert ? f * H : H - f * H
  }
  return (
    <div>
      <div className="font-mono text-[0.6rem] tracking-[0.3em] text-[#ece0cf]/50">{title}</div>
      <svg viewBox={`-6 -6 ${W + 12} ${H + 24}`} className="mt-2 w-full">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={sx(range * f)} x2={sx(range * f)} y1={0} y2={H} stroke="#ece0cf" strokeOpacity={0.08} />
            <text x={sx(range * f)} y={H + 16} fontSize={10} textAnchor="end" fill="#ece0cf" fillOpacity={0.45} fontFamily="monospace">{num(range * f)} m</text>
          </g>
        ))}
        {refLine && (
          <g>
            <line x1={0} x2={W} y1={sy(refLine.y)} y2={sy(refLine.y)} stroke="#e8a76b" strokeOpacity={0.4} strokeDasharray="4 4" />
            <text x={4} y={sy(refLine.y) - 4} fontSize={10} fill="#e8a76b" fillOpacity={0.8} fontFamily="monospace">{refLine.label}</text>
          </g>
        )}
        {series.map((sr, i) => (
          <path
            key={i}
            d={sr.pts.map(([s, v], k) => `${k ? 'L' : 'M'}${sx(s).toFixed(1)},${sy(v).toFixed(1)}`).join('')}
            fill="none" stroke={sr.color} strokeWidth={sr.bold ? 2.2 : 1.2} strokeOpacity={sr.bold ? 1 : 0.55}
          />
        ))}
      </svg>
    </div>
  )
}

export const Calc = ({ onExit }: { onExit: () => void }) => {
  const [i, setI] = useState<Inputs>({ ammo: '338', range: 1500, tempC: 15, press: 1013, wind: 5, zero: 100, unit: 'mrad', compare: true })
  const set = <K extends keyof Inputs>(k: K, v: Inputs[K]) => setI((p) => ({ ...p, [k]: v }))

  const results = useMemo(
    () => AMMOS.map((a) => ({ a, rows: run(a, i) })),
    [i.range, i.tempC, i.press, i.wind, i.zero] // a unidade e a municao em destaque nao mudam a fisica
  )
  const main = results.find((r) => r.a.id === i.ammo)!

  // a tabela vem da API (o mesmo motor rodando no servidor); os graficos precisam de um ponto
  // por metro e continuam locais. sem API, a tabela tambem e calculada no navegador
  const [remote, setRemote] = useState<SolveRow[] | null>(null)
  useEffect(() => {
    let alive = true
    const t = setTimeout(() => {
      api.solve({ ammo: i.ammo, range: i.range, tempC: i.tempC, pressHPa: i.press, wind: i.wind, zero: i.zero, step: 100 })
        .then((r) => { if (alive) setRemote(r.table) }, () => { if (alive) setRemote(null) })
    }, 250)
    return () => { alive = false; clearTimeout(t) }
  }, [i.ammo, i.range, i.tempC, i.press, i.wind, i.zero])
  const table: SolveRow[] = remote ?? main.rows
    .filter((q) => q.s > 0 && q.s % 100 === 0)
    .map((q) => ({ range: q.s, time: q.t, velocity: q.v, mach: q.mach, energy: q.energy, drop: q.drop, windage: q.wind }))
  const shown = i.compare ? results : [main]
  const toU = (mrad: number) => (i.unit === 'moa' ? mrad / MOA : mrad)
  const click = i.unit === 'moa' ? 0.25 : 0.1
  const maxDrop = Math.max(...shown.map((r) => r.rows[i.range].drop)) * 1.05
  const c = soundSpeed(i.tempC)

  return (
    <div className="pointer-events-auto absolute inset-0 overflow-y-auto bg-black/70 font-sans">
      <div className="mx-auto max-w-[78rem] px-[4vw] py-[6vh]">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="font-mono text-[0.62rem] tracking-[0.5em] text-[#ece0cf]/55">LONGRANGE</div>
            <h1 className="mt-2 font-display text-[clamp(2.4rem,5vw,4rem)] font-black tracking-[0.06em] text-[#f1e6d4]">{tr('CALCULADORA BALÍSTICA', 'BALLISTIC CALCULATOR')}</h1>
            <p className="mt-2 max-w-[44rem] text-[0.9rem] leading-6 text-[#ece0cf]/70">
              {tr(
                'O mesmo motor do site, com tudo aberto: arrasto G7, densidade do ar, vento, Coriolis e spin drift. Mude os parâmetros e veja a tabela e as curvas mudarem na hora.',
                'The same engine that runs the site, fully exposed: G7 drag, air density, wind, Coriolis and spin drift. Change the inputs and watch the table and curves update live.'
              )}
            </p>
          </div>
          <Chip on={false} onClick={onExit}>{tr('VOLTAR', 'BACK')}</Chip>
        </div>

        <div className="mt-8 grid gap-10 lg:grid-cols-[19rem_1fr]">
          <div className="space-y-5">
            <div>
              <div className="font-mono text-[0.6rem] tracking-[0.3em] text-[#e8a76b]">{tr('MUNIÇÃO', 'AMMUNITION')}</div>
              <div className="mt-2 space-y-2">
                {AMMOS.map((a, k) => (
                  <button key={a.id} onClick={() => set('ammo', a.id)}
                    className={`block w-full cursor-pointer border-l-2 pl-3 text-left transition-colors ${i.ammo === a.id ? 'border-[#e8a76b]' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                    <div className="flex items-center gap-2 text-[0.86rem] text-[#f4ead9]">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: COLORS[k] }} />{a.name}
                    </div>
                    <div className="font-mono text-[0.6rem] text-[#ece0cf]/50">{a.bullet} · {a.v0} m/s · G7 {num(a.bcG7, 3)}</div>
                  </button>
                ))}
              </div>
            </div>
            <Slider label={tr('ALCANCE', 'RANGE')} value={i.range} min={500} max={2000} step={100} unit="m" onChange={(v) => set('range', v)} />
            <Slider label={tr('TEMPERATURA', 'TEMPERATURE')} value={i.tempC} min={-20} max={45} step={1} unit="°C" onChange={(v) => set('tempC', v)} />
            <Slider label={tr('PRESSÃO', 'PRESSURE')} value={i.press} min={650} max={1040} step={1} unit="hPa" onChange={(v) => set('press', v)} />
            <Slider label={tr('VENTO CRUZADO', 'CROSSWIND')} value={i.wind} min={0} max={15} step={0.5} unit="m/s" onChange={(v) => set('wind', v)} />
            <div className="flex flex-wrap items-center gap-4">
              <span className="font-mono text-[0.6rem] tracking-[0.3em] text-[#ece0cf]/50">ZERO</span>
              {[100, 200, 300].map((z) => <Chip key={z} on={i.zero === z} onClick={() => set('zero', z)}>{z} M</Chip>)}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <span className="font-mono text-[0.6rem] tracking-[0.3em] text-[#ece0cf]/50">{tr('UNIDADE', 'UNIT')}</span>
              <Chip on={i.unit === 'mrad'} onClick={() => set('unit', 'mrad')}>MRAD</Chip>
              <Chip on={i.unit === 'moa'} onClick={() => set('unit', 'moa')}>MOA</Chip>
              <Chip on={i.compare} onClick={() => set('compare', !i.compare)}>{tr('COMPARAR', 'COMPARE')}</Chip>
            </div>
            <div className="border-t border-[#ece0cf]/15 pt-4 font-mono text-[0.68rem] leading-6 text-[#ece0cf]/65 tabular-nums">
              <div>ρ = {num(airDensity({ tempC: i.tempC, pressHPa: i.press }), 3)} kg/m³</div>
              <div>c = {num(c, 1)} m/s</div>
              <div>{tr('subsônica em', 'subsonic at')} {(() => { const s = main.rows.find((r) => r.mach < 1)?.s; return s ? `${num(s)} m` : tr('não fica', 'never') })()}</div>
            </div>
          </div>

          <div className="space-y-8">
            <Chart
              title={tr('QUEDA ABAIXO DA LINHA DE VISADA (m)', 'DROP BELOW LINE OF SIGHT (m)')}
              range={i.range} yMax={maxDrop} yMin={Math.min(0, -maxDrop * 0.05)} invert
              series={shown.map((r) => ({
                color: COLORS[AMMOS.indexOf(r.a)], bold: r.a.id === i.ammo,
                pts: r.rows.filter((_, k) => k % 10 === 0).map((q) => [q.s, q.drop] as [number, number])
              }))}
            />
            <Chart
              title={tr('VELOCIDADE (m/s)', 'VELOCITY (m/s)')}
              range={i.range} yMax={1000} yMin={150}
              refLine={{ y: c, label: tr('velocidade do som', 'speed of sound') }}
              series={shown.map((r) => ({
                color: COLORS[AMMOS.indexOf(r.a)], bold: r.a.id === i.ammo,
                pts: r.rows.filter((_, k) => k % 10 === 0).map((q) => [q.s, q.v] as [number, number])
              }))}
            />

            <div className="overflow-x-auto">
              <table className="w-full font-mono text-[0.7rem] tabular-nums">
                <thead>
                  <tr className="text-left text-[0.58rem] tracking-[0.2em] text-[#ece0cf]/45">
                    <th className="py-2 pr-4">DIST</th>
                    <th className="pr-4">{tr('QUEDA', 'DROP')} m</th>
                    <th className="pr-4">{tr('QUEDA', 'DROP')} {i.unit.toUpperCase()}</th>
                    <th className="pr-4">{tr('CLIQUES', 'CLICKS')}</th>
                    <th className="pr-4">{tr('VENTO', 'WIND')} m</th>
                    <th className="pr-4">{tr('VENTO', 'WIND')} {i.unit.toUpperCase()}</th>
                    <th className="pr-4">V m/s</th>
                    <th className="pr-4">MACH</th>
                    <th className="pr-4">{tr('ENERGIA', 'ENERGY')} J</th>
                    <th>{tr('TEMPO', 'TIME')} s</th>
                  </tr>
                </thead>
                <tbody>
                  {table.map((q) => {
                    const dm = (q.drop / q.range) * 1000
                    const wm = (q.windage / q.range) * 1000
                    return (
                      <tr key={q.range} className={`border-t border-[#ece0cf]/8 ${q.mach < 1 ? 'text-[#8fc7e8]' : 'text-[#ece0cf]/85'}`}>
                        <td className="py-1.5 pr-4 text-[#ffd2a6]">{q.range}</td>
                        <td className="pr-4">{num(q.drop, 2)}</td>
                        <td className="pr-4">{num(toU(dm), 1)}</td>
                        <td className="pr-4">{Math.round(toU(dm) / click)}</td>
                        <td className="pr-4">{num(q.windage, 2)}</td>
                        <td className="pr-4">{num(toU(wm), 1)}</td>
                        <td className="pr-4">{num(q.velocity)}</td>
                        <td className="pr-4">{num(q.mach, 2)}</td>
                        <td className="pr-4">{num(q.energy)}</td>
                        <td>{num(q.time, 2)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="mt-2 flex flex-wrap justify-between gap-2 font-mono text-[0.6rem]">
                <span className="text-[#8fc7e8]/70">{tr('em azul: bala subsônica', 'in blue: subsonic bullet')}</span>
                <span className="text-[#ece0cf]/45">
                  {remote ? tr('tabela calculada pela API · POST /api/solve', 'table computed by the API · POST /api/solve') : tr('API fora do ar: tabela calculada no navegador', 'API offline: table computed in the browser')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
