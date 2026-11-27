import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { AMMOS } from '../shared/ballistics'
import { dope } from '../shared/dope'
import { scoreInput } from '../shared/ranking'
import type { RankingStore } from './store'

// API do LONGRANGE: tabela de tiro calculada com o mesmo motor do site e ranking da prova da escola

const ammoIds = AMMOS.map((a) => a.id) as [string, ...string[]]

const solveInput = z
  .object({
    ammo: z.enum(ammoIds),
    range: z.number().int().min(100).max(2500),
    tempC: z.number().min(-30).max(50),
    pressHPa: z.number().min(600).max(1100),
    wind: z.number().min(-20).max(20),
    zero: z.number().int().min(50).max(300),
    step: z.number().int().min(10).max(500).default(100)
  })
  .refine((i) => i.zero < i.range, { message: 'zero tem que ser menor que range', path: ['zero'] })

const rankingQuery = z.object({ limit: z.coerce.number().int().min(1).max(50).default(10) })

// erro de validacao sempre no mesmo formato: 400 com a lista de campos
const invalid = (result: { success: boolean; error?: z.core.$ZodError }, c: { json: (b: unknown, s: 400) => Response }) => {
  if (!result.success && result.error) {
    return c.json({ error: 'invalid_input', issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) }, 400)
  }
}

export const createApp = (store: RankingStore, now = () => Date.now()) => {
  const app = new Hono().basePath('/api')

  app.get('/health', (c) => c.json({ ok: true }))

  app.post('/solve', zValidator('json', solveInput, invalid), (c) => {
    const i = c.req.valid('json')
    const rows = dope(i)
    // a tabela completa tem um ponto por metro; a API devolve so a cada `step` metros
    const table = rows
      .filter((r) => r.s > 0 && (r.s % i.step === 0 || r.s === i.range))
      .map((r) => ({
        range: r.s,
        time: r.t,
        velocity: r.v,
        mach: r.mach,
        energy: r.energy,
        drop: r.drop,
        windage: r.wind,
        dropMrad: (r.drop / r.s) * 1000,
        windageMrad: (r.wind / r.s) * 1000
      }))
    return c.json({ input: i, table })
  })

  app.get('/ranking', zValidator('query', rankingQuery, invalid), async (c) => {
    const { limit } = c.req.valid('query')
    return c.json({ ranking: await store.top(limit) })
  })

  app.post('/ranking', zValidator('json', scoreInput, invalid), async (c) => {
    const score = { ...c.req.valid('json'), date: now() }
    await store.add(score)
    return c.json({ score }, 201)
  })

  app.notFound((c) => c.json({ error: 'not_found' }, 404))
  app.onError((err, c) => {
    console.error(err)
    return c.json({ error: 'internal_error' }, 500)
  })

  return app
}
