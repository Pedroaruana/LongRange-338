import { useMemo } from 'react'
import { Uniform } from 'three'
import { useFrame } from '@react-three/fiber'
import { Effect } from 'postprocessing'
import { telemetry } from './telemetry'
import { windStrength } from './wind'
import { scenario } from './scenarios'

// miragem na luneta: o ar quente perto do chao ondula a imagem; as ondas correm na direcao do vento
// (e assim que atiradores leem o vento a distancia). sem vento, ela "ferve" para cima.

const fragment = /* glsl */ `
  uniform float uTime;
  uniform float uMirage;
  uniform float uWind;

  void mainUv(inout vec2 uv) {
    if (uMirage <= 0.0) return;
    float drift = uTime * (0.4 + 3.5 * uWind);
    float rise = uTime * 3.0 * (1.0 - min(uWind, 1.0));
    float a = sin(uv.y * 210.0 + rise + sin(uv.x * 37.0 + drift) * 2.0);
    float b = sin(uv.x * 95.0 + drift * 2.0 + uv.y * 60.0);
    uv.x += a * b * 0.0011 * uMirage;
    uv.y += a * 0.0005 * uMirage;
  }
`

class MirageEffect extends Effect {
  constructor() {
    super('MirageEffect', fragment, {
      uniforms: new Map<string, Uniform>([
        ['uTime', new Uniform(0)],
        ['uMirage', new Uniform(0)],
        ['uWind', new Uniform(0)]
      ])
    })
  }
}

// forca da miragem pelo calor do cenario: deserto forte, montanha gelada nenhuma
const heat = () => Math.min(1, Math.max(0, (scenario.current.air.tempC - 5) / 26))

export const ScopeFx = () => {
  const effect = useMemo(() => new MirageEffect(), [])

  useFrame(({ clock }) => {
    const u = effect.uniforms
    const inScope = telemetry.mode === 'shot' ? telemetry.scope : 0
    u.get('uTime')!.value = clock.elapsedTime
    u.get('uMirage')!.value = inScope * heat()
    u.get('uWind')!.value = windStrength.value
  })

  return <primitive object={effect} />
}
