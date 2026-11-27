import { describe, it, expect } from 'vitest'
import { robotsTxt, sitemapXml } from './seo'

describe('robots.txt', () => {
  it('libera o site e bloqueia a API', () => {
    const r = robotsTxt()
    expect(r).toContain('User-agent: *')
    expect(r).toContain('Allow: /')
    expect(r).toContain('Disallow: /api/')
  })

  it('sem SITE_URL nao aponta sitemap', () => {
    expect(robotsTxt()).not.toContain('Sitemap')
    expect(robotsTxt('  ')).not.toContain('Sitemap')
  })

  it('com SITE_URL aponta o sitemap absoluto, sem barra dupla', () => {
    expect(robotsTxt('https://exemplo.cloudfront.net/')).toContain('Sitemap: https://exemplo.cloudfront.net/sitemap.xml')
  })
})

describe('sitemap.xml', () => {
  const xml = sitemapXml('https://exemplo.cloudfront.net/', new Date('2026-11-27T12:00:00Z'))

  it('lista a pagina inicial com a data do build', () => {
    expect(xml).toContain('<loc>https://exemplo.cloudfront.net/</loc>')
    expect(xml).toContain('<lastmod>2026-11-27</lastmod>')
  })

  it('usa o namespace padrao de sitemaps', () => {
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
  })

  it('recusa endereco sem http ou https', () => {
    expect(() => sitemapXml('exemplo.com', new Date())).toThrow()
  })
})
