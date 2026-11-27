import { test, expect, type Page } from '@playwright/test'

// fluxos principais do site num navegador de verdade, com a API local rodando.
// o idioma comeca em portugues porque cada teste abre um navegador limpo.
// o Chromium sem tela nao tem GPU: o terreno e os modelos renderizados por software travam a pagina,
// entao os testes desligam as partes pesadas da cena com as flags ?no= do proprio app.
// o que se testa aqui e interface, navegacao e API; a camera e o scroll continuam ligados
const LIGHT = '/?no=terrain,veg,course,sniper,shooter,rifle,bullet,target,dust,fx,shadow'

const home = async (page: Page) => {
  await page.goto(LIGHT)
  await expect(page.getByRole('heading', { name: 'LONGRANGE' })).toBeVisible()
}

// a troca de tela tem uma cortina de 0,8 s; o clique so vale depois dela
const open = async (page: Page, option: string) => {
  await page.getByText(option, { exact: true }).click()
}

test('a tela inicial abre com o titulo e as tres opcoes', async ({ page }) => {
  await home(page)
  await expect(page).toHaveTitle(/LONGRANGE/)
  for (const option of ['O TIRO DE 2000 M', 'ESCOLA DE TIRO', 'CALCULADORA']) {
    await expect(page.getByText(option, { exact: true })).toBeVisible()
  }
  await expect(page.getByRole('button', { name: 'COMO FOI FEITO' })).toBeVisible()
})

test('o tiro de 2000 m avanca com o scroll e volta ao inicio', async ({ page }) => {
  await home(page)
  await open(page, 'O TIRO DE 2000 M')
  await expect(page.getByText('ROLE PARA DISPARAR')).toBeVisible()

  // rola ate o meio do voo: a bala ja passou de 500 m e a etapa mudou
  await page.evaluate(() => scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * 0.5))
  await expect(page.getByText('ROLE PARA DISPARAR')).toBeHidden()
  await expect
    .poll(async () => Number((await page.getByTestId('distance').innerText()).replace(/\./g, '')))
    .toBeGreaterThan(500)

  await page.getByRole('button', { name: 'INÍCIO' }).click()
  await expect(page.getByText('ESCOLA DE TIRO', { exact: true })).toBeVisible()
})

test('a calculadora mostra a tabela calculada pela API', async ({ page }) => {
  await home(page)
  await open(page, 'CALCULADORA')
  await expect(page.getByRole('heading', { name: 'CALCULADORA BALÍSTICA' })).toBeVisible()
  await expect(page.getByText('tabela calculada pela API', { exact: false })).toBeVisible()

  // alcance padrao de 1500 m: 15 linhas na tabela, de 100 em 100
  const rows = page.locator('tbody tr')
  await expect(rows).toHaveCount(15)
  await expect(rows.first().locator('td').first()).toHaveText('100')

  // mudar o zero recalcula a tabela pela API
  const before = await rows.nth(9).innerText()
  await page.getByRole('button', { name: '300 M' }).click()
  await expect.poll(() => rows.nth(9).innerText()).not.toBe(before)
})

test('a calculadora continua funcionando sem a API', async ({ page }) => {
  await page.route('**/api/**', (route) => route.abort())
  await home(page)
  await open(page, 'CALCULADORA')
  await expect(page.getByText('API fora do ar', { exact: false })).toBeVisible()
  await expect(page.locator('tbody tr')).toHaveCount(15)
})

test('a escola de tiro abre a preparacao com o ranking global', async ({ page, request }) => {
  const scenario = `E2E ${Date.now()}`
  const res = await request.post('http://localhost:8787/api/ranking', {
    data: { hits: 5, shots: 5, scenario, scope: 'Tatica', ammo: '.338' }
  })
  expect(res.status()).toBe(201)

  await home(page)
  await open(page, 'ESCOLA DE TIRO')
  await expect(page.getByRole('heading', { name: 'ESCOLA DE TIRO' })).toBeVisible()
  await expect(page.getByText('RANKING DA PROVA · GLOBAL')).toBeVisible()
  await expect(page.getByText(scenario)).toBeVisible()

  await page.getByRole('button', { name: 'COMEÇAR' }).click()
  await expect(page.getByText('LIÇÃO 01 DE 7')).toBeVisible()
  await expect(page.getByText('CLIQUE NA LUNETA PARA MIRAR')).toBeVisible()
})

test('a escola avisa que precisa de computador numa tela estreita', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 860 })
  await home(page)
  await open(page, 'ESCOLA DE TIRO')
  await expect(page.getByText('Abra no computador', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'COMEÇAR' })).toHaveCount(0)
})

test('o idioma troca para ingles e fica salvo', async ({ page }) => {
  await home(page)
  await page.getByRole('button', { name: 'PT / EN' }).click()
  await expect(page.getByText('THE 2000 M SHOT', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('SNIPER SCHOOL', { exact: true })).toBeVisible()
})

test('a pagina como foi feito abre', async ({ page }) => {
  await home(page)
  await page.getByRole('button', { name: 'COMO FOI FEITO' }).click()
  await expect(page.getByText('Motor balístico')).toBeVisible()
})
