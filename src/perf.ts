// medicao do carregamento, so em desenvolvimento: perf('etapa') registra o tempo desde o inicio da pagina
const marks: [string, number][] = []
// ativo em desenvolvimento ou com ?perf na URL (para medir o build de producao)
const on = import.meta.env.DEV || location.search.includes('perf')

export const perf = (label: string) => {
  if (!on) return
  marks.push([label, Math.round(performance.now())])
  ;(window as Window & { __perf?: [string, number][] }).__perf = marks
}

// mede quanto um bloco sincrono levou
export const timed = <T>(label: string, fn: () => T): T => {
  if (!on) return fn()
  const t0 = performance.now()
  const r = fn()
  marks.push([`${label} (${Math.round(performance.now() - t0)} ms)`, Math.round(performance.now())])
  ;(window as Window & { __perf?: [string, number][] }).__perf = marks
  return r
}
