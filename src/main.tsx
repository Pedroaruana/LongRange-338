import { createRoot } from 'react-dom/client'
import { perf } from './perf'
import App from './App'

perf('modulos carregados')
// fontes servidas pelo proprio site: Inter para ler, JetBrains Mono para numeros, stencil para a marca
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import './index.css'

createRoot(document.getElementById('root')!).render(<App />)
