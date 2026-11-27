import type { DopeInput } from '../shared/dope'
import type { Score, ScoreInput } from '../shared/ranking'

// cliente da API do LONGRANGE. em desenvolvimento o Vite repassa /api para o servidor local;
// na AWS o CloudFront manda /api para a Lambda. quem chama sempre tem um plano B local

const TIMEOUT_MS = 4000

const call = async <T>(path: string, body?: unknown): Promise<T> => {
  const res = await fetch(`/api${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  })
  if (!res.ok) throw new Error(`API ${path} respondeu ${res.status}`)
  return (await res.json()) as T
}

export type SolveRow = {
  range: number
  time: number
  velocity: number
  mach: number
  energy: number
  drop: number
  windage: number
}

export const api = {
  solve: (input: DopeInput & { step?: number }) => call<{ table: SolveRow[] }>('/solve', input),
  ranking: (limit = 10) => call<{ ranking: Score[] }>(`/ranking?limit=${limit}`),
  addScore: (score: ScoreInput) => call<{ score: Score }>('/ranking', score)
}
