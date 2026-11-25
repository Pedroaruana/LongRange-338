import { useEffect, useState } from 'react'
import { SCOPE_FOV, SOLUTION } from '../world/layout'
import { n } from './stages'
import { tr } from '../i18n'

// retículo em miliradianos desenhado na mesma escala angular da camera:
// o viewBox do SVG e o campo de visao da luneta em mrad, entao 1 unidade = 1 mrad na tela

const FOV_MRAD = 2 * Math.tan(((SCOPE_FOV / 2) * Math.PI) / 180) * 1000
const HOLD = -Math.abs(SOLUTION.azMrad) // a placa aparece a esquerda do centro

export const Reticle = ({ opacity }: { opacity: number }) => {
  const [aspect, setAspect] = useState(innerWidth / innerHeight)
  useEffect(() => {
    const r = () => setAspect(innerWidth / innerHeight)
    addEventListener('resize', r)
    return () => removeEventListener('resize', r)
  }, [])

  const h = FOV_MRAD
  const w = h * aspect
  const R = h * 0.47
  const line = { stroke: '#0c0b0a', strokeWidth: 0.045 }
  const ticks = []
  for (let i = -10; i <= 10; i++) {
    if (i === 0) continue
    const len = i % 2 === 0 ? 0.42 : 0.26
    ticks.push(<line key={`h${i}`} x1={i} x2={i} y1={-len / 2} y2={len / 2} {...line} />)
    ticks.push(<line key={`v${i}`} y1={i} y2={i} x1={-len / 2} x2={len / 2} {...line} />)
    ticks.push(<line key={`hh${i}`} x1={i - 0.5} x2={i - 0.5} y1={-0.1} y2={0.1} {...line} strokeWidth={0.03} />)
    if (i % 2 === 0 && i > 0) {
      ticks.push(<text key={`t${i}`} x={i} y={-0.42} fontSize={0.42} textAnchor="middle" fill="#0c0b0a" fontFamily="monospace">{i}</text>)
      ticks.push(<text key={`tv${i}`} x={0.5} y={i + 0.14} fontSize={0.42} fill="#0c0b0a" fontFamily="monospace">{i}</text>)
    }
  }

  return (
    <div className="pointer-events-none fixed inset-0" style={{ opacity }}>
      <svg viewBox={`${-w / 2} ${-h / 2} ${w} ${h}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <defs>
          <radialGradient id="tube" cx="0" cy="0" r={R} gradientUnits="userSpaceOnUse">
            <stop offset="0.82" stopColor="#000" stopOpacity={0} />
            <stop offset="0.97" stopColor="#000" stopOpacity={0.75} />
            <stop offset="1" stopColor="#000" stopOpacity={1} />
          </radialGradient>
          <mask id="eye">
            <rect x={-w} y={-h} width={w * 2} height={h * 2} fill="white" />
            <circle r={R} fill="black" />
          </mask>
        </defs>
        {/* fios principais engrossam fora da area de 10 mrad */}
        <line x1={-R} x2={-10.4} y1={0} y2={0} stroke="#0c0b0a" strokeWidth={0.32} />
        <line x1={10.4} x2={R} y1={0} y2={0} stroke="#0c0b0a" strokeWidth={0.32} />
        <line y1={10.4} y2={R} x1={0} x2={0} stroke="#0c0b0a" strokeWidth={0.32} />
        <line y1={-R} y2={-10.4} x1={0} x2={0} stroke="#0c0b0a" strokeWidth={0.32} />
        <line x1={-10.4} x2={10.4} y1={0} y2={0} {...line} />
        <line y1={-10.4} y2={10.4} x1={0} x2={0} {...line} />
        {ticks}
        <circle r={0.06} fill="#c2261c" />
        {/* ponto de espera do vento */}
        <path d={`M${HOLD},0.55 l-0.22,0.35 h0.44 z`} fill="#e8a76b" />
        <circle r={R} fill="url(#tube)" />
        <rect x={-w} y={-h} width={w * 2} height={h * 2} fill="#050403" mask="url(#eye)" />
      </svg>
      <div className="absolute bottom-[6vh] left-1/2 -translate-x-1/2 text-center font-mono text-[0.62rem] tracking-[0.35em] text-[#ece0cf]/70">
        25× · ELEV {n(SOLUTION.elevMrad, 1)} MRAD · {tr('VENTO', 'WIND')} {n(Math.abs(SOLUTION.azMrad), 1)} MRAD
      </div>
    </div>
  )
}
