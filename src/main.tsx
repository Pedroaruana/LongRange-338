import { createRoot } from 'react-dom/client'
import { perf } from './perf'
import App from './App'

perf('modulos carregados')
// fontes servidas pelo proprio site: Inter para ler, JetBrains Mono para numeros, stencil para a marca
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import './index.css'

// as fontes usam font-display: swap, entao o texto aparecia numa fonte reserva e trocava quando a
// verdadeira chegava. a tela so e desenhada depois que as tres carregam (com limite de 2 s para nunca travar)
const FONTS = ['900 1em "Big Shoulders Stencil Display"', '400 1em "Inter Variable"', '400 1em "JetBrains Mono Variable"']
const fontsReady = Promise.race([
  Promise.all(FONTS.map((f) => document.fonts.load(f))),
  new Promise((resolve) => setTimeout(resolve, 2000))
])

fontsReady
  .catch(() => {}) // sem a fonte o site continua funcionando com a reserva
  .finally(() => createRoot(document.getElementById('root')!).render(<App />))
