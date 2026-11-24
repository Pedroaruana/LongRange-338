import { createRoot } from 'react-dom/client'
import App from './App'

// fontes servidas pelo proprio site: Inter para ler, JetBrains Mono para numeros, stencil para a marca
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import './index.css'

createRoot(document.getElementById('root')!).render(<App />)
