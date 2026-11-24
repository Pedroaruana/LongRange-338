import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Terrain } from './world/Terrain'
import { Vegetation } from './world/Vegetation'
import { Sky } from './world/Sky'
import { Lights } from './world/Lights'
import { Dust } from './world/Dust'
import { SHOOTER, TARGET } from './world/layout'
import { SCENARIOS, applyScenario } from './world/scenarios'

// canyon com ceu, luz e neblina; os botoes trocam o cenario para conferir cada um
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
        camera={{ fov: 40, near: 0.01, far: 12000, position: [0, SHOOTER.y + 8, 20] }}
        gl={{ antialias: false, powerPreference: 'high-performance', logarithmicDepthBuffer: true }}
      >
        <Lights scenarioId={scenarioId} />
        <Sky />
        <Terrain />
        <Vegetation />
        <Dust />
        <OrbitControls target={[TARGET.x, TARGET.y, TARGET.z * 0.1]} />
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
