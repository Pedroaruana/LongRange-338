import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Terrain } from './world/Terrain'
import { Vegetation } from './world/Vegetation'
import { SHOOTER, TARGET } from './world/layout'
import { SUN_DIR, SUN_COLOR, FOG_COLOR } from './world/atmosphere'

// por enquanto so o canyon: camera livre atras da posicao do atirador olhando para o alvo
const App = () => (
  <div className="fixed inset-0">
    <Canvas
      flat
      dpr={[1, 1.5]}
      camera={{ fov: 40, near: 0.01, far: 12000, position: [0, SHOOTER.y + 8, 20] }}
      gl={{ powerPreference: 'high-performance', logarithmicDepthBuffer: true }}
    >
      <color attach="background" args={[FOG_COLOR]} />
      <hemisphereLight args={[FOG_COLOR, '#5a4030', 0.8]} />
      <directionalLight color={SUN_COLOR} intensity={3} position={SUN_DIR.clone().multiplyScalar(100)} />
      <Terrain />
      <Vegetation />
      <OrbitControls target={[TARGET.x, TARGET.y, TARGET.z * 0.1]} />
    </Canvas>
    <div className="pointer-events-none absolute left-[4vw] top-[5vh] font-display text-2xl font-black tracking-[0.04em] text-[#ece0cf]">LONGRANGE</div>
  </div>
)

export default App
