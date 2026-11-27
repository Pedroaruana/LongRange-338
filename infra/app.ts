import * as path from 'node:path'
import * as fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { App, Tags } from 'aws-cdk-lib'
import { LongRangeStack } from './stack'

// entrada do CDK (cdk.json). o site precisa estar construido antes: npm run build
const siteDir = fileURLToPath(new URL('../dist', import.meta.url))
if (!fs.existsSync(path.join(siteDir, 'index.html'))) throw new Error('dist/index.html nao existe: rode npm run build antes do cdk')

const app = new App()
const stack = new LongRangeStack(app, 'LongRange', {
  siteDir,
  // us-east-1: regiao padrao do CloudFront; a conta vem das credenciais de quem roda o deploy
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' }
})
Tags.of(stack).add('project', 'longrange')
