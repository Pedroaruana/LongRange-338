import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { skyMaterial } from './Sky'
import { SUN_DIR, SUN_COLOR, FOG_COLOR, GROUND } from './atmosphere'
import { scenario } from './scenarios'
import { SHOOTER } from './layout'
import { telemetry } from './telemetry'
import { perf } from '../perf'

// a neblina do terreno e exponencial simples (1 - e^-kd). o FogExp2 do three e quadratico,
// entao o trecho e trocado para os materiais padrao (rochas, placas, alvo) baterem com o terreno
THREE.ShaderChunk.fog_fragment = /* glsl */ `
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp(-fogDensity * vFogDepth);
  #else
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
  #endif
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
#endif
`

// luz para os materiais PBR (fuzil, bala, atirador).
// o reflexo vem do proprio ceu da cena, convertido em mapa de ambiente: metal reflete o mesmo por do sol
export const Lights = ({ scenarioId }: { scenarioId: string }) => {
  const { gl, scene, camera } = useThree()

  useEffect(() => {
    scene.fog = new THREE.FogExp2(FOG_COLOR, scenario.current.fogK * 1.18)
    return () => {
      scene.fog = null
    }
  }, [scene, scenarioId])

  // compila todos os shaders em paralelo antes de liberar a tela de carregamento
  useEffect(() => {
    const id = setTimeout(() => {
      perf('compilacao: inicio')
      gl.compileAsync(scene, camera).finally(() => {
        perf('compilacao: fim')
        telemetry.ready = true
      })
    }, 50)
    return () => clearTimeout(id)
  }, [gl, scene, camera])

  useEffect(() => {
    const envScene = new THREE.Scene()
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 64, 32), skyMaterial()))
    // chao quente refletido na metade de baixo
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(90, 32),
      new THREE.MeshBasicMaterial({ color: GROUND.sand.clone().multiplyScalar(0.48) })
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -2
    envScene.add(floor)

    const pmrem = new THREE.PMREMGenerator(gl)
    const rt = pmrem.fromScene(envScene, 0, 0.1, 500)
    scene.environment = rt.texture
    scene.environmentIntensity = scenario.current.env ?? 0.9
    return () => {
      scene.environment = null
      rt.dispose()
      pmrem.dispose()
    }
  }, [gl, scene, scenarioId])

  // sol com sombra real so na area do atirador: o fuzil e o corpo sombreiam a si mesmos
  const sun = useMemo(() => {
    const l = new THREE.DirectionalLight(SUN_COLOR, 3.2)
    l.position.copy(SUN_DIR).multiplyScalar(20).add(SHOOTER)
    l.target.position.copy(SHOOTER).add(new THREE.Vector3(0, 0, 0.3))
    l.castShadow = true
    l.shadow.mapSize.set(2048, 2048)
    const c = l.shadow.camera
    c.left = c.bottom = -1.8
    c.right = c.top = 1.8
    c.near = 5
    c.far = 40
    l.shadow.bias = -0.0004
    l.shadow.normalBias = 0.015
    return l
  }, [])
  const hemi = useMemo(() => new THREE.HemisphereLight(), [])

  // luz do cenario atual
  useEffect(() => {
    const s = scenario.current
    sun.color.copy(SUN_COLOR)
    sun.intensity = s.sunLight
    sun.position.copy(SUN_DIR).multiplyScalar(20).add(SHOOTER)
    hemi.color.setRGB(...s.hemi[0])
    hemi.groundColor.setRGB(...s.hemi[1])
    hemi.intensity = s.hemi[2]
  }, [sun, hemi, scenarioId])

  return (
    <>
      <primitive object={sun} />
      <primitive object={sun.target} />
      <primitive object={hemi} />
    </>
  )
}
