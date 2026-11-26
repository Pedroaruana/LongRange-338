import { SOLUTION } from '../world/layout'
import { telemetry } from '../world/telemetry'
import { AMMO, RANGE } from '../../shared/ballistics'
import { tr, num } from '../i18n'

// tela inicial: o canion passa por baixo enquanto a marca e as opcoes ficam paradas no centro

const end = SOLUTION.samples[RANGE]

// marca: retículo minimo com tracos de mrad e o ponto de impacto
const Mark = () => (
  <svg viewBox="-50 -50 100 100" className="h-[clamp(3.5rem,8vw,5.5rem)] w-[clamp(3.5rem,8vw,5.5rem)]">
    <circle r={44} fill="none" stroke="#ece0cf" strokeOpacity={0.55} strokeWidth={1} />
    <circle r={30} fill="none" stroke="#ece0cf" strokeOpacity={0.18} strokeWidth={1} strokeDasharray="2 5" />
    {[-1, 1].map((s) => (
      <g key={s} stroke="#ece0cf" strokeWidth={1.2}>
        <line x1={s * 50} x2={s * 12} y1={0} y2={0} />
        <line y1={s * 50} y2={s * 12} x1={0} x2={0} />
      </g>
    ))}
    {[-4, -3, -2, -1, 1, 2, 3, 4].map((i) => (
      <g key={i} stroke="#ece0cf" strokeOpacity={0.7} strokeWidth={1}>
        <line x1={i * 9} x2={i * 9} y1={-2.5} y2={2.5} />
        <line y1={i * 9} y2={i * 9} x1={-2.5} x2={2.5} />
      </g>
    ))}
    <circle r={2.2} fill="#e8a76b" />
  </svg>
)

// cada opcao: numero, titulo e uma linha do que acontece
const Option = ({ n, title, line, onClick }: { n: string; title: string; line: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="group pointer-events-auto w-[min(16rem,80vw)] cursor-pointer border-t border-[#ece0cf]/25 pt-4 text-left transition-colors hover:border-[#e8a76b]"
  >
    <div className="flex items-baseline gap-3">
      <span className="font-mono text-[0.62rem] tracking-[0.3em] text-[#e8a76b]">{n}</span>
      <span className="font-mono text-[0.74rem] tracking-[0.32em] text-[#ece0cf] transition-colors group-hover:text-[#ffd2a6]">{title}</span>
    </div>
    <div className="mt-2 pl-7 font-sans text-[0.76rem] leading-5 text-[#ece0cf]/60">{line}</div>
    <span className="mt-3 ml-7 block h-[1px] w-6 bg-[#e8a76b] transition-all duration-300 group-hover:w-16" />
  </button>
)

export const Home = ({ onShot, onTrain, onCalc, onAbout, leaving }: {
  onShot: () => void; onTrain: () => void; onCalc: () => void; onAbout: () => void; leaving: boolean
}) => (
  <div className={`absolute inset-0 transition-opacity duration-700 ${leaving ? 'opacity-0' : 'opacity-100'}`}>
    {/* escurece nas pontas do voo, quando a camera recomeca */}
    <div className="absolute inset-0 bg-[#0b0a09]" style={{ opacity: telemetry.homeFade }} />
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,.35)_0%,transparent_60%)]" />

    <div className="absolute left-[4vw] top-[5vh] font-mono text-[0.62rem] tracking-[0.5em] text-[#ece0cf]/55">{tr('ESTUDO BALÍSTICO', 'BALLISTICS STUDY')}</div>
    <button
      onClick={onAbout}
      className="pointer-events-auto absolute right-[4vw] top-[5vh] cursor-pointer border-b border-[#ece0cf]/30 pb-1 font-mono text-[0.62rem] tracking-[0.4em] text-[#ece0cf]/70 transition-colors hover:text-[#ffd2a6]"
    >
      {tr('COMO FOI FEITO', 'HOW IT WAS BUILT')}
    </button>

    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
      <Mark />
      {/* stencil militar, enorme, com a areia aparecendo por tras numa sombra larga */}
      <h1
        className="mt-5 pl-[0.12em] font-display text-[clamp(4rem,15vw,12.5rem)] font-black leading-[0.82] tracking-[0.12em] text-[#f1e6d4]"
        style={{ textShadow: '0 0.04em 0.5em rgba(0,0,0,.45), 0 0 0.02em rgba(0,0,0,.6)' }}
      >
        LONGRANGE
      </h1>
      <div className="mt-3 flex items-center gap-4 font-mono text-[0.62rem] tracking-[0.55em] text-[#e8a76b]">
        <span className="h-px w-10 bg-[#e8a76b]/70" />
        {tr('2000 METROS', '2000 METERS')}
        <span className="h-px w-10 bg-[#e8a76b]/70" />
      </div>
      <p className="mt-6 max-w-[34rem] px-6 font-sans text-[0.92rem] leading-7 text-[#ece0cf]/80">
        {tr(
          `Um tiro de ${num(RANGE)} metros, calculado do cano ao alvo. Gravidade, vento, ar, barreira do som, giro e a rotação da Terra.`,
          `A ${num(RANGE)} meter shot, computed from muzzle to target. Gravity, wind, air, the sound barrier, spin and the Earth’s rotation.`
        )}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-x-7 gap-y-1 font-mono text-[0.64rem] tracking-[0.3em] text-[#ece0cf]/50 tabular-nums">
        <span>{AMMO.v0} M/S</span>
        <span>{num(end.t, 2)} {tr('S DE VOO', 'S OF FLIGHT')}</span>
        <span>{num(end.drop, 0)} {tr('M DE QUEDA', 'M OF DROP')}</span>
        <span>{num(Math.abs(end.wind), 1)} {tr('M DE VENTO', 'M OF WIND')}</span>
      </div>

      <div className="mt-12 flex flex-wrap justify-center gap-x-10 gap-y-6">
        <Option n="01" title={tr('O TIRO DE 2000 M', 'THE 2000 M SHOT')} line={tr('Role e acompanhe a bala do cano até a placa, com a física de cada trecho.', 'Scroll and follow the bullet from muzzle to plate, with the physics of each leg.')} onClick={onShot} />
        <Option n="02" title={tr('ESCOLA DE TIRO', 'SNIPER SCHOOL')} line={tr('Aprenda a ler o retículo, medir a distância e segurar queda e vento.', 'Learn to read the reticle, range a target and hold for drop and wind.')} onClick={onTrain} />
        <Option n="03" title={tr('CALCULADORA', 'CALCULATOR')} line={tr('Tabela de tiro e curvas de quatro munições, com todos os parâmetros abertos.', 'Dope table and curves for four cartridges, every input exposed.')} onClick={onCalc} />
      </div>
    </div>

    <div className="absolute bottom-[5vh] left-[4vw] font-mono text-[0.62rem] leading-5 tracking-[0.3em] text-[#ece0cf]/45">
      <div>36.0544 N / 112.1401 W</div>
      <div>31 °C · 912 HPA · {tr('VENTO', 'WIND')} 5 M/S</div>
    </div>
    <div className="absolute bottom-[5vh] right-[4vw] text-right font-mono text-[0.62rem] tracking-[0.3em] text-[#ece0cf]/45 tabular-nums">
      ALT {num(telemetry.homeAlt)} M
    </div>
  </div>
)
