import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { atmosphereUniforms, fogGLSL, ZENITH, skyUniforms } from './atmosphere'
import { windTime } from './wind'

const vertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 p = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }
`

const fragment = /* glsl */ `
  ${fogGLSL}
  uniform vec3 uZenith;
  uniform float uWindTime;
  uniform float uSunDisk;
  uniform float uCloudCover;
  uniform float uStars;
  varying vec3 vDir;

  float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 6; i++) { s += vn(p) * a; p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
    return s;
  }

  void main() {
    vec3 d = normalize(vDir);
    vec3 horizon = fogTint(d);
    float up = smoothstep(-0.02, 0.55, d.y);
    vec3 col = mix(horizon, uZenith, pow(up, 0.55));

    float s = max(dot(d, uSunDir), 0.0);

    // estrelas: uma em cada celula sorteada da esfera, cintilando devagar
    if (uStars > 0.0 && d.y > 0.0) {
      vec3 q = d * 420.0;
      vec3 cell = floor(q);
      float rnd = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
      float core = smoothstep(0.32, 0.0, length(fract(q) - 0.5));
      float tw = 0.6 + 0.4 * sin(uWindTime * 2.5 + rnd * 60.0);
      col += vec3(0.85, 0.9, 1.0) * step(0.9955, rnd) * core * tw * uStars * smoothstep(0.02, 0.3, d.y) * 1.8;
    }

    // cirros altos esticados pelo vento, derivando devagar para a esquerda
    if (d.y > 0.0) {
      vec2 uv = d.xz / (d.y + 0.12);
      uv *= vec2(0.9, 2.6);
      uv.x += uWindTime * 0.012;
      float c = fbm(uv * 1.4);
      // cobertura: 0 = cirros esparsos perto do horizonte, 1 = ceu fechado
      float band = mix(smoothstep(0.0, 0.12, d.y) * (1.0 - smoothstep(0.5, 0.9, d.y)), 1.0, uCloudCover);
      c = smoothstep(mix(0.5, 0.15, uCloudCover), mix(0.85, 0.6, uCloudCover), c) * band;
      // borda iluminada pelo sol baixo, miolo mais escuro; no ceu fechado, cinza chumbo
      vec3 cloud = mix(horizon * 0.85, uSunColor * 1.4, (pow(s, 4.0) * 0.8 + 0.15) * (1.0 - uCloudCover));
      cloud = mix(cloud, mix(uFogColor * 0.95, uZenith * 0.8, fbm(uv * 3.0)), uCloudCover);
      col = mix(col, cloud, c * mix(0.75, 0.95, uCloudCover));
    }

    col += uSunColor * (pow(s, 12.0) * 0.45 + pow(s, 90.0) * 1.4) * uSunDisk;
    // disco do sol estourado: o bloom transforma isso em brilho
    col += uSunColor * 13.0 * smoothstep(0.99955, 0.99975, s) * uSunDisk;

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export const skyMaterial = () =>
  new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: { ...atmosphereUniforms(), ...skyUniforms, uZenith: { value: ZENITH }, uWindTime: windTime },
    side: THREE.BackSide,
    depthWrite: false
  })

export const Sky = () => {
  const ref = useRef<THREE.Mesh>(null)
  const material = useMemo(skyMaterial, [])

  // o ceu acompanha a camera: horizonte infinito. tambem e quem avanca o relogio do vento
  useFrame(({ camera, clock }) => {
    windTime.value = clock.elapsedTime
    ref.current?.position.copy(camera.position)
  })

  return (
    <mesh ref={ref} material={material} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[100, 48, 24]} />
    </mesh>
  )
}
