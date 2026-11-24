import * as THREE from 'three'

// paleta da cena inteira num lugar so. os objetos sao compartilhados por referencia com os
// uniforms dos shaders e com os materiais: trocar de cenario e so mudar os valores daqui
export const SUN_DIR = new THREE.Vector3(0.22, 0.075, -0.97).normalize()
export const SUN_COLOR = new THREE.Color(1.0, 0.68, 0.42)
export const FOG_COLOR = new THREE.Color(0.74, 0.5, 0.36)
export const ZENITH = new THREE.Color(0.05, 0.065, 0.11)

// cores do chao (areia, ocre, rocha, sombra), neve e densidade da nevoa do terreno
export const GROUND = {
  sand: new THREE.Color(0.66, 0.46, 0.31),
  ochre: new THREE.Color(0.55, 0.31, 0.18),
  rock: new THREE.Color(0.34, 0.2, 0.14),
  dark: new THREE.Color(0.13, 0.085, 0.07)
}
export const groundUniforms = {
  uSand: { value: GROUND.sand },
  uOchre: { value: GROUND.ochre },
  uRock: { value: GROUND.rock },
  uDark: { value: GROUND.dark },
  uSnow: { value: 0 },
  uFogK: { value: 0.00034 },
  uAmbient: { value: new THREE.Color(0.16, 0.2, 0.32) },
  uSunPower: { value: 3.4 }
}

// sol visivel e cobertura de nuvens do ceu
export const skyUniforms = {
  uSunDisk: { value: 1 },
  uCloudCover: { value: 0 },
  uStars: { value: 0 }
}

// tintas da vegetacao e das rochas (multiplicam as cores originais)
export const TINT = {
  grass: new THREE.Color(1, 1, 1),
  bush: new THREE.Color(0x5c4630),
  rock: new THREE.Color(0xa47c5a)
}

// glsl compartilhado entre terreno e ceu: a nevoa tem que bater exatamente com o horizonte
export const fogGLSL = /* glsl */ `
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uFogColor;

  vec3 fogTint(vec3 viewDir) {
    float s = max(dot(viewDir, uSunDir), 0.0);
    return mix(uFogColor, uSunColor * 1.35, pow(s, 5.0) * 0.85);
  }
`

export const atmosphereUniforms = () => ({
  uSunDir: { value: SUN_DIR },
  uSunColor: { value: SUN_COLOR },
  uFogColor: { value: FOG_COLOR }
})
