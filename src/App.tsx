import { useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { Terrain } from './world/Terrain'
import { Vegetation } from './world/Vegetation'
import { Sky } from './world/Sky'
import { Lights } from './world/Lights'
import { Dust } from './world/Dust'
import { Effects } from './world/Effects'
import { SCOPE_EYE, SCOPE_AIM } from './world/layout'
import { telemetry } from './world/telemetry'
import { SCOPES, fovFor } from './train/scopes'
import { ScopeView } from './train/Reticles'

// visao pela luneta apontada para a distancia do alvo: troca de luneta e de aumento para conferir os reticulos
telemetry.mode = 'shot'
telemetry.scope = 1

const Eye = ({ mag }: { mag: number }) => {
  useFrame(({ camera }) => {
    const cam = camera as THREE.PerspectiveCamera
    cam.position.copy(SCOPE_EYE)
    cam.lookAt(SCOPE_AIM)
    if (cam.fov !== fovFor(mag)) {
      cam.fov = fovFor(mag)
      cam.updateProjectionMatrix()
    }
  })
  return null
}

const App = () => {
  const [scope, setScope] = useState(SCOPES[0])
  const [mag, setMag] = useState(SCOPES[0].magMax)

  return (
    <div className="fixed inset-0">
      <Canvas
        flat
        shadows="soft"
        dpr={[1, 1.5]}
        camera={{ fov: 40, near: 0.01, far: 12000 }}
        gl={{ antialias: false, powerPreference: 'high-performance', logarithmicDepthBuffer: true }}
      >
        <Eye mag={mag} />
        <Lights scenarioId="desert" />
        <Sky />
        <Terrain />
        <Vegetation />
        <Dust />
        <Effects />
      </Canvas>
      <ScopeView scope={scope} mag={mag} />
      <div className="absolute left-[4vw] top-[5vh] font-mono text-[0.64rem] tracking-[0.3em] text-[#ece0cf]">
        <div className="font-display text-2xl font-black tracking-[0.04em]">LONGRANGE</div>
        <div className="mt-6 flex flex-col items-start gap-3">
          {SCOPES.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setScope(s)
                setMag(s.magMax)
              }}
              className={`cursor-pointer border-b pb-1 text-left uppercase transition-colors ${s.id === scope.id ? 'border-[#ffd2a6] text-[#ffd2a6]' : 'border-[#ece0cf]/30 text-[#ece0cf]/70 hover:text-[#ffd2a6]'}`}
            >
              {s.name} <span className="normal-case tracking-normal text-[#ece0cf]/50">{s.model}</span>
            </button>
          ))}
        </div>
        <label className="mt-6 block">
          {mag.toFixed(0)}×
          <input
            type="range"
            min={scope.magMin}
            max={scope.magMax}
            step={1}
            value={mag}
            onChange={(e) => setMag(Number(e.target.value))}
            className="mt-2 block w-48 accent-[#e8a76b]"
          />
        </label>
      </div>
    </div>
  )
}

export default App
