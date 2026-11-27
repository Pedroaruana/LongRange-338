import type { Plugin } from 'vite'

// robots.txt e sitemap.xml gerados no build. o sitemap precisa do endereco completo do site,
// que so existe depois do deploy: vem da variavel SITE_URL. sem ela sai so o robots.txt, sem a linha do sitemap

const clean = (site?: string) => site?.trim().replace(/\/+$/, '') || undefined

export const robotsTxt = (site?: string) => {
  const url = clean(site)
  return [
    'User-agent: *',
    'Allow: /',
    // a API e para o site e para integracoes, nao para indexar
    'Disallow: /api/',
    ...(url ? ['', `Sitemap: ${url}/sitemap.xml`] : [])
  ].join('\n') + '\n'
}

// o site e uma pagina so: uma URL no sitemap
export const sitemapXml = (site: string, date: Date) => {
  const url = clean(site)
  if (!url || !/^https?:\/\//.test(url)) throw new Error(`SITE_URL invalida: ${site}`)
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <url>',
    `    <loc>${url}/</loc>`,
    `    <lastmod>${date.toISOString().slice(0, 10)}</lastmod>`,
    '  </url>',
    '</urlset>',
    ''
  ].join('\n')
}

export const seo = (site = process.env.SITE_URL): Plugin => ({
  name: 'longrange-seo',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt(site) })
    if (clean(site)) this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml(site!, new Date()) })
  }
})
