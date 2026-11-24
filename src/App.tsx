import { Suspense, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Terrain } from './world/Terrain'
import { Vegetation } from './world/Vegetation'
import { Sky } from './world/Sky'
import { Lights } from './world/Lights'
import { Dust } from './world/Dust'
import { Shooter } from './world/Shooter'
import { Rifle } from './world/Rifle'
import { SHOOTER } from './world/layout'
import { SCENARIOS, applyScenario } from './world/scenarios'

// atirador deitado com o fuzil no canyon; camera livre em volta dele e botoes de cenario
const App = () => {
  const [scenarioId, setScenarioId] = useState('desert')
  const pick = (id: string) => {
    applyScenario(id)
    setScenarioId(id)
  }

  return (
    <div className="fixed inset-0">
      <Canvas
        flat
        shadows="soft"
        dpr={[1, 1.5]}
        camera={{ fov: 40, near: 0.01, far: 12000, position: [2.6, SHOOTER.y + 1.1, 0.8] }}
        gl={{ antialias: false, powerPreference: 'high-performance', logarithmicDepthBuffer: true }}
      >
        <Lights scenarioId={scenarioId} />
        <Sky />
        <Terrain />
        <Vegetation />
        <Dust />
        <Suspense fallback={null}>
          <Shooter />
        </Suspense>
        <Rifle />
        <OrbitControls target={[0, SHOOTER.y + 0.2, -0.3]} />
      </Canvas>
      <div className="pointer-events-none absolute left-[4vw] top-[5vh] font-display text-2xl font-black tracking-[0.04em] text-[#ece0cf]">LONGRANGE</div>
      <div className="absolute bottom-[5vh] left-[4vw] flex gap-5 font-mono text-[0.64rem] tracking-[0.3em]">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            onClick={() => pick(s.id)}
            className={`cursor-pointer border-b pb-1 uppercase transition-colors ${s.id === scenarioId ? 'border-[#ffd2a6] text-[#ffd2a6]' : 'border-[#ece0cf]/30 text-[#ece0cf]/70 hover:text-[#ffd2a6]'}`}
          >
            {s.name}
          </button>
        ))}
      </div>
    </div>
  )
}

export default App
