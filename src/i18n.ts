// idioma do site. tr(pt, en) devolve o texto no idioma atual; o HUD re-renderiza a cada 70 ms,
// entao trocar o idioma atualiza tudo sem recarregar
export const lang = { current: (localStorage.getItem('longrange.lang') === 'en' ? 'en' : 'pt') as 'pt' | 'en' }

export const tr = (pt: string, en: string) => (lang.current === 'en' ? en : pt)

export const setLang = (l: 'pt' | 'en') => {
  lang.current = l
  try {
    localStorage.setItem('longrange.lang', l)
  } catch {
    // sem armazenamento: o idioma so nao fica salvo
  }
}

// numero no formato do idioma (virgula em pt, ponto em en)
export const num = (v: number, d = 0) =>
  v.toLocaleString(lang.current === 'en' ? 'en-US' : 'pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
