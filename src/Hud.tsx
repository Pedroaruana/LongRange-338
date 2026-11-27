import { useEffect, useState } from 'react'
import { telemetry } from './world/telemetry'
import { P_SHOT, P_IMPACT, P_SCOPE_IN, sample } from './world/layout'
import { INTRO, SCOPE, FLIGHT, IMPACT, n, type Stage } from './hud/stages'
import { Chart } from './hud/Chart'
import { Reticle } from './hud/Reticle'
import { Home } from './hud/Home'
import { TrainHud } from './train/TrainHud'
import { train } from './train/lessons'
import { applyScenario } from './world/scenarios'
import { Calc } from './calc/Calc'
import { About } from './about/About'
import { lang, setLang, tr } from './i18n'
import { windStrength } from './world/wind'

const pick = (p: number, s: number): Stage => {
  if (p < P_SCOPE_IN) return INTRO
  if (p < P_SHOT) return SCOPE
  if (p >= P_IMPACT) return IMPACT
  return FLIGHT.find((st) => s < st.to) ?? FLIGHT[FLIGHT.length - 1]
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

type Mode = typeof telemetry.mode

export const Hud = ({ mode, onMode, onScenario }: { mode: Mode; onMode: (m: Mode) => void; onScenario: (id: string) => void }) => {
  // o tiro de 2000 m e a tela inicial sao sempre no deserto; a escola usa o cenario escolhido
  const scenarioTo = (id: string) => {
    applyScenario(id)
    onScenario(id)
  }
  const [, setTick] = useState(0)
  const [curtain, setCurtain] = useState(false)
  const [night, setNight] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 70)
    return () => clearInterval(id)
  }, [])

  // escurece, troca de tela com o scroll zerado e clareia de novo
  const go = (m: Mode) => {
    if (curtain) return
    setCurtain(true)
    setTimeout(() => {
      scrollTo(0, 0)
      telemetry.p = 0
      telemetry.s = 0
      telemetry.scope = 0
      telemetry.mode = m
      if (m === 'train') {
        train.phase = 'setup'
        scenarioTo(train.scenarioId)
      } else {
        windStrength.value = 1
        setNight(false)
        scenarioTo('desert')
      }
      onMode(m)
      setTimeout(() => setCurtain(false), 250)
    }, 800)
  }

  const { p, s, scope } = telemetry
  const q = sample(s)
  const stage = pick(p, s)
  const calc = stage.calc(q)
  const flying = p >= P_SHOT
  const reticle = smooth(0.8, 1, scope)

  return (
    <div className="pointer-events-none fixed inset-0 select-none font-mono text-[#ece0cf]">
      {/* fundo escuro por tras da tela inicial ate a cena 3D ficar pronta; o logo e as opcoes ja aparecem por cima */}
      <div className={`absolute inset-0 bg-[#0b0a09] transition-opacity duration-[1500ms] ${telemetry.ready ? 'opacity-0' : 'opacity-100'}`}>
        <div className="absolute bottom-[12vh] left-1/2 -translate-x-1/2 animate-pulse font-mono text-[0.6rem] tracking-[0.4em] text-[#e8a76b]/80">
          {tr('PREPARANDO A CENA', 'PREPARING THE SCENE')}
        </div>
      </div>

      {mode === 'home' && (
        <Home onShot={() => go('shot')} onTrain={() => go('train')} onCalc={() => go('calc')} onAbout={() => go('about')} leaving={curtain} />
      )}
      {mode === 'calc' && <Calc onExit={() => go('home')} />}
      {mode === 'about' && <About onExit={() => go('home')} />}
      {mode === 'train' && <TrainHud onExit={() => go('home')} onScenario={scenarioTo} />}
      {mode === 'shot' && (
      <>
      <Reticle opacity={reticle} />

      <div className="absolute inset-y-0 left-0 w-[48vw] bg-gradient-to-r from-black/60 via-black/25 to-transparent" />
      <div className="absolute left-[4vw] top-[5vh] text-[0.65rem] tracking-[0.55em] text-[#ece0cf]/55">LONGRANGE</div>
      <div data-ui className="pointer-events-auto absolute right-[4vw] top-[5vh] flex gap-6 text-[0.64rem] tracking-[0.35em]">
        <button
          onClick={() => {
            const next = !night
            setNight(next)
            scenarioTo(next ? 'night' : 'desert')
          }}
          className="cursor-pointer border-b border-[#ece0cf]/30 pb-1 text-[#ece0cf]/75 transition-colors hover:text-[#ffd2a6]"
        >
          {night ? tr('DIA', 'DAY') : tr('NOITE', 'NIGHT')}
        </button>
        <button onClick={() => go('home')} className="cursor-pointer border-b border-[#ece0cf]/30 pb-1 text-[#ece0cf]/75 transition-colors hover:text-[#ffd2a6]">
          {tr('INÍCIO', 'HOME')}
        </button>
      </div>

      <div key={stage.id} className="stage-in absolute left-[4vw] top-[11vh] w-[min(30rem,88vw)]">
        <div className="text-[0.65rem] tracking-[0.4em] text-[#e8a76b]">{stage.tag}</div>
        <h2 className="mt-3 text-[clamp(2rem,4.6vw,3.6rem)] font-light leading-none tracking-tight">{stage.title}</h2>
        <p className="mt-4 max-w-[27rem] text-[0.78rem] leading-6 text-[#ece0cf]/75">{stage.text}</p>

        <div className="mt-5 border-l border-[#e8a76b]/60 pl-4">
          <div className="text-[1rem] tracking-wide text-[#ffd2a6]">{calc.formula}</div>
          <div className="mt-2 space-y-1 text-[0.72rem] tabular-nums text-[#ece0cf]/70">
            {calc.steps.map((st, i) => <div key={i}>{st}</div>)}
          </div>
          <div className="mt-2 text-[0.95rem] tabular-nums text-[#ffd2a6]">= {calc.result}</div>
          {calc.note && <div className="mt-2 max-w-[26rem] text-[0.68rem] leading-5 text-[#ece0cf]/50">{calc.note}</div>}
        </div>

        <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-[0.7rem]">
          {stage.rows(q).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="uppercase tracking-[0.18em] text-[#ece0cf]/45">{k}</dt>
              <dd className="tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {flying && (
        <div className="absolute bottom-[5vh] left-[4vw] transition-opacity duration-700">
          <Chart s={s} />
        </div>
      )}

      <div className="absolute bottom-[5vh] right-[4vw] text-right">
        <div className="flex items-baseline justify-end gap-2">
          <span data-testid="distance" className="text-[clamp(3rem,8vw,6.5rem)] font-light leading-none tracking-[-0.04em] tabular-nums">{n(s)}</span>
          <span className="text-sm text-[#ece0cf]/50">m</span>
        </div>
        <div className="mt-3 flex justify-end gap-6 text-[0.68rem] tracking-[0.25em] text-[#ece0cf]/55 tabular-nums">
          <span>T {n(q.t, 2)} S</span>
          <span>V {n(q.v)} M/S</span>
          <span>MACH {n(q.mach, 2)}</span>
        </div>
      </div>

      {p < 0.012 && (
        <div className="absolute bottom-[5vh] left-1/2 -translate-x-1/2 animate-pulse text-[0.65rem] tracking-[0.5em] text-[#ece0cf]/60">
          {tr('ROLE PARA DISPARAR', 'SCROLL TO FIRE')}
        </div>
      )}
      </>
      )}

      <div className={`absolute inset-0 bg-[#0b0a09] transition-opacity duration-700 ${curtain ? 'opacity-100' : 'opacity-0'}`} />

      {/* idioma em qualquer tela; durante o tiro da escola ele fica na barra da propria escola */}
      {!(mode === 'train' && train.phase === 'run') && <div data-ui className="pointer-events-auto absolute left-1/2 top-[5vh] flex -translate-x-1/2 gap-6 font-mono text-[0.6rem] tracking-[0.35em] text-[#ece0cf]/55">
        <button onClick={() => setLang(lang.current === 'pt' ? 'en' : 'pt')} className="cursor-pointer transition-colors hover:text-[#ffd2a6]">
          <span className={lang.current === 'pt' ? 'text-[#ffd2a6]' : ''}>PT</span> / <span className={lang.current === 'en' ? 'text-[#ffd2a6]' : ''}>EN</span>
        </button>
      </div>}

    </div>
  )
}
