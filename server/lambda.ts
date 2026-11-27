import { handle } from 'hono/aws-lambda'
import { createApp } from './app'
import { dynamoStore } from './store'

// entrada da AWS Lambda: a tabela do DynamoDB vem da infra por variavel de ambiente
const table = process.env.RANKING_TABLE
if (!table) throw new Error('RANKING_TABLE nao definida')

export const handler = handle(createApp(dynamoStore(table)))
