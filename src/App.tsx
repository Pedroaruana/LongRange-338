import { Suspense, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Shooter } from './world/Shooter'
import { Terrain } from './world/Terrain'
import { Sky } from './world/Sky'
import { Dust } from './world/Dust'
import { Rifle } from './world/Rifle'
import { Sniper } from './world/Sniper'
import { Projectile } from './world/Projectile'
import { Target } from './world/Target'
import { CameraRig } from './world/CameraRig'
import { Effects } from './world/Effects'
import { Lights } from './world/Lights'
import { Vegetation } from './world/Vegetation'
import { Course } from './world/Course'
import { Blast } from './world/Blast'
import { Hud } from './Hud'
import { telemetry } from './world/telemetry'

// ?perf&no=a,b desliga partes da cena para medir quanto cada uma custa na compilacao
const off = new URLSearchParams(location.search).get('no')?.split(',') ?? []
const has = (k: string) => !off.includes(k)

const App = () => {
  // so o tiro de 2000 m usa o scroll; tela inicial e escola de tiro ficam numa tela so
  const [mode, setMode] = useState<typeof telemetry.mode>('home')
  // o cenario vira estado do React so para a luz refazer o mapa de ambiente
  const [scenarioId, setScenarioId] = useState('desert')
  // a cena pesada (terreno, vegetacao, shaders) so e montada depois que a pagina pinta a tela inicial,
  // assim o logo e as opcoes aparecem na hora em vez de uma tela preta parada
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    let t = 0
    const r = requestAnimationFrame(() => { t = window.setTimeout(() => setMounted(true), 30) })
    return () => {
      cancelAnimationFrame(r)
      clearTimeout(t)
    }
  }, [])

  return (
  <>
    <div className={mode === 'shot' ? 'track' : 'h-screen'} />
    <div className="fixed inset-0">
      <Canvas
        flat
        shadows={has('shadow') ? 'soft' : false}
        dpr={[1, 1.5]}
        camera={{ fov: 40, near: 0.01, far: 12000 }}
        gl={{ antialias: false, powerPreference: 'high-performance', logarithmicDepthBuffer: true }}
      >
        {mounted && (
          <>
            <CameraRig />
            <Lights scenarioId={scenarioId} />
            <Sky />
            {has('terrain') && <Terrain />}
            {has('veg') && <Vegetation />}
            {has('course') && <Course />}
            {has('sniper') && <Sniper />}
            {has('shooter') && (
              <Suspense fallback={null}>
                <Shooter />
              </Suspense>
            )}
            {has('rifle') && <Rifle />}
            {has('bullet') && <Projectile />}
            {has('bullet') && <Blast />}
            {has('target') && <Target />}
            {has('dust') && <Dust />}
            {has('fx') && <Effects />}
          </>
        )}
      </Canvas>
    </div>
    <Hud mode={mode} onMode={setMode} onScenario={setScenarioId} />
  </>
  )
}

export default App
