import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { byRank, type Score } from '../shared/ranking'

// onde o ranking fica guardado: em memoria rodando local e nos testes, DynamoDB na AWS

export type RankingStore = {
  top: (limit: number) => Promise<Score[]>
  add: (score: Score) => Promise<void>
}

export const memoryStore = (): RankingStore => {
  const scores: Score[] = []
  return {
    top: async (limit) => [...scores].sort(byRank).slice(0, limit),
    add: async (score) => { scores.push(score) }
  }
}

// uma particao so para o ranking; a chave de ordenacao ja vem na ordem do ranking
// (acertos invertidos com zeros a esquerda, depois a data), entao a leitura e uma Query sem ordenar nada
const PK = 'ranking'
const sortKey = (s: Score) =>
  `${String(999 - s.hits).padStart(3, '0')}#${String(s.date).padStart(14, '0')}#${Math.random().toString(36).slice(2, 8)}`

export const dynamoStore = (table: string, client = DynamoDBDocumentClient.from(new DynamoDBClient({}))): RankingStore => ({
  top: async (limit) => {
    const out = await client.send(new QueryCommand({
      TableName: table,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': PK },
      Limit: limit
    }))
    return (out.Items ?? []).map(({ hits, shots, scenario, scope, ammo, date }) => ({ hits, shots, scenario, scope, ammo, date }) as Score)
  },
  add: async (score) => {
    await client.send(new PutCommand({ TableName: table, Item: { pk: PK, sk: sortKey(score), ...score } }))
  }
})
