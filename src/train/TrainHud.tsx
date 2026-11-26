import type { ReactNode } from 'react'
import { train, LESSONS, startLesson, startFree, hitTarget, activeScope, air, dopeTable, windFromScenario, loadRanking } from './lessons'
import { AMMOS } from '../../shared/ballistics'
import { gun } from './engine'
import { PLATES, MOVER } from './engine'
import { SCOPES, toUnit, unitLabel, clicks } from './scopes'
import { ScopeView, ReticleThumb } from './Reticles'
import { SCENARIOS, scenario } from '../world/scenarios'
import { airDensity } from '../../shared/ballistics'
import { n } from '../hud/stages'
import { tr, lang, setLang } from '../i18n'

// painel da escola de tiro: preparacao (modo, cenario, luneta), licoes guiadas e treino livre.
// re-renderiza junto com o HUD (a cada 70 ms), lendo o estado mutavel do treino

// a mira depende de mouse travado, roda e teclado: em tela de toque ou janela estreita nao da para jogar
const canPlay = () => !matchMedia('(pointer: coarse)').matches && innerWidth >= 900

const Btn = ({ children, onClick, primary, disabled }: { children: ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean }) => (
  <button
    data-ui
    onClick={onClick}
    disabled={disabled}
    className={`pointer-events-auto cursor-pointer border-b pb-1 text-[0.66rem] tracking-[0.35em] transition-colors disabled:cursor-default disabled:opacity-30 ${
      primary ? 'border-[#e8a76b] text-[#ffd2a6] hover:text-white' : 'border-[#ece0cf]/30 text-[#ece0cf]/70 hover:text-[#ece0cf]'
    }`}
  >
    {children}
  </button>
)

