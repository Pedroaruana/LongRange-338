import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as logs from 'aws-cdk-lib/aws-logs'
import type { Construct } from 'constructs'

// infra do LONGRANGE, toda dentro do que a AWS da de graca para um portfolio:
// site estatico no S3 atras do CloudFront, API Hono numa Lambda e ranking no DynamoDB sob demanda.
// o CloudFront serve os dois no mesmo endereco: /api/* vai para a Lambda, o resto para o S3

export type LongRangeProps = StackProps & {
  siteDir: string // pasta do build do Vite (dist)
}

const root = fileURLToPath(new URL('..', import.meta.url))

export class LongRangeStack extends Stack {
  constructor(scope: Construct, id: string, props: LongRangeProps) {
    super(scope, id, props)

    // ranking: uma particao (pk) com a chave de ordenacao (sk) ja na ordem do ranking
    const table = new dynamodb.Table(this, 'Ranking', {
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: false },
      removalPolicy: RemovalPolicy.DESTROY
    })

    // API: o mesmo app Hono do desenvolvimento, empacotado com esbuild
    const api = new NodejsFunction(this, 'Api', {
      entry: path.join(root, 'server/lambda.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 512,
      timeout: Duration.seconds(10),
      environment: { RANKING_TABLE: table.tableName },
      bundling: { format: OutputFormat.ESM, minify: true, sourceMap: true, target: 'node24' },
      logGroup: new logs.LogGroup(this, 'ApiLogs', { retention: logs.RetentionDays.TWO_WEEKS, removalPolicy: RemovalPolicy.DESTROY })
    })
    table.grantReadWriteData(api)
    // URL publica da funcao: o CloudFront e quem fica na frente; o navegador nunca chama ela direto
    const apiUrl = api.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.NONE })

    // site: bucket privado, lido so pelo CloudFront (Origin Access Control)
    const bucket = new s3.Bucket(this, 'Site', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    })

    const distribution = new cloudfront.Distribution(this, 'Cdn', {
      comment: 'LONGRANGE',
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true
      },
      additionalBehaviors: {
        'api/*': {
          origin: new origins.FunctionUrlOrigin(apiUrl),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER
        }
      }
    })

    // envia o build e limpa o cache do CloudFront a cada deploy
    new s3deploy.BucketDeployment(this, 'Deploy', {
      sources: [s3deploy.Source.asset(props.siteDir)],
      destinationBucket: bucket,
      distribution,
      distributionPaths: ['/*'],
      memoryLimit: 512
    })

    new CfnOutput(this, 'SiteUrl', { value: `https://${distribution.distributionDomainName}` })
    new CfnOutput(this, 'BucketName', { value: bucket.bucketName })
    new CfnOutput(this, 'DistributionId', { value: distribution.distributionId })
  }
}
