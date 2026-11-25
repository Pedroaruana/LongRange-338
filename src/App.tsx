import { useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { Terrain } from './world/Terrain'
import { Vegetation } from './world/Vegetation'
import { Sky } from './world/Sky'
import { Lights } from './world/Lights'
import { Dust } from './world/Dust'
import { Effects } from './world/Effects'
import { Target } from './world/Target'
import { TARGET, P_IMPACT } from './world/layout'
import { telemetry } from './world/telemetry'

// camera de perto no alvo de aco a 2000 m; o botao reproduz o impacto para conferir os efeitos
telemetry.mode = 'shot'
const EYE = TARGET.clone().add(new THREE.Vector3(2.2, 0.4, 7))
const hit = { start: -1 }

const Eye = () => {
  useFrame(({ camera, clock }) => {
    const cam = camera as THREE.PerspectiveCamera
    cam.position.copy(EYE)
    cam.lookAt(TARGET)
    // o alvo le o tempo desde o impacto em unidades de progresso do scroll
    if (hit.start < 0 && telemetry.p > 0) hit.start = clock.elapsedTime
    telemetry.p = hit.start < 0 ? 0 : P_IMPACT + (clock.elapsedTime - hit.start) * 0.05
  })
  return null
}

const App = () => {
  const [shots, setShots] = useState(0)

  return (
    <div className="fixed inset-0">
      <Canvas
        flat
        shadows="soft"
        dpr={[1, 1.5]}
        camera={{ fov: 40, near: 0.01, far: 12000 }}
        gl={{ antialias: false, powerPreference: 'high-performance', logarithmicDepthBuffer: true }}
      >
        <Eye />
        <Lights scenarioId="desert" />
        <Sky />
        <Terrain />
        <Vegetation />
        <Target key={shots} />
        <Dust />
        <Effects />
      </Canvas>
      <div className="absolute left-[4vw] top-[5vh] font-mono text-[0.64rem] tracking-[0.3em] text-[#ece0cf]">
        <div className="font-display text-2xl font-black tracking-[0.04em]">LONGRANGE</div>
        <button
          onClick={() => {
            hit.start = -1
            telemetry.p = P_IMPACT
            setShots((s) => s + 1)
          }}
          className="mt-6 cursor-pointer border-b border-[#ece0cf]/30 pb-1 uppercase text-[#ece0cf]/75 transition-colors hover:text-[#ffd2a6]"
        >
          Impacto
        </button>
      </div>
    </div>
  )
}

export default App
