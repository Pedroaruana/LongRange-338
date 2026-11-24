import { useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { heightAt } from './height'
import { SHOOTER } from './layout'
import { timed } from '../perf'
import { atmosphereUniforms, fogGLSL, groundUniforms } from './atmosphere'

// grade nao uniforme em x: densa no meio (canion, tiro e voo da tela inicial) e esparsa nas bordas,
// que so aparecem longe e dentro da nevoa. 2,5x menos vertices que a grade uniforme de antes
const W = 7000
const D = 11000
const SEG_X = 360
const SEG_Z = 700
const X_POWER = 1.6

const vertex = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vWorld;
  varying vec3 vNormal;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vNormal = normal;
    gl_Position = projectionMatrix * viewMatrix * w;
    #include <logdepthbuf_vertex>
  }
`

const fragment = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  ${fogGLSL}
  uniform vec3 uCam;
  uniform vec3 uSand;
  uniform vec3 uOchre;
  uniform vec3 uRock;
  uniform vec3 uDark;
  uniform float uSnow;
  uniform float uFogK;
  uniform vec3 uAmbient;
  uniform float uSunPower;
  varying vec3 vWorld;
  varying vec3 vNormal;

  float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { s += vn(p) * a; p *= 2.07; a *= 0.5; }
    return s;
  }

  void main() {
    #include <logdepthbuf_fragment>
    vec3 N = normalize(vNormal);
    float h = vWorld.y;
    float slope = 1.0 - N.y;
    float n = fbm(vWorld.xz * 0.045);
    float fine = vn(vWorld.xz * 0.9);

    vec3 sand  = uSand;
    vec3 ochre = uOchre;
    vec3 rock  = uRock;
    vec3 dark  = uDark;

    vec3 col = mix(sand, ochre, smoothstep(0.08, 0.3, slope + n * 0.18));
    col = mix(col, rock, smoothstep(0.3, 0.55, slope + n * 0.1));
    col = mix(col, dark, smoothstep(0.6, 0.9, slope));

    // estratos de sedimento nas paredes
    float band = sin(h * 0.42 + n * 4.0) * 0.5 + 0.5;
    float band2 = sin(h * 1.7 + n * 9.0) * 0.5 + 0.5;
    float wallMask = smoothstep(0.25, 0.6, slope);
    col *= mix(1.0, 0.72 + 0.4 * band * (0.8 + 0.3 * band2), wallMask);
    col *= 0.7 + 0.5 * n + 0.12 * fine;

    // areia em quatro escalas, cada uma so onde a camera consegue resolver sem serrilhar.
    // as ondulacoes tem cristas perpendiculares ao vento (que sopra em x) e perfil assimetrico:
    // rampa longa e suave a barlavento, face curta e ingreme a sotavento, como na areia de verdade
    float dCam = length(vWorld - uCam);
    float flat_ = 1.0 - smoothstep(0.05, 0.2, slope);
    vec3 tilt = vec3(0.0);

    // dunas pequenas, ~10 m, vistas de longe
    float rp0 = vWorld.x * 0.55 + vWorld.z * 0.32 + n * 14.0;
    float a0 = smoothstep(30.0, 90.0, dCam) * (1.0 - smoothstep(300.0, 600.0, dCam));
    tilt += vec3(cos(rp0) * 0.13, 0.0, cos(rp0) * 0.08) * a0;

    // megaondulacoes, ~2,6 m. seno com segundo harmonico: perfil assimetrico sem degrau
    float warp = fbm(vWorld.xz * 0.08) * 12.0;
    float ph1 = vWorld.x * 2.4 + vWorld.z * 0.45 + warp;
    float s1 = fract(ph1 / 6.2832);
    float a1 = (1.0 - smoothstep(6.0, 140.0, dCam)) * (0.6 + 0.4 * fbm(vWorld.xz * 0.15));
    tilt.x += (cos(ph1) + 0.45 * cos(2.0 * ph1)) * 0.075 * a1;

    // marcas do vento, ~13 cm, so perto
    float ph2 = vWorld.x * 47.0 + vWorld.z * 8.0 + vn(vWorld.xz * 1.4) * 12.0;
    float a2 = 1.0 - smoothstep(0.6, 8.0, dCam);
    tilt.x += (cos(ph2) + 0.4 * cos(2.0 * ph2)) * 0.09 * a2;

    // grao da areia: some assim que o grao fica menor que um pixel (fwidth), senao vira chiado
    float px = fwidth(vWorld.x * 110.0) + fwidth(vWorld.z * 110.0);
    float a3 = (1.0 - smoothstep(0.25, 0.9, px)) * (1.0 - smoothstep(0.3, 3.0, dCam));
    vec2 gn = vec2(vn(vWorld.xz * 110.0), vn(vWorld.xz * 110.0 + 17.0)) - 0.5;
    tilt.xz += gn * 0.18 * a3;

    N = normalize(N + tilt * flat_);

    // cor: cristas um pouco mais claras, manchas de areia grossa, grao e cascalho perto da camera
    col *= 0.9 + 0.2 * fbm(vWorld.xz * 0.3 + 3.1);
    col *= 1.0 + smoothstep(0.55, 0.7, s1) * (1.0 - smoothstep(0.7, 0.8, s1)) * 0.04 * a1 * flat_;
    col *= 1.0 + (vn(vWorld.xz * 110.0) - 0.5) * 0.14 * a3;

    // neve: assenta onde o terreno e plano, falha nas encostas e nas cristas varridas pelo vento
    float snow = uSnow * (1.0 - smoothstep(0.18, 0.45, slope + (n - 0.5) * 0.3));
    col = mix(col, vec3(0.9, 0.92, 0.96) * (0.92 + 0.08 * fine), snow);

    // luz: sol + ceu + rebatida do chao, com a forca de cada cenario
    float diff = max(dot(N, uSunDir), 0.0);
    float wrap = max(dot(N, uSunDir) * 0.5 + 0.5, 0.0);
    vec3 skyAmb = uAmbient * (0.5 + 0.5 * N.y);
    // a luz rebatida pelo chao e proporcional a luz que chega nele
    vec3 bounce = col * 0.45 * (1.0 - N.y) * 0.45 * (uSunPower / 3.4);
    vec3 lit = col * (uSunColor * (diff * uSunPower + wrap * 0.1) + skyAmb * 0.6 + bounce);

    // nevoa por distancia e por altura, tingida pelo sol
    vec3 toFrag = vWorld - uCam;
    float d = length(toFrag);
    vec3 vd = toFrag / d;
    float fogD = 1.0 - exp(-d * uFogK);
    float fogH = exp(-max(h, 0.0) * 0.006);
    float fog = clamp(fogD * (0.45 + 0.7 * fogH), 0.0, 1.0);

    gl_FragColor = vec4(mix(lit, fogTint(vd), fog), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

// xPower > 1 concentra as colunas perto de x = 0
const grid = (w: number, d: number, sx: number, sz: number, cx = 0, cz = 0, lift = 0, xPower = 1) => {
  const g = new THREE.PlaneGeometry(w, d, sx, sz)
  g.rotateX(-Math.PI / 2)
  g.translate(cx, 0, cz)
  const p = g.attributes.position as THREE.BufferAttribute
  const half = w / 2
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i)
    if (xPower !== 1) {
      const u = (x - cx) / half
      x = cx + Math.sign(u) * Math.pow(Math.abs(u), xPower) * half
      p.setX(i, x)
    }
    p.setY(i, heightAt(x, p.getZ(i)) + lift)
  }
  g.computeVertexNormals()
  return g
}

export const Terrain = () => {
  const geometry = useMemo(() => timed('terreno', () => grid(W, D, SEG_X, SEG_Z, 0, 0, 0, X_POWER)), [])
  // retalho de alta resolucao onde o fuzil apoia: o chao bate exatamente com bipe, saco e estojos
  const patch = useMemo(() => grid(16, 16, 160, 160, SHOOTER.x, SHOOTER.z, 0.015), [])

  const material = useMemo(
    () => new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: { ...atmosphereUniforms(), ...groundUniforms, uCam: { value: new THREE.Vector3() } }
    }),
    []
  )

  useFrame(({ camera }) => {
    material.uniforms.uCam.value.copy(camera.position)
  })

  return (
    <>
      <mesh geometry={geometry} material={material} />
      <mesh geometry={patch} material={material} />
    </>
  )
}
