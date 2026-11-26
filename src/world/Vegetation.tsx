import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { heightAt } from './height'
import { SHOOTER, MUZZLE } from './layout'
import { swaying, windTime } from './wind'
import { TINT } from './atmosphere'
import { timed } from '../perf'
import { RANGE } from '../../shared/ballistics'

// tudo que ocupa o caminho ate o alvo: rochas, arbustos secos, capim e tumbleweeds rolando com o vento.
// nada fica a menos de alguns metros da linha do tiro, para nunca cruzar a trajetoria

const rand = (() => {
  let s = 1337
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
})()

const Y = new THREE.Vector3(0, 1, 0)
const o = new THREE.Object3D()

// fora da area do atirador (fuzil, corpo e pernas)
const clearOfShooter = (x: number, z: number) => !(Math.abs(x) < 1.4 && z > -1.8 && z < 2.6)

// ---------- rochas: icosaedro deslocado por ruido 3D, mais escuro nas fendas ----------
const h3 = (x: number, y: number, z: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
  return s - Math.floor(s)
}
const n3 = (x: number, y: number, z: number) => {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z)
  const fx = x - ix, fy = y - iy, fz = z - iz
  const u = (t: number) => t * t * (3 - 2 * t)
  const ux = u(fx), uy = u(fy), uz = u(fz)
  const l = (a: number, b: number, t: number) => a + (b - a) * t
  const c = (dx: number, dy: number, dz: number) => h3(ix + dx, iy + dy, iz + dz)
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), ux), l(c(0, 1, 0), c(1, 1, 0), ux), uy),
    l(l(c(0, 0, 1), c(1, 0, 1), ux), l(c(0, 1, 1), c(1, 1, 1), ux), uy),
    uz
  )
}

const rockGeo = (seed: number) => {
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, 4)
  g.deleteAttribute('normal')
  g.deleteAttribute('uv')
  g = mergeVertices(g)
  const p = g.attributes.position as THREE.BufferAttribute
  const col = new Float32Array(p.count * 3)
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    let n = 0, a = 1, f = 1.3
    for (let k = 0; k < 5; k++) {
      n += (n3(v.x * f + seed, v.y * f, v.z * f) - 0.5) * a
      a *= 0.5
      f *= 2.1
    }
    // facetas de rocha quebrada: quantiza um pouco o raio
    const r = 1 + n * 0.75
    v.multiplyScalar(r)
    v.y *= 0.62
    p.setXYZ(i, v.x, v.y, v.z)
    const shade = THREE.MathUtils.clamp(0.62 + n * 0.9, 0.35, 1.1)
    col[i * 3] = shade
    col[i * 3 + 1] = shade * 0.93
    col[i * 3 + 2] = shade * 0.86
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

// ---------- arbusto seco: galhos recursivos ----------
const twigs = (count: number, spread: number, len: number, r: number, depth: number) => {
  const parts: THREE.BufferGeometry[] = []
  const branch = (start: THREE.Vector3, dir: THREE.Vector3, l: number, rad: number, d: number) => {
    const c = new THREE.CylinderGeometry(rad * 0.55, rad, l, 4, 1, true)
    c.translate(0, l / 2, 0)
    c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, dir))
    c.translate(start.x, start.y, start.z)
    parts.push(c)
    if (d === 0) return
    const end = start.clone().addScaledVector(dir, l)
    for (let k = 0; k < 3; k++) {
      const nd = dir.clone().add(new THREE.Vector3(rand() - 0.5, rand() * 0.4, rand() - 0.5).multiplyScalar(1.3)).normalize()
      branch(end, nd, l * (0.55 + rand() * 0.25), rad * 0.62, d - 1)
    }
  }
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2
    const dir = new THREE.Vector3(Math.cos(a) * spread, 1, Math.sin(a) * spread).normalize()
    branch(new THREE.Vector3(), dir, len * (0.7 + rand() * 0.5), r, depth)
  }
  return mergeGeometries(parts)!
}

const bushGeo = () => {
  const g = twigs(7, 0.9, 0.32, 0.014, 3)
  g.computeBoundingBox()
  const s = 1 / g.boundingBox!.max.y
  g.scale(s, s, s)
  return g
}

