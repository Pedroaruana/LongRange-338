import * as THREE from 'three'
import { ENV } from '../../shared/ballistics'

// um relogio de vento para a cena inteira: capim, arbustos, bandeiras, poeira e nuvens usam o mesmo
// o vento da simulacao vem da direita (3h) e sopra para -x
export const windTime = { value: 0 }
export const WIND_SPEED = Math.abs(ENV.windX)
// 0 = calmaria, 1 = os 5 m/s da simulacao. o treino muda isso entre as licoes
export const windStrength = { value: 1 }

// balanco de vegetacao: a geometria cresce de y=0 (raiz) a y=1 (ponta)
export const swaying = <T extends THREE.Material>(m: T, amount: number, stiffness = 2): T => {
  m.onBeforeCompile = (s) => {
    s.uniforms.uWindTime = windTime
    s.uniforms.uWindStrength = windStrength
    s.vertexShader = 'uniform float uWindTime;\nuniform float uWindStrength;\n' + s.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      {
        vec3 base = vec3(0.0);
        #ifdef USE_INSTANCING
          base = instanceMatrix[3].xyz;
        #endif
        float h = pow(max(position.y, 0.0), ${stiffness.toFixed(2)}) * (0.12 + 0.88 * uWindStrength);
        float gust = 0.55 + 0.45 * sin(uWindTime * 0.6 + base.x * 0.04 + base.z * 0.025);
        float flutter = sin(uWindTime * 5.5 + base.x * 3.1 + base.z * 2.3) * 0.3;
        transformed.x -= h * ${amount.toFixed(4)} * (gust + flutter);
        transformed.z += h * ${(amount * 0.35).toFixed(4)} * sin(uWindTime * 4.1 + base.z * 5.0 + base.x);
      }`
    )
  }
  m.customProgramCacheKey = () => `sway-${amount}-${stiffness}`
  return m
}

// tecido preso numa borda (x = 0) ondulando ao vento: bandeiras e a ponta do shemagh.
// a normal e derivada analiticamente da onda para a luz acompanhar as dobras
export const flapping = <T extends THREE.Material>(m: T, length: number, amp: number, freq = 9): T => {
  m.onBeforeCompile = (s) => {
    s.uniforms.uWindTime = windTime
    s.uniforms.uWindStrength = windStrength
    const wave = `
      float fx = clamp(position.x / ${length.toFixed(3)}, 0.0, 1.0);
      float ph = position.x * ${(freq / length).toFixed(3)} - uWindTime * ${freq.toFixed(2)} + position.y * 2.0;
      float A = ${amp.toFixed(4)} * pow(fx, 1.15) * (0.75 + 0.25 * sin(uWindTime * 0.9)) * (0.1 + 0.9 * uWindStrength);
    `
    s.vertexShader = 'uniform float uWindTime;\nuniform float uWindStrength;\n' + s.vertexShader
      .replace('#include <beginnormal_vertex>', `
        ${wave}
        float dz = A * ${(freq / length).toFixed(3)} * cos(ph) + ${amp.toFixed(4)} * 1.15 * pow(fx, 0.15) / ${length.toFixed(3)} * sin(ph);
        vec3 objectNormal = normalize(vec3(-dz, 0.0, 1.0));
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3(tangent.xyz);
        #endif
      `)
      .replace('#include <begin_vertex>', `
        vec3 transformed = vec3(position);
        transformed.z += A * sin(ph);
        // sem vento a bandeira cai junto ao mastro
        transformed.y -= fx * fx * ${(amp * 0.6).toFixed(4)} + fx * (1.0 - uWindStrength) * ${(length * 0.75).toFixed(3)};
        transformed.x *= 1.0 - (1.0 - uWindStrength) * 0.85;
      `)
  }
  m.customProgramCacheKey = () => `flap-${length}-${amp}-${freq}`
  return m
}
