import { z } from 'zod'

// pontuacao da prova da escola de tiro: o mesmo formato no front, na API e no banco

export const scoreInput = z
  .object({
    hits: z.number().int().min(0).max(50),
    shots: z.number().int().min(1).max(50),
    scenario: z.string().trim().min(1).max(40),
    scope: z.string().trim().min(1).max(40),
    ammo: z.string().trim().min(1).max(40)
  })
  .refine((s) => s.hits <= s.shots, { message: 'hits nao pode passar de shots', path: ['hits'] })

export type ScoreInput = z.infer<typeof scoreInput>
export type Score = ScoreInput & { date: number }

// mais acertos primeiro; no empate, quem fez antes
export const byRank = (a: Score, b: Score) => b.hits - a.hits || a.date - b.date