// bola de galhos: cordas aleatorias dentro de uma esfera
const tumbleGeo = (radius: number) => {
  const parts: THREE.BufferGeometry[] = []
  const a = new THREE.Vector3(), b = new THREE.Vector3()
  for (let i = 0; i < 70; i++) {
    a.randomDirection().multiplyScalar(radius * (0.7 + rand() * 0.3))
    b.randomDirection().multiplyScalar(radius * (0.7 + rand() * 0.3))
    const d = b.clone().sub(a)
    const c = new THREE.CylinderGeometry(0.004, 0.006, d.length(), 3, 1, true)
    c.translate(0, d.length() / 2, 0)
    c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, d.normalize()))
    c.translate(a.x, a.y, a.z)
    parts.push(c)
  }
  return mergeGeometries(parts)!
}

const grassGeo = () => {
  const g = new THREE.ConeGeometry(0.006, 1, 3, 1)
  g.translate(0, 0.5, 0)
  return g
}

const grassColors = [0x8a7550, 0x6e5c3c, 0xa58e62, 0x4f4330, 0x9b7d4e].map((c) => new THREE.Color(c))

// posicao ao longo do corredor: s = distancia a partir da boca do cano
const along = (s: number, x: number) => new THREE.Vector3(x, heightAt(x, MUZZLE.z - s), MUZZLE.z - s)

