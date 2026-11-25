import { Suspense, useState } from 'react'
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

// por enquanto o site e so o tiro de 2000 m: o scroll da pagina e o trilho da cena
telemetry.mode = 'shot'

const App = () => {
  // o cenario vira estado do React so para a luz refazer o mapa de ambiente
  const [scenarioId, setScenarioId] = useState('desert')

  return (
  <>
    <div className="track" />
    <div className="fixed inset-0">
      <Canvas
        flat
        shadows="soft"
        dpr={[1, 1.5]}
        camera={{ fov: 40, near: 0.01, far: 12000 }}
        gl={{ antialias: false, powerPreference: 'high-performance', logarithmicDepthBuffer: true }}
      >
        <CameraRig />
        <Lights scenarioId={scenarioId} />
        <Sky />
        <Terrain />
        <Vegetation />
        <Course />
        <Sniper />
        <Suspense fallback={null}>
          <Shooter />
        </Suspense>
        <Rifle />
        <Projectile />
        <Blast />
        <Target />
        <Dust />
        <Effects />
      </Canvas>
    </div>
    <Hud onScenario={setScenarioId} />
  </>
  )
}

export default App
