import { useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { atmosphereUniforms } from './atmosphere'
import { windStrength } from './wind'

const COUNT = 4000
const BOX = 140

// poeira suspensa que envolve a camera: e o que vende a velocidade
const vertex = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  uniform vec3 uCam;
  uniform float uBox;
  uniform float uTime;
  uniform float uWindStrength;
  attribute float aSeed;
  varying float vAlpha;
  varying float vSun;
  uniform vec3 uSunDir;

  void main() {
    vec3 p = position;
    // levada pelo vento de 5 m/s (para -x), com turbulencia
    p.x -= uTime * 5.0 * uWindStrength * (0.7 + 0.6 * aSeed);
    p.x += sin(uTime * 0.9 + aSeed * 6.28) * 1.2;
    p.y += sin(uTime * 0.7 + aSeed * 12.0) * 0.8;
    p.z += sin(uTime * 0.5 + aSeed * 31.0) * 0.8;
    vec3 rel = mod(p - uCam + uBox * 0.5, uBox) - uBox * 0.5;
    vec3 w = uCam + rel;
    vec4 mv = viewMatrix * vec4(w, 1.0);
    gl_Position = projectionMatrix * mv;
    float dist = -mv.z;
    gl_PointSize = min((0.5 + aSeed * 1.5) * 38.0 / max(dist, 1.0), 6.0);
    float edge = 1.0 - smoothstep(uBox * 0.3, uBox * 0.5, length(rel));
    vAlpha = edge * smoothstep(0.15, 1.2, dist) * (0.25 + 0.75 * aSeed);
    vSun = pow(max(dot(normalize(rel), uSunDir), 0.0), 3.0);
    #include <logdepthbuf_vertex>
  }
`

const fragment = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  uniform vec3 uSunColor;
  varying float vAlpha;
  varying float vSun;
  void main() {
    #include <logdepthbuf_fragment>
    float r = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, r) * vAlpha;
    // a poeira brilha com a luz que recebe: quase some a noite
    vec3 col = uSunColor * (0.5 + 2.2 * vSun) * (0.15 + 0.85 * uSunColor.r);
    gl_FragColor = vec4(col, a * 0.55);
  }
`

export const Dust = () => {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(COUNT * 3)
    const seed = new Float32Array(COUNT)
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = Math.random() * BOX
      pos[i * 3 + 1] = Math.random() * BOX
      pos[i * 3 + 2] = Math.random() * BOX
      seed[i] = Math.random()
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    return g
  }, [])

  const material = useMemo(
    () => new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: {
        ...atmosphereUniforms(),
        uCam: { value: new THREE.Vector3() },
        uBox: { value: BOX },
        uTime: { value: 0 },
        uWindStrength: windStrength
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    }),
    []
  )

  useFrame(({ camera, clock }) => {
    material.uniforms.uCam.value.copy(camera.position)
    material.uniforms.uTime.value = clock.elapsedTime
  })

  return <points geometry={geometry} material={material} frustumCulled={false} />
}