// item de escolha: linha fina em cima, acende quando selecionado
const Pick = ({ on, onClick, children, disabled }: { on: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) => (
  <button
    data-ui
    onClick={onClick}
    disabled={disabled}
    className={`pointer-events-auto block w-full cursor-pointer border-t py-3 text-left transition-colors disabled:cursor-default disabled:opacity-35 ${
      on ? 'border-[#e8a76b]' : 'border-[#ece0cf]/15 hover:border-[#ece0cf]/45'
    }`}
  >
    {children}
  </button>
)

const Head = ({ children }: { children: ReactNode }) => (
  <div className="mb-3 text-[0.6rem] tracking-[0.45em] text-[#e8a76b]">{children}</div>
)

const fmt = (mrad: number) => {
  const s = activeScope()
  return `${n(toUnit(mrad, s), s.unit === 'moa' ? 2 : 1)} ${unitLabel(s)}`
}

// ---------- preparacao ----------
const Setup = ({ onScenario, onExit }: { onScenario: (id: string) => void; onExit: () => void }) => {
  const lessons = train.mode === 'lessons'
  const ranking = loadRanking()
  return (
    <div className="absolute inset-0 overflow-y-auto bg-black/55">
      <div data-ui className="pointer-events-auto mx-auto max-w-[68rem] px-[4vw] py-[7vh]">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-[0.62rem] tracking-[0.5em] text-[#ece0cf]/55">LONGRANGE</div>
            <h1 className="mt-3 text-[clamp(2rem,4.5vw,3.4rem)] font-extralight tracking-[0.2em]">{tr('ESCOLA DE TIRO', 'SNIPER SCHOOL')}</h1>
          </div>
          <Btn onClick={onExit}>{tr('VOLTAR', 'BACK')}</Btn>
        </div>

        <div className="mt-10 grid gap-x-12 gap-y-10 md:grid-cols-3">
          <div>
            <Head>{tr('01 · MODO', '01 · MODE')}</Head>
            <Pick on={lessons} onClick={() => { train.mode = 'lessons' }}>
              <div className="text-[0.78rem] tracking-[0.2em]">{tr('Lições guiadas', 'Guided lessons')}</div>
              <div className="mt-1 text-[0.68rem] leading-5 text-[#ece0cf]/55">{tr('Sete lições: miliradiano, distância, queda, vento, torre, alvo em movimento e prova.', 'Seven lessons: milliradian, ranging, drop, wind, turret, moving target and a final test.')}</div>
            </Pick>
            <Pick on={!lessons} onClick={() => { train.mode = 'free' }}>
              <div className="text-[0.78rem] tracking-[0.2em]">{tr('Treino livre', 'Free practice')}</div>
              <div className="mt-1 text-[0.68rem] leading-5 text-[#ece0cf]/55">{tr('Escolha a placa, use a tabela de tiro, gire a torre e acompanhe o agrupamento.', 'Pick a plate, use the dope card, dial the turret and track your group.')}</div>
            </Pick>

            <div className="mt-8"><Head>{tr('04 · MUNIÇÃO', '04 · AMMUNITION')}</Head></div>
            {AMMOS.map((a) => (
              <Pick key={a.id} on={train.ammoId === a.id} onClick={() => { train.ammoId = a.id }}>
                <div className="text-[0.78rem] tracking-[0.2em]">{a.name}</div>
                <div className="mt-1 text-[0.6rem] tracking-[0.15em] text-[#ece0cf]/45 tabular-nums">
                  {a.bullet} · {a.v0} m/s · G7 {n(a.bcG7, 3)}
                </div>
              </Pick>
            ))}

            {ranking.length > 0 && (
              <div className="mt-8">
                <Head>{tr('RANKING DA PROVA', 'TEST LEADERBOARD')}</Head>
                {ranking.slice(0, 5).map((r, i) => (
                  <div key={r.date} className="flex justify-between border-t border-[#ece0cf]/10 py-1.5 text-[0.66rem] tabular-nums">
                    <span className="text-[#ece0cf]/45">{i + 1}.</span>
                    <span className="text-[#ffd2a6]">{r.hits}/{r.shots}</span>
                    <span className="text-[#ece0cf]/60">{r.scenario}</span>
                    <span className="text-[#ece0cf]/40">{r.ammo}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <Head>{tr('02 · CENÁRIO', '02 · SCENE')}</Head>
            {SCENARIOS.map((s) => (
              <Pick key={s.id} on={train.scenarioId === s.id} onClick={() => { train.scenarioId = s.id; onScenario(s.id) }}>
                <div className="text-[0.78rem] tracking-[0.2em]">{s.name}</div>
                <div className="mt-1 text-[0.68rem] leading-5 text-[#ece0cf]/55">{s.line}</div>
                <div className="mt-1 text-[0.6rem] tracking-[0.2em] text-[#ece0cf]/40 tabular-nums">
                  {s.air.tempC} °C · {s.air.pressHPa} HPA · {tr('VENTO', 'WIND')} {s.wind} M/S
                </div>
              </Pick>
            ))}
          </div>

          <div>
            <Head>{tr('03 · LUNETA', '03 · SCOPE')}</Head>
            {SCOPES.map((s) => (
              <Pick key={s.id} on={(lessons ? 'tactical' : train.scopeId) === s.id} disabled={lessons && s.id !== 'tactical'} onClick={() => { train.scopeId = s.id }}>
                <div className="flex gap-4">
                  <ReticleThumb scope={s} />
                  <div>
                    <div className="text-[0.78rem] tracking-[0.2em]">{s.name}</div>
                    <div className="text-[0.6rem] tracking-[0.15em] text-[#e8a76b]/80">{s.model}</div>
                    <div className="mt-1 text-[0.66rem] leading-5 text-[#ece0cf]/55">{s.line}</div>
                  </div>
                </div>
              </Pick>
            ))}
            {lessons && <div className="mt-2 text-[0.62rem] leading-5 text-[#ece0cf]/45">{tr('As lições usam a luneta tática. No treino livre todas ficam disponíveis.', 'Lessons use the tactical scope. All scopes are available in free practice.')}</div>}
          </div>
        </div>

        <div className="mt-12">
          {!canPlay() ? (
            <div className="max-w-[30rem] border-l-2 border-[#e8a76b] pl-4 text-[0.78rem] leading-6 text-[#ece0cf]/80">
              {tr(
                'A escola de tiro usa mouse e teclado: a mira trava o mouse, a roda muda o aumento e o WASD gira a torre. Abra no computador, com a janela larga, para jogar.',
                'The sniper school needs a mouse and keyboard: aiming locks the mouse, the wheel sets the power and WASD dials the turret. Open it on a computer, in a wide window, to play.'
              )}
            </div>
          ) : (
          <Btn primary onClick={() => {
            // le o estado na hora do clique: o painel so redesenha a cada 70 ms
            train.phase = 'run'
            if (train.mode === 'lessons') startLesson(0)
            else startFree()
          }}>
            {tr('COMEÇAR', 'START')}
          </Btn>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------- licoes ----------
const LessonPanel = () => {
  const l = LESSONS[train.lesson]
  const shot = train.shot
  const done = !!shot && train.resolved
  const target = PLATES[train.target]
  const passed =
    l.kind === 'range' ? train.answer === target.d
    : l.id === 'mrad' ? done
    : l.id === 'test' ? train.shots >= (l.shots ?? 5) && train.resolved
    : done && !!shot && hitTarget(shot)
  const last = train.lesson === LESSONS.length - 1
  const table = l.id === 'test' ? dopeTable([3, 4, 5, 6], train.windX, activeScope()) : []

  return (
    <div key={l.id} data-ui className="stage-in absolute left-[4vw] top-[11vh] max-h-[80vh] w-[min(28rem,88vw)] overflow-y-auto pr-2 font-sans">
      <div className="font-mono text-[0.65rem] tracking-[0.4em] text-[#e8a76b]">{tr('LIÇÃO', 'LESSON')} {l.num} {tr('DE', 'OF')} {LESSONS.length}</div>
      <h2 className="mt-2 text-[clamp(1.7rem,3vw,2.4rem)] font-semibold leading-tight tracking-tight text-[#f4ead9]">{l.title}</h2>

      {/* primeiro o que fazer, depois os numeros, depois o porque */}
      <div className="mt-5 border-l-2 border-[#e8a76b] pl-4">
        <div className="font-mono text-[0.6rem] tracking-[0.35em] text-[#e8a76b]">{tr('O QUE FAZER', 'WHAT TO DO')}</div>
        <div className="mt-1.5 text-[0.98rem] leading-7 text-[#fff4e4]">{l.task()}</div>
      </div>

      {l.big && (
        <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
          {l.big().map(([k, v]) => (
            <div key={k}>
              <div className="font-mono text-[0.58rem] uppercase tracking-[0.3em] text-[#ece0cf]/50">{k}</div>
              <div className="mt-1 font-mono text-[1.55rem] leading-none tabular-nums text-[#ffd2a6]">{v}</div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 font-mono text-[0.58rem] tracking-[0.35em] text-[#ece0cf]/45">{tr('POR QUÊ', 'WHY')}</div>
      <div className="mt-2 space-y-2.5 text-[0.86rem] leading-6 text-[#ece0cf]/78">
        {l.body().map((p, i) => <p key={i}>{p}</p>)}
      </div>

      {l.kind === 'range' && (
        <>
          <div className="mt-4 flex gap-5">
            {l.options!.map((d) => <Btn key={d} onClick={() => { train.answer = d }} primary={train.answer === d}>{d} M</Btn>)}
          </div>
          <div className="mt-2 font-mono text-[0.6rem] tracking-[0.25em] text-[#ece0cf]/50">{tr('OU TECLE 3, 4, 5 OU 6 SEM SOLTAR A MIRA', 'OR PRESS 3, 4, 5 OR 6 WITHOUT LEAVING THE SCOPE')}</div>
          {train.answer !== null && (
            <div className="mt-3 text-[0.72rem] leading-5 text-[#ece0cf]/70">
              {train.answer === target.d
                ? tr(`Certo. A placa ocupa ${n(1000 / target.d, 2)} mrad: 1 × 1000 / ${n(1000 / target.d, 2)} = ${target.d} m.`, `Correct. The plate covers ${n(1000 / target.d, 2)} mrad: 1 × 1000 / ${n(1000 / target.d, 2)} = ${target.d} m.`)
                : tr('Ainda não. Apoie a base da placa na linha e compare a altura com cada barra.', 'Not yet. Rest the plate base on the line and compare its height with each bar.')}
            </div>
          )}
        </>
      )}

      {l.id === 'test' && (
        <div className="mt-5 text-[0.7rem]">
          <div className="flex justify-between tracking-[0.3em] text-[#ece0cf]/55">
            <span>{tr('TELÊMETRO', 'RANGEFINDER')}</span>
            <span className="tabular-nums text-[#ffd2a6]">{target.d} M</span>
          </div>
          <DopeGrid rows={table} current={target.d} />
          <div className="mt-3 tracking-[0.3em] text-[#ece0cf]/55">
            {tr('TIROS', 'SHOTS')} {train.shots}/{l.shots} · {tr('ACERTOS', 'HITS')} <span className="text-[#ffd2a6]">{train.hits}</span>
          </div>
        </div>
      )}

      {done && l.after && (
        <div className={`mt-5 border-l-2 pl-4 ${hitTarget(shot!) ? 'border-[#8fd16a]' : 'border-[#e06a4a]'}`}>
          <div className={`font-mono text-[0.6rem] tracking-[0.35em] ${hitTarget(shot!) ? 'text-[#a8e08a]' : 'text-[#f08a6a]'}`}>
            {hitTarget(shot!) ? tr('ACERTOU', 'HIT') : tr('ERROU', 'MISS')}
          </div>
          <div className="mt-1 text-[0.9rem] leading-6 text-[#fff4e4]">{l.after(shot!)}</div>
          <div className="mt-1 font-mono text-[0.66rem] text-[#ece0cf]/45 tabular-nums">{tr('voo de', 'flight of')} {n(shot!.tImpact, 2)} s {tr('até', 'to')} {n(shot!.path.length - 1)} m</div>
        </div>
      )}

      <div className="mt-6 flex gap-7">
        {!last && <Btn primary disabled={!passed} onClick={() => startLesson(train.lesson + 1)}>{tr('PRÓXIMA LIÇÃO', 'NEXT LESSON')}</Btn>}
        {last && passed && <Btn primary onClick={() => startLesson(train.lesson)}>{tr('REFAZER PROVA', 'RETAKE TEST')}</Btn>}
        {l.kind === 'shoot' && !last && <Btn onClick={() => startLesson(train.lesson)}>{tr('REPETIR', 'RETRY')}</Btn>}
      </div>
      {last && passed && (
        <div className="mt-4 text-[0.86rem] leading-6 text-[#ffd2a6]">
          {tr('Resultado', 'Result')}: {train.hits} {tr('de', 'of')} {l.shots} {tr('placas', 'plates')}.{' '}
          {train.hits >= 4 ? tr('Pronto para os 2000 m.', 'Ready for 2000 m.') : train.hits >= 2 ? tr('Bom começo. Atenção às rajadas.', 'Good start. Mind the gusts.') : tr('Volte às lições 03 a 05.', 'Go back to lessons 03 to 05.')}
          <div className="mt-3 font-mono text-[0.58rem] tracking-[0.35em] text-[#ece0cf]/45">RANKING</div>
          {loadRanking().slice(0, 5).map((r, i) => (
            <div key={r.date} className="flex gap-4 font-mono text-[0.68rem] tabular-nums text-[#ece0cf]/75">
              <span>{i + 1}.</span><span className="text-[#ffd2a6]">{r.hits}/{r.shots}</span><span>{r.scenario}</span><span className="text-[#ece0cf]/45">{r.ammo}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

type Row = { id: number; d: number; drop: number; wind: number; dropClicks: number; windClicks: number; unit: string }
const DopeGrid = ({ rows, current }: { rows: Row[]; current: number }) => (
  <div className="mt-3 grid grid-cols-[auto_1fr_1fr] gap-x-4 gap-y-1 text-[0.68rem] tabular-nums">
    <span className="text-[#ece0cf]/45">DIST</span>
    <span className="text-[#ece0cf]/45">{tr('QUEDA', 'DROP')} {rows[0]?.unit.toUpperCase()}</span>
    <span className="text-[#ece0cf]/45">{tr('VENTO', 'WIND')}</span>
    {rows.map((r) => (
      <div key={r.id} className={`contents ${r.d === current ? 'text-[#ffd2a6]' : 'text-[#ece0cf]/70'}`}>
        <span>{r.d} m</span>
        <span>{n(r.drop, 1)} <span className="text-[#ece0cf]/40">({r.dropClicks})</span></span>
        <span>{n(Math.abs(r.wind), 1)} {r.wind < 0 ? tr('E', 'L') : tr('D', 'R')} <span className="text-[#ece0cf]/40">({r.windClicks})</span></span>
      </div>
    ))}
  </div>
)

// agrupamento: onde os ultimos tiros cairam em relacao a placa de 1 m da distancia atual
const Group = ({ d }: { d: number }) => {
  const shots = train.log.filter((s) => s.d === d)
  const S = 1.6 // metros mostrados de lado a lado
  return (
    <svg viewBox={`${-S / 2} ${-S / 2} ${S} ${S}`} className="mt-2 h-32 w-32">
      <rect x={-0.5} y={-0.5} width={1} height={1} fill="#e8e4da" fillOpacity={0.12} stroke="#ece0cf" strokeOpacity={0.5} strokeWidth={0.008} />
      <line x1={-0.5} x2={0.5} y1={0} y2={0} stroke="#ece0cf" strokeOpacity={0.15} strokeWidth={0.005} />
      <line y1={-0.5} y2={0.5} x1={0} x2={0} stroke="#ece0cf" strokeOpacity={0.15} strokeWidth={0.005} />
      {shots.map((s, i) => {
        const x = Math.max(-S / 2, Math.min(S / 2, (s.right * d) / 1000))
        const y = Math.max(-S / 2, Math.min(S / 2, (-s.up * d) / 1000))
        return <circle key={i} cx={x} cy={y} r={0.035} fill={s.hit ? '#b9e3a0' : '#e8a76b'} fillOpacity={1 - i * 0.07} />
      })}
    </svg>
  )
}

// ---------- treino livre ----------
const FreePanel = ({ onSetup }: { onSetup: () => void }) => {
  const s = activeScope()
  const a = air()
  const target = PLATES[train.target]
  const rows = dopeTable([0, 1, 2, 3, 4, 5, 6, MOVER], train.windX, s)
  const shot = train.shot
  const pct = train.shots ? Math.round((train.hits / train.shots) * 100) : 0
  return (
    <div data-ui className="absolute left-[4vw] top-[11vh] w-[min(27rem,88vw)]">
      <div className="text-[0.65rem] tracking-[0.4em] text-[#e8a76b]">{tr('TREINO LIVRE', 'FREE PRACTICE')}</div>
      <h2 className="mt-3 text-[clamp(1.6rem,3vw,2.4rem)] font-light leading-none tracking-tight">{scenario.current.name}</h2>
      <div className="mt-2 text-[0.66rem] tracking-[0.15em] text-[#ece0cf]/60">{s.name} · {s.model} · {gun.ammo.name}</div>

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-[0.66rem] tabular-nums">
        <span className="text-[#ece0cf]/45">{tr('AR', 'AIR')}</span>
        <span>{a.tempC} °C · {a.pressHPa} hPa · {n(airDensity(a), 3)} kg/m³</span>
        <span className="text-[#ece0cf]/45">{tr('VENTO', 'WIND')}</span>
        <span className="flex items-center gap-3">
          {train.windX === 0 ? tr('calmo', 'calm') : `${n(Math.abs(train.windX), 1)} m/s ${tr('da direita', 'from the right')}${train.gusts ? tr(', em rajadas', ', gusting') : ''}`}
          <Btn onClick={() => {
            train.windOn = !train.windOn
            train.gusts = train.windOn
            train.windX = train.windOn ? windFromScenario() : 0
          }}>{train.windOn ? tr('DESLIGAR', 'TURN OFF') : tr('LIGAR', 'TURN ON')}</Btn>
        </span>
      </div>

      <div className="mt-5 text-[0.6rem] tracking-[0.4em] text-[#ece0cf]/45">{tr('ALVO', 'TARGET')}</div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
        {PLATES.map((p) => (
          <Btn key={p.id} primary={p.id === train.target} onClick={() => { train.target = p.id; train.shot = null; train.resolved = false }}>
            {p.move ? `${p.d} ${tr('MÓVEL', 'MOVING')}` : `${p.d}`}
          </Btn>
        ))}
      </div>

      <DopeGrid rows={rows} current={target.d} />

      <div className="mt-4 flex items-start gap-6">
        <Group d={target.d} />
        <div className="text-[0.66rem] leading-5 tabular-nums">
          <div className="tracking-[0.3em] text-[#ece0cf]/45">{tr('AGRUPAMENTO', 'GROUP')} {target.d} M</div>
          <div className="mt-1">{tr('tiros', 'shots')} {train.shots} · {tr('acertos', 'hits')} {train.hits} · {pct}%</div>
          {shot && train.resolved && <div className={`mt-2 ${hitTarget(shot) ? 'text-[#b9e3a0]' : 'text-[#ece0cf]/75'}`}>
            {hitTarget(shot) ? tr('acertou', 'hit') : `${fmt(Math.abs(shot.up))} ${shot.up >= 0 ? tr('alto', 'high') : tr('baixo', 'low')}, ${fmt(Math.abs(shot.right))} ${shot.right >= 0 ? tr('à direita', 'right') : tr('à esquerda', 'left')}`}
          </div>}
          {target.move && <div className="mt-2 text-[#ece0cf]/55">{tr('a placa anda a', 'the plate moves at')} {target.move.speed} m/s: {tr('segure à frente', 'lead it')}</div>}
        </div>
      </div>

      <div className="mt-5">
        <Btn onClick={onSetup}>{tr('TROCAR CENÁRIO OU LUNETA', 'CHANGE SCENE OR SCOPE')}</Btn>
      </div>
    </div>
  )
}

export const TrainHud = ({ onExit, onScenario }: { onExit: () => void; onScenario: (id: string) => void }) => {
  if (train.phase === 'setup') return <Setup onScenario={onScenario} onExit={onExit} />

  const s = activeScope()
  const unit = unitLabel(s)
  const dial = (mrad: number, pos: string, neg: string) =>
    `${n(Math.abs(toUnit(mrad, s)), s.unit === 'moa' ? 2 : 1)} ${unit} ${mrad === 0 ? '' : mrad > 0 ? pos : neg} (${clicks(Math.abs(mrad), s)})`

  const m = train.mark
  const shot = train.shot
  const replaying = train.replay > 0

  return (
    <>
      {replaying ? (
        <div className="absolute left-1/2 top-[12vh] -translate-x-1/2 font-mono text-[0.7rem] tracking-[0.5em] text-[#ffd2a6]">{tr('REPLAY · TRAJETÓRIA VISTA DE LADO', 'REPLAY · TRAJECTORY FROM THE SIDE')}</div>
      ) : (
        <ScopeView scope={s} mag={train.mag} />
      )}

      {/* resultado do tiro num lugar fixo, abaixo do centro; o anel fica na cena, no ponto do impacto */}
      {m && shot && m.age < 3 && (
        <div
          className="absolute left-1/2 top-[56%] -translate-x-1/2 whitespace-nowrap bg-black/60 px-4 py-2 text-center font-mono"
          style={{ opacity: 1 - Math.max(0, m.age - 2.2) / 0.8 }}
        >
          <span className={`text-[0.78rem] tracking-[0.3em] ${m.hit ? 'text-[#a8e08a]' : shot.hit ? 'text-[#f0c060]' : 'text-[#f08a6a]'}`}>
            {m.hit ? tr('ACERTOU', 'HIT') : shot.hit ? tr(`ACERTOU A PLACA DE ${shot.hit.d} M`, `HIT THE ${shot.hit.d} M PLATE`) : tr('ERROU', 'MISS')}
          </span>
          {!m.hit && (
            <span className="ml-3 text-[0.72rem] text-[#fff4e4]/85">
              {fmt(Math.abs(shot.up))} {shot.up >= 0 ? tr('alto', 'high') : tr('baixo', 'low')} · {fmt(Math.abs(shot.right))} {shot.right >= 0 ? tr('à direita', 'right') : tr('à esquerda', 'left')} {tr('da de', 'of the')} {shot.target.d} m
            </span>
          )}
        </div>
      )}

      {/* antes de travar o mouse: convite claro no centro da luneta */}
      {!train.locked && (
        <div className="absolute left-1/2 top-[62%] -translate-x-1/2 text-center">
          <div className="bg-black/55 px-5 py-2.5 font-mono text-[0.72rem] tracking-[0.3em] text-[#ffd2a6]">{tr('CLIQUE NA LUNETA PARA MIRAR', 'CLICK THE SCOPE TO AIM')}</div>
          <div className="mt-2 font-sans text-[0.78rem] text-[#ece0cf]/70">{tr('o mouse vira a luneta · Esc solta o mouse para usar o painel', 'the mouse becomes the scope · Esc releases it to use the panel')}</div>
        </div>
      )}

      <div className="absolute inset-y-0 left-0 w-[46vw] bg-gradient-to-r from-black/90 via-black/65 to-transparent" />

      <div data-ui className="pointer-events-auto absolute left-[4vw] top-[5vh] flex items-center gap-5 text-[0.62rem] tracking-[0.35em]">
        <span className="text-[#ece0cf]/55">{tr('ESCOLA DE TIRO', 'SNIPER SCHOOL')}</span>
        {train.mode === 'lessons' && LESSONS.map((x, i) => (
          <button key={x.id} onClick={() => startLesson(i)}
            className={`cursor-pointer tabular-nums transition-colors ${i === train.lesson ? 'text-[#e8a76b]' : 'text-[#ece0cf]/35 hover:text-[#ece0cf]/70'}`}>
            {x.num}
          </button>
        ))}
      </div>
      <div className="absolute right-[4vw] top-[5vh] flex gap-6">
        {shot && train.resolved && !replaying && <Btn primary onClick={() => { train.replay = performance.now() / 1000 }}>{tr('REPLAY (V)', 'REPLAY (V)')}</Btn>}
        <Btn onClick={() => setLang(lang.current === 'pt' ? 'en' : 'pt')}>{lang.current === 'pt' ? 'EN' : 'PT'}</Btn>
        <Btn onClick={() => { train.phase = 'setup' }}>{tr('PREPARAÇÃO', 'SETUP')}</Btn>
        <Btn onClick={onExit}>{tr('SAIR', 'EXIT')}</Btn>
      </div>

      {train.mode === 'lessons' ? <LessonPanel /> : <FreePanel onSetup={() => { train.phase = 'setup' }} />}

      <div className="absolute bottom-[2.5vh] left-1/2 flex -translate-x-1/2 items-center gap-7 whitespace-nowrap text-[0.6rem] tracking-[0.3em] text-[#ece0cf]/60">
        <span>{train.locked ? tr('ESC SOLTA O MOUSE', 'ESC RELEASES MOUSE') : tr('CLIQUE PARA MIRAR', 'CLICK TO AIM')}</span>
        <span>{tr('CLIQUE ATIRA', 'CLICK FIRES')}</span>
        <span>{tr('RODA', 'WHEEL')} {train.mag}× {s.ffp ? 'FFP' : 'SFP'}</span>
        <span>{tr('WASD TORRE', 'WASD TURRET')}</span>
        <span>V REPLAY</span>
        <span className="flex items-center gap-2">
          {tr('ESPAÇO RESPIRA', 'SPACE BREATH')}
          <span className="inline-block h-[3px] w-14 bg-[#ece0cf]/15">
            <span className="block h-full bg-[#e8a76b]" style={{ width: `${train.breath * 100}%` }} />
          </span>
        </span>
      </div>
      <div className="absolute bottom-[7vh] right-[4vw] text-right text-[0.62rem] leading-5 tracking-[0.25em] text-[#ece0cf]/60 tabular-nums">
        <div>ELEV {dial(train.dialElev, tr('CIMA', 'UP'), tr('BAIXO', 'DOWN'))}</div>
        <div>{tr('DERIVA', 'WINDAGE')} {dial(train.dialWind, tr('DIR', 'R'), tr('ESQ', 'L'))}</div>
        <div className="text-[#ece0cf]/40">ZERO 100 M · {train.windX === 0 ? tr('VENTO CALMO', 'CALM WIND') : `${tr('VENTO', 'WIND')} ${n(Math.abs(train.windX), 1)} M/S`}</div>
        {!s.ffp && train.mag !== s.magMax && <div className="text-[#e8a76b]">{tr('SFP: MARCAS SÓ VALEM EM', 'SFP: MARKS ONLY TRUE AT')} {s.magMax}×</div>}
      </div>
    </>
  )
}
