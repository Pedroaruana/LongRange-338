import { Vector2 } from 'three'
import { EffectComposer, Bloom, ChromaticAberration, Noise, Vignette, ToneMapping } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import { ScopeFx } from './ScopeFx'

const ca = new Vector2(0.0009, 0.0006)

// multisampling 4 tira o serrilhado das bordas finas (cano, bipe, luneta).
// N8AO foi testado e deixa a tela preta com o buffer de profundidade logaritmico
export const Effects = () => (
  <EffectComposer multisampling={4}>
    <Bloom mipmapBlur luminanceThreshold={0.9} luminanceSmoothing={0.2} intensity={0.85} radius={0.82} />
    <ScopeFx />
    <ChromaticAberration offset={ca} radialModulation modulationOffset={0.35} />
    <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    <Vignette offset={0.3} darkness={0.72} />
    <Noise opacity={0.06} blendFunction={BlendFunction.OVERLAY} />
  </EffectComposer>
)
