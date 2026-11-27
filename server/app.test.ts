import { describe, it, expect, beforeEach } from 'vitest'
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { createApp } from './app'
import { memoryStore, dynamoStore } from './store'
import { dope } from '../shared/dope'

// as rotas sao testadas direto pelo app.request do Hono, sem subir servidor.
// o relogio e fixo para as datas do ranking serem previsiveis

type Issue = { path: string; message: string }
type SolveRow = { range: number; dropMrad: number; windageMrad: number; drop: number; velocity: number }

let clock = 1000
let app = createApp(memoryStore(), () => clock)

beforeEach(() => {
  clock = 1000
  app = createApp(memoryStore(), () => clock)
})

const post = (path: string, body: unknown) =>
  app.request(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

const solveBody = { ammo: '338', range: 1000, tempC: 15, pressHPa: 1013, wind: 5, zero: 100 }
const score = { hits: 4, shots: 5, scenario: 'Deserto', scope: 'Tatica', ammo: '.338 Lapua Magnum' }

describe('GET /api/health', () => {
  it('responde ok', async () => {
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})

describe('POST /api/solve', () => {
  it('devolve a tabela a cada 100 m por padrao', async () => {
    const res = await post('/api/solve', solveBody)
    expect(res.status).toBe(200)
    const { table } = (await res.json()) as { table: SolveRow[] }
    expect(table.map((r) => r.range)).toEqual([100, 200, 300, 400, 500, 600, 700, 800, 900, 1000])
  })

  it('da o mesmo numero que a calculadora do site', async () => {
    const { table } = (await (await post('/api/solve', solveBody)).json()) as { table: SolveRow[] }
    const site = dope(solveBody)[1000]
    const api = table.find((r) => r.range === 1000)!
    expect(api.drop).toBeCloseTo(site.drop, 9)
    expect(api.dropMrad).toBeCloseTo((site.drop / 1000) * 1000, 9)
  })

  it('no zero a correcao de elevacao e praticamente nula', async () => {
    const { table } = (await (await post('/api/solve', { ...solveBody, wind: 0 })).json()) as { table: SolveRow[] }
    expect(Math.abs(table[0].dropMrad)).toBeLessThan(0.01)
  })

  it('respeita o passo e sempre inclui o alcance final', async () => {
    const { table } = (await (await post('/api/solve', { ...solveBody, range: 950, step: 300 })).json()) as { table: SolveRow[] }
    expect(table.map((r) => r.range)).toEqual([300, 600, 900, 950])
  })

  it('vento da direita pede correcao positiva (para a esquerda)', async () => {
    const { table } = (await (await post('/api/solve', solveBody)).json()) as { table: SolveRow[] }
    expect(table.at(-1)!.windageMrad).toBeGreaterThan(0)
  })

  it('a velocidade cai a cada linha', async () => {
    const { table } = (await (await post('/api/solve', solveBody)).json()) as { table: SolveRow[] }
    for (let i = 1; i < table.length; i++) expect(table[i].velocity).toBeLessThan(table[i - 1].velocity)
  })

  it('rejeita municao que nao existe', async () => {
    const res = await post('/api/solve', { ...solveBody, ammo: '999' })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string; issues: Issue[] }
    expect(body.error).toBe('invalid_input')
    expect(body.issues.map((i) => i.path)).toContain('ammo')
  })

  it('rejeita valores fora da faixa e lista todos os campos', async () => {
    const res = await post('/api/solve', { ...solveBody, range: 9000, tempC: 99, pressHPa: 10 })
    expect(res.status).toBe(400)
    const paths = ((await res.json()) as { issues: Issue[] }).issues.map((i) => i.path)
    expect(paths).toEqual(expect.arrayContaining(['range', 'tempC', 'pressHPa']))
  })

  it('rejeita zero maior que o alcance', async () => {
    const res = await post('/api/solve', { ...solveBody, range: 200, zero: 300 })
    expect(res.status).toBe(400)
  })

  it('rejeita campo faltando', async () => {
    const { wind: _, ...semVento } = solveBody
    expect((await post('/api/solve', semVento)).status).toBe(400)
  })

  it('rejeita corpo que nao e JSON', async () => {
    const res = await app.request('/api/solve', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{nao e json' })
    expect(res.status).toBe(400)
  })
})

describe('ranking', () => {
  it('comeca vazio', async () => {
    expect(await (await app.request('/api/ranking')).json()).toEqual({ ranking: [] })
  })

  it('grava com a data do servidor e responde 201', async () => {
    clock = 5000
    const res = await post('/api/ranking', score)
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ score: { ...score, date: 5000 } })
  })

  it('ignora data mandada pelo cliente', async () => {
    clock = 7000
    const res = await post('/api/ranking', { ...score, date: 1 })
    expect(((await res.json()) as { score: { date: number } }).score.date).toBe(7000)
  })

  it('ordena por acertos e, no empate, por quem fez antes', async () => {
    clock = 1; await post('/api/ranking', { ...score, hits: 3 })
    clock = 2; await post('/api/ranking', { ...score, hits: 5, scenario: 'Primeiro' })
    clock = 3; await post('/api/ranking', { ...score, hits: 5, scenario: 'Segundo' })
    const { ranking } = (await (await app.request('/api/ranking')).json()) as { ranking: { hits: number; scenario: string }[] }
    expect(ranking.map((r) => `${r.hits} ${r.scenario}`)).toEqual(['5 Primeiro', '5 Segundo', `3 ${score.scenario}`])
  })

  it('respeita o limite', async () => {
    for (let i = 0; i < 4; i++) await post('/api/ranking', score)
    const { ranking } = (await (await app.request('/api/ranking?limit=2')).json()) as { ranking: unknown[] }
    expect(ranking).toHaveLength(2)
  })

  it('rejeita limite invalido', async () => {
    expect((await app.request('/api/ranking?limit=0')).status).toBe(400)
    expect((await app.request('/api/ranking?limit=abc')).status).toBe(400)
  })

  it('rejeita mais acertos que tiros', async () => {
    const res = await post('/api/ranking', { ...score, hits: 6, shots: 5 })
    expect(res.status).toBe(400)
    expect(((await res.json()) as { issues: Issue[] }).issues[0].path).toBe('hits')
  })

  it('rejeita texto vazio e texto longo demais', async () => {
    expect((await post('/api/ranking', { ...score, scenario: '   ' })).status).toBe(400)
    expect((await post('/api/ranking', { ...score, ammo: 'x'.repeat(41) })).status).toBe(400)
  })
})

describe('erros gerais', () => {
  it('rota que nao existe responde 404 em JSON', async () => {
    const res = await app.request('/api/nada')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'not_found' })
  })

  it('falha no armazenamento vira 500 sem vazar detalhe', async () => {
    const broken = createApp({ top: async () => { throw new Error('banco fora') }, add: async () => {} })
    const origError = console.error
    console.error = () => {}
    const res = await broken.request('/api/ranking')
    console.error = origError
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'internal_error' })
  })
})

