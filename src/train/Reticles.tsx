import { useEffect, useState, type ReactElement } from 'react'
import { MOA, fovFor, type Scope } from './scopes'

// retículos desenhados em mrad: o viewBox do SVG e o campo de visao atual da camera,
// entao 1 unidade = 1 mrad na cena. primeiro plano focal (FFP) usa essa escala direto;
// segundo plano focal (SFP) fica do mesmo tamanho na tela e so vale certo no aumento maximo

const INK = '#0b0a09'
const RED = '#d2321f'
const fine = { stroke: INK, strokeWidth: 0.04 }

const label = (key: string, x: number, y: number, t: string, size = 0.5) => (
  <text key={key} x={x} y={y} fontSize={size} textAnchor="middle" fill={INK} fontFamily="Arial, sans-serif" fontWeight={700}>{t}</text>
)

// arvore de Natal: barras de distancia, escada de queda e pontos de vento
const BARS: [string, number, number][] = [['6', 6.3, 1000 / 600], ['5', 7.3, 1000 / 500], ['4', 8.3, 1000 / 400], ['3', 9.3, 1000 / 300]]
const Tree = ({ R }: { R: number }) => {
  const el: ReactElement[] = []
  el.push(<line key="hl" x1={-10} x2={-0.75} y1={0} y2={0} {...fine} />, <line key="hr" x1={0.75} x2={10} y1={0} y2={0} {...fine} />)
  for (let i = 1; i <= 10; i++) {
    for (const s of [-1, 1]) {
      const len = i === 5 ? 0.55 : 0.32
      el.push(<line key={`t${i}${s}`} x1={i * s} x2={i * s} y1={-len / 2} y2={len / 2} {...fine} />)
      el.push(<line key={`h${i}${s}`} x1={(i - 0.5) * s} x2={(i - 0.5) * s} y1={-0.1} y2={0.1} {...fine} />)
      if (i === 5) {
        el.push(<line key={`s${s}a`} x1={5 * s - 0.15} x2={5 * s + 0.15} y1={-0.28} y2={-0.28} {...fine} />)
        el.push(<line key={`s${s}b`} x1={5 * s - 0.15} x2={5 * s + 0.15} y1={0.28} y2={0.28} {...fine} />)
      }
    }
  }
  for (const [t, x, bh] of BARS) {
    for (const s of [-1, 1]) {
      el.push(<line key={`b${t}${s}`} x1={x * s} x2={x * s} y1={0} y2={-bh} stroke={INK} strokeWidth={0.06} />)
      el.push(label(`bl${t}${s}`, x * s, -bh - 0.25, t, 0.45))
    }
  }
  el.push(<line key="v" x1={0} x2={0} y1={0.75} y2={15} {...fine} />)
  for (let r = 1; r <= 15; r++) {
    const big = r % 5 === 0
    el.push(<line key={`vt${r}`} x1={big ? -0.4 : -0.22} x2={big ? 0.4 : 0.22} y1={r} y2={r} stroke={INK} strokeWidth={big ? 0.06 : 0.045} />)
    el.push(<line key={`vh${r}`} x1={-0.1} x2={0.1} y1={r - 0.5} y2={r - 0.5} {...fine} />)
    if (r < 2 || r > 14) continue
    const wdt = Math.min(6, r)
    for (let c = 1; c <= wdt; c++) for (const s of [-1, 1]) el.push(<circle key={`d${r}${c}${s}`} cx={c * s} cy={r} r={0.06} fill={INK} />)
    if (r % 2 === 0) el.push(label(`nl${r}`, -(wdt + 0.9), r + 0.18, String(r)), label(`nr${r}`, wdt + 0.9, r + 0.18, String(r)))
  }
  el.push(<rect key="pl" x={-R} y={-0.18} width={R - 11} height={0.36} fill={INK} />)
  el.push(<rect key="pr" x={11} y={-0.18} width={R - 11} height={0.36} fill={INK} />)
  if (R > 16) el.push(<rect key="pb" x={-0.18} y={16} width={0.36} height={R - 16} fill={INK} />)
  el.push(
    <path key="ring" d={`M ${0.45 * Math.cos(2.3)} ${0.45 * Math.sin(2.3)} A 0.45 0.45 0 1 1 ${0.45 * Math.cos(0.84)} ${0.45 * Math.sin(0.84)}`} fill="none" stroke={RED} strokeWidth={0.09} />,
    <circle key="c" r={0.05} fill={RED} />
  )
  return <>{el}</>
}

// mil-dot: pontos de 0,25 mrad a cada 1 mrad nos dois eixos
const MilDot = ({ R }: { R: number }) => {
  const el: ReactElement[] = [
    <line key="h" x1={-10.5} x2={10.5} y1={0} y2={0} {...fine} />,
    <line key="v" x1={0} x2={0} y1={-10.5} y2={10.5} {...fine} />
  ]
  for (let i = 1; i <= 10; i++) {
    for (const s of [-1, 1]) {
      el.push(<circle key={`x${i}${s}`} cx={i * s} cy={0} r={0.125} fill={INK} />)
      el.push(<circle key={`y${i}${s}`} cx={0} cy={i * s} r={0.125} fill={INK} />)
    }
  }
  for (const [k, x1, y1, w, h] of [['l', -R, -0.25, R - 10.5, 0.5], ['r', 10.5, -0.25, R - 10.5, 0.5], ['b', -0.25, 10.5, 0.5, R - 10.5], ['t', -0.25, -R, 0.5, R - 10.5]] as const) {
    el.push(<rect key={`p${k}`} x={x1} y={y1} width={w} height={h} fill={INK} />)
  }
  return <>{el}</>
}