export const Vegetation = () => {
  const tumble = useRef<THREE.Group>(null)

  const built = useMemo(() => timed('vegetacao', () => {
    // rochas
    // as cores apontam para as tintas do cenario: trocar de cenario recolore tudo sem reconstruir
    const rockMat = new THREE.MeshStandardMaterial({ roughness: 0.93, vertexColors: true })
    rockMat.color = TINT.rock
    const rocks = [0, 1, 2].map((k) => new THREE.InstancedMesh(rockGeo(k * 17.3), rockMat, 110))
    rocks.forEach((m, k) => {
      for (let i = 0; i < m.count; i++) {
        let x: number, s: number, size: number
        if (i < 25) {
          // pedras pequenas espalhadas em volta do atirador
          let z: number
          do {
            x = (rand() - 0.5) * 16
            z = SHOOTER.z + (rand() - 0.5) * 16
          } while (!clearOfShooter(x, z))
          s = MUZZLE.z - z
          size = 0.04 + rand() * rand() * 0.25
        } else {
          s = 15 + rand() * (RANGE + 60)
          const far = rand()
          x = (rand() < 0.5 ? -1 : 1) * (8 + far * far * 220)
          size = 0.25 + Math.pow(rand(), 3) * (Math.abs(x) > 40 ? 7 : 1.6)
        }
        const p = along(s, x)
        o.position.set(p.x, p.y - size * 0.3, p.z)
        o.rotation.set(rand() * 0.4, rand() * Math.PI * 2, rand() * 0.4)
        o.scale.set(size * (0.8 + rand() * 0.5), size, size * (0.8 + rand() * 0.5))
        o.updateMatrix()
        m.setMatrixAt(i, o.matrix)
      }
      m.userData.k = k
    })

    // cascalho miudo em volta do atirador: o que a camera de abertura ve de perto
    const pebbles = new THREE.InstancedMesh(rockGeo(91.7), rockMat, 1600)
    for (let i = 0; i < pebbles.count; i++) {
      let x: number, z: number
      do {
        const a = rand() * Math.PI * 2
        const r = Math.sqrt(rand()) * 7
        x = Math.cos(a) * r
        z = SHOOTER.z + Math.sin(a) * r
      } while (!clearOfShooter(x, z))
      const size = 0.005 + Math.pow(rand(), 2.5) * 0.035
      o.position.set(x, heightAt(x, z) + 0.015 - size * 0.2, z)
      o.rotation.set(rand() * 3, rand() * 3, rand() * 3)
      o.scale.set(size * (0.8 + rand() * 0.6), size, size * (0.8 + rand() * 0.6))
      o.updateMatrix()
      pebbles.setMatrixAt(i, o.matrix)
    }

    // arbustos secos
    const bushMat = swaying(new THREE.MeshStandardMaterial({ roughness: 1 }), 0.05, 1.6)
    bushMat.color = TINT.bush
    const bushes = new THREE.InstancedMesh(bushGeo(), bushMat, 520)
    for (let i = 0; i < bushes.count; i++) {
      let x: number, s: number
      if (i < 30) {
        let z: number
        do {
          x = (rand() - 0.5) * 22
          z = SHOOTER.z + (rand() - 0.5) * 22
        } while (Math.abs(x) < 2.5 && z > -4 && z < 4)
        s = MUZZLE.z - z
      } else {
        s = 10 + rand() * (RANGE + 80)
        const far = rand()
        x = (rand() < 0.5 ? -1 : 1) * (5 + far * far * 160)
      }
      const p = along(s, x)
      const h = 0.35 + rand() * 0.75
      o.position.copy(p)
      o.rotation.set(0, rand() * Math.PI * 2, 0)
      o.scale.set(h * (0.9 + rand() * 0.5), h, h * (0.9 + rand() * 0.5))
      o.updateMatrix()
      bushes.setMatrixAt(i, o.matrix)
    }

    // capim: tufos em volta do atirador e espalhados ao longo do caminho
    const grassMat = swaying(new THREE.MeshStandardMaterial({ roughness: 1, side: THREE.DoubleSide }), 0.16, 2)
    grassMat.color = TINT.grass
    const grass = new THREE.InstancedMesh(grassGeo(), grassMat, 9000)
    const dir = new THREE.Vector3()
    let j = 0
    while (j < grass.count) {
      let x: number, s: number
      if (j < 2600) {
        x = (rand() - 0.5) * 14
        const z = SHOOTER.z + (rand() - 0.5) * 12 - 1
        if (!clearOfShooter(x, z)) continue
        s = MUZZLE.z - z
      } else {
        s = rand() * RANGE
        x = (rand() < 0.5 ? -1 : 1) * (2.5 + rand() * 40)
      }
      const blades = 8 + ((rand() * 14) | 0)
      for (let q = 0; q < blades && j < grass.count; q++, j++) {
        const p = along(s + (rand() - 0.5) * 0.2, x + (rand() - 0.5) * 0.2)
        o.position.set(p.x, p.y - 0.01, p.z)
        dir.set((rand() - 0.5) * 0.8, 1, (rand() - 0.5) * 0.8).normalize()
        o.quaternion.setFromUnitVectors(Y, dir)
        const w = 0.5 + rand() * 0.8
        o.scale.set(w, 0.08 + rand() * 0.3, w)
        o.updateMatrix()
        grass.setMatrixAt(j, o.matrix)
        grass.setColorAt(j, grassColors[(rand() * grassColors.length) | 0])
      }
    }

    // tumbleweeds
    const tumbleMat = new THREE.MeshStandardMaterial({ color: 0x7a6040, roughness: 1 })
    const weeds = [
      { z: SHOOTER.z - 9, r: 0.35, speed: 4.2, off: 0 },
      { z: SHOOTER.z - 22, r: 0.45, speed: 3.6, off: 47 },
      { z: MUZZLE.z - 480, r: 0.4, speed: 4.8, off: 13 },
      { z: MUZZLE.z - 1150, r: 0.5, speed: 4.0, off: 80 },
      { z: MUZZLE.z - 1720, r: 0.38, speed: 5.1, off: 31 }
    ].map((w) => {
      const m = new THREE.Mesh(tumbleGeo(w.r), tumbleMat)
      m.userData = w
      return m
    })

    return { rocks, pebbles, bushes, grass, weeds }
  }), [])

  // tumbleweeds rolam da direita para a esquerda, quicando no chao
  useFrame(() => {
    const t = windTime.value
    tumble.current?.children.forEach((m) => {
      const { z, r, speed, off } = m.userData as { z: number; r: number; speed: number; off: number }
      const travel = (t * speed + off) % 140
      const x = 70 - travel
      const bounce = Math.abs(Math.sin(t * 2.2 + off)) * 0.3
      m.position.set(x, heightAt(x, z) + r + bounce, z)
      m.rotation.set(Math.sin(t + off) * 0.3, 0, travel / r)
    })
  })

  return (
    <>
      {built.rocks.map((m, i) => <primitive key={i} object={m} />)}
      <primitive object={built.pebbles} />
      <primitive object={built.bushes} />
      <primitive object={built.grass} />
      <group ref={tumble}>
        {built.weeds.map((m, i) => <primitive key={i} object={m} />)}
      </group>
    </>
  )
}
