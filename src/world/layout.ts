import * as THREE from 'three'
import { heightAt } from './height'
import { RANGE, solve, sampleAt, type Sample } from '../../shared/ballistics'
import { timed } from '../perf'

// posicoes fixas da cena, em metros reais
// altura tirada do chao embaixo dos pes do bipe (+ o desnivel do retalho de alta resolucao)
export const SHOOTER = new THREE.Vector3(0, heightAt(0, -0.845) + 0.015, 0)
export const BORE_HEIGHT = 0.3
export const MUZZLE_Z = -1.1
export const MUZZLE = new THREE.Vector3(0, SHOOTER.y + BORE_HEIGHT, MUZZLE_Z)

const tz = MUZZLE_Z - RANGE
export const TARGET = new THREE.Vector3(0, heightAt(0, tz) + 0.9, tz)

export const SOLUTION = timed('balistica', () => solve(TARGET.y - MUZZLE.y))

export const bulletWorld = (q: Sample, out: THREE.Vector3) => out.set(MUZZLE.x + q.x, MUZZLE.y + q.y, MUZZLE.z - q.s)

export const sample = (s: number) => sampleAt(SOLUTION, s)

// linha do tempo controlada pelo scroll: abertura, entra na luneta, disparo, voo, impacto
export const P_SCOPE_IN = 0.026
export const P_SCOPE = 0.044
export const P_SHOT = 0.07
export const P_IMPACT = 0.93

// luneta 25x: o campo de visao vertical da camera vira 1,6 grau (~28 mrad)
export const SCOPE_FOV = 1.6
export const BASE_FOV = 40
// olho do atirador dentro do tubo da luneta, e o ponto para onde o reticulo aponta:
// a torre ja tem a elevacao girada, entao o centro cai na altura da placa;
// a correcao de vento e segurada no reticulo, entao o centro fica a direita do alvo
// (fica dentro do tubo, a frente do shemagh, que e renderizado dos dois lados)
export const SCOPE_EYE = new THREE.Vector3(0, SHOOTER.y + BORE_HEIGHT + 0.075, MUZZLE_Z + 0.78)
export const SCOPE_AIM = TARGET.clone().add(new THREE.Vector3((SOLUTION.azMrad / 1000) * RANGE, 0, 0))

export const distanceAt = (p: number) => Math.min(1, Math.max(0, (p - P_SHOT) / (P_IMPACT - P_SHOT))) * RANGE
