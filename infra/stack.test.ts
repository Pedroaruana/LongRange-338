import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, it, expect, beforeAll } from 'vitest'
import { App } from 'aws-cdk-lib'
import { Template, Match } from 'aws-cdk-lib/assertions'
import { LongRangeStack } from './stack'

// confere o template do CloudFormation gerado, sem credenciais e sem tocar na AWS.
// o site e um build falso numa pasta temporaria

let t: Template

beforeAll(() => {
  const siteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'longrange-site-'))
  fs.writeFileSync(path.join(siteDir, 'index.html'), '<!doctype html><title>teste</title>')
  const app = new App()
  t = Template.fromStack(new LongRangeStack(app, 'Teste', { siteDir, env: { account: '111111111111', region: 'us-east-1' } }))
}, 120_000)

describe('stack da AWS', () => {
  it('tabela do ranking sob demanda, com pk e sk', () => {
    t.hasResourceProperties('AWS::DynamoDB::Table', {
      BillingMode: 'PAY_PER_REQUEST',
      KeySchema: [{ AttributeName: 'pk', KeyType: 'HASH' }, { AttributeName: 'sk', KeyType: 'RANGE' }]
    })
  })

  it('Lambda da API em Node 24 ARM com o nome da tabela no ambiente', () => {
    t.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs24.x',
      Architectures: ['arm64'],
      Handler: 'index.handler',
      Environment: { Variables: { RANKING_TABLE: Match.anyValue() } }
    })
  })

  it('a Lambda pode ler e gravar na tabela do ranking', () => {
    // arrayWith exige a ordem, entao cada acao e conferida separada
    for (const action of ['dynamodb:PutItem', 'dynamodb:Query']) {
      t.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith([action]),
              Resource: Match.arrayWith([Match.objectLike({ 'Fn::GetAtt': Match.arrayWith([Match.stringLikeRegexp('Ranking')]) })])
            })
          ])
        }
      })
    }
  })

  it('bucket do site privado e so com HTTPS', () => {
    t.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true }
    })
    t.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: { Statement: Match.arrayWith([Match.objectLike({ Effect: 'Deny', Condition: { Bool: { 'aws:SecureTransport': 'false' } } })]) }
    })
  })

  it('CloudFront serve o site e manda /api/* para a Lambda sem cache', () => {
    t.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        DefaultRootObject: 'index.html',
        PriceClass: 'PriceClass_100',
        DefaultCacheBehavior: Match.objectLike({ ViewerProtocolPolicy: 'redirect-to-https' }),
        CacheBehaviors: [
          Match.objectLike({
            PathPattern: 'api/*',
            AllowedMethods: Match.arrayWith(['POST']),
            CachePolicyId: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad' // CachingDisabled
          })
        ]
      })
    })
  })

  it('o bucket so e lido pelo CloudFront (Origin Access Control)', () => {
    t.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1)
  })

  it('o deploy envia o build e invalida o cache', () => {
    t.hasResourceProperties('Custom::CDKBucketDeployment', { DistributionPaths: ['/*'] })
  })

  it('expoe o endereco do site', () => {
    t.hasOutput('SiteUrl', {})
  })
})