describe('DynamoDB', () => {
  // cliente falso: guarda os itens e responde a Query na ordem da chave de ordenacao, como o DynamoDB faz
  const fakeClient = () => {
    const items: Record<string, unknown>[] = []
    const send = async (cmd: { input: Record<string, unknown> }) => {
      const input = cmd.input
      if ('Item' in input) {
        items.push(input.Item as Record<string, unknown>)
        return {}
      }
      const sorted = [...items].sort((a, b) => String(a.sk).localeCompare(String(b.sk)))
      return { Items: sorted.slice(0, input.Limit as number) }
    }
    return { client: { send } as unknown as DynamoDBDocumentClient, items }
  }

  it('a chave de ordenacao ja devolve o ranking na ordem certa', async () => {
    const { client } = fakeClient()
    const store = dynamoStore('tabela', client)
    await store.add({ ...score, hits: 2, date: 10 })
    await store.add({ ...score, hits: 10, date: 30 })
    await store.add({ ...score, hits: 10, date: 20 })
    await store.add({ ...score, hits: 0, date: 5 })
    const top = await store.top(10)
    expect(top.map((s) => [s.hits, s.date])).toEqual([[10, 20], [10, 30], [2, 10], [0, 5]])
  })

  it('grava na particao do ranking e devolve so os campos do resultado', async () => {
    const { client, items } = fakeClient()
    const store = dynamoStore('tabela', client)
    await store.add({ ...score, date: 1 })
    expect(items[0].pk).toBe('ranking')
    expect(await store.top(1)).toEqual([{ ...score, date: 1 }])
  })
})