// MOA: tracos a cada 2 MOA, maiores a cada 10 com numero, ate 30 MOA para os lados e 40 para baixo
const MoaHash = ({ R }: { R: number }) => {
  const el: ReactElement[] = [
    <line key="h" x1={-30 * MOA} x2={30 * MOA} y1={0} y2={0} {...fine} />,
    <line key="v" x1={0} x2={0} y1={-10 * MOA} y2={40 * MOA} {...fine} />,
    <circle key="c" r={0.07} fill={INK} />
  ]
  for (let m = 2; m <= 40; m += 2) {
    const big = m % 10 === 0
    const len = big ? 0.5 : 0.25
    if (m <= 30) for (const s of [-1, 1]) {
      el.push(<line key={`x${m}${s}`} x1={m * MOA * s} x2={m * MOA * s} y1={-len / 2} y2={len / 2} {...fine} />)
      if (big) el.push(label(`xl${m}${s}`, m * MOA * s, -0.45, String(m), 0.4))
    }
    el.push(<line key={`y${m}`} x1={-len / 2} x2={len / 2} y1={m * MOA} y2={m * MOA} {...fine} />)
    if (big) el.push(label(`yl${m}`, 0.7, m * MOA + 0.15, String(m), 0.4))
  }
  const edge = 32 * MOA
  el.push(<rect key="pl" x={-R} y={-0.2} width={R - edge} height={0.4} fill={INK} />)
  el.push(<rect key="pr" x={edge} y={-0.2} width={R - edge} height={0.4} fill={INK} />)
  el.push(<rect key="pb" x={-0.2} y={42 * MOA} width={0.4} height={R} fill={INK} />)
  return <>{el}</>
}

// duplex de caca: postes grossos e cruz fina no meio, sem nenhuma marca de medida
const Duplex = ({ R }: { R: number }) => (
  <>
    <line x1={-4} x2={4} y1={0} y2={0} stroke={INK} strokeWidth={0.06} />
    <line x1={0} x2={0} y1={-4} y2={4} stroke={INK} strokeWidth={0.06} />
    <rect x={-R} y={-0.35} width={R - 4} height={0.7} fill={INK} />
    <rect x={4} y={-0.35} width={R - 4} height={0.7} fill={INK} />
    <rect x={-0.35} y={4} width={0.7} height={R} fill={INK} />
    <rect x={-0.35} y={-R} width={0.7} height={R - 4} fill={INK} />
  </>
)

export const ScopeView = ({ scope, mag }: { scope: Scope; mag: number }) => {
  const [aspect, setAspect] = useState(innerWidth / innerHeight)
  useEffect(() => {
    const r = () => setAspect(innerWidth / innerHeight)
    addEventListener('resize', r)
    return () => removeEventListener('resize', r)
  }, [])

  const toMrad = (deg: number) => 2 * Math.tan(((deg / 2) * Math.PI) / 180) * 1000
  const h = toMrad(fovFor(mag))
  const w = h * aspect
  const R = h * 0.47
  // SFP: o retículo tem o tamanho da tela no aumento maximo; abaixo dele as marcas mentem
  const k = scope.ffp ? 1 : h / toMrad(fovFor(scope.magMax))
  const Ret = { tree: Tree, mildot: MilDot, moa: MoaHash, duplex: Duplex }[scope.reticle]

  return (
    <svg viewBox={`${-w / 2} ${-h / 2} ${w} ${h}`} preserveAspectRatio="none" className="pointer-events-none fixed inset-0 h-full w-full">
      <defs>
        <radialGradient id="tube3" cx="0" cy="0" r={R} gradientUnits="userSpaceOnUse">
          <stop offset="0.84" stopColor="#000" stopOpacity={0} />
          <stop offset="0.97" stopColor="#000" stopOpacity={0.7} />
          <stop offset="1" stopColor="#000" stopOpacity={1} />
        </radialGradient>
        <mask id="eye3">
          <rect x={-w} y={-h} width={w * 2} height={h * 2} fill="white" />
          <circle r={R} fill="black" />
        </mask>
      </defs>
      <g transform={`scale(${k})`}>
        <Ret R={R / k} />
      </g>
      <circle r={R} fill="url(#tube3)" />
      <rect x={-w} y={-h} width={w * 2} height={h * 2} fill="#050403" mask="url(#eye3)" />
    </svg>
  )
}

// miniatura do retículo para a tela de escolha
export const ReticleThumb = ({ scope }: { scope: Scope }) => {
  const Ret = { tree: Tree, mildot: MilDot, moa: MoaHash, duplex: Duplex }[scope.reticle]
  return (
    <svg viewBox="-14 -14 28 28" className="h-14 w-14 shrink-0 rounded-full bg-[#d9cdb8]">
      <Ret R={14} />
    </svg>
  )
}
