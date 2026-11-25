import { useMemo } from 'react'
import * as THREE from 'three'
import { ContactShadows } from '@react-three/drei'
import { SHOOTER } from './layout'
import { heightAt } from './height'
import { bulletProfile } from './Projectile'

// detalhes da posicao de tiro: sombra de contato do atirador e do fuzil, e estojos .338 na areia

const brass = new THREE.MeshStandardMaterial({ color: 0xc2a25e, metalness: 1, roughness: 0.28 })
const copper = new THREE.MeshStandardMaterial({ color: 0xc9825a, metalness: 1, roughness: 0.24 })
const primer = new THREE.MeshStandardMaterial({ color: 0xb0b0b0, metalness: 1, roughness: 0.35 })

// estojo .338 Lapua Magnum em mm reais: aro 14,9, ombro 13,8, gargalo 9,5, comprimento total 93,5
const caseProfile: [number, number][] = [
  [0, 0], [0.0074, 0], [0.0075, 0.0012], [0.0075, 0.002], [0.0062, 0.0028], [0.0062, 0.0042],
  [0.0074, 0.0052], [0.0072, 0.0545], [0.0049, 0.0605], [0.0047, 0.0607], [0.0047, 0.0692], [0.0043, 0.0692]
]

const cartridge = () => {
  const g = new THREE.Group()
  g.add(new THREE.Mesh(new THREE.LatheGeometry(caseProfile.map(([r, y]) => new THREE.Vector2(r, y)), 48), brass))
  const b = new THREE.Mesh(new THREE.LatheGeometry(bulletProfile(), 48), copper)
  b.position.y = 0.0935 - 0.0205
  g.add(b)
  const p = new THREE.Mesh(new THREE.CircleGeometry(0.0028, 24), primer)
  p.rotation.x = Math.PI / 2
  p.position.y = -0.0002
  g.add(p)
  return g
}

export const Sniper = () => {
  const rounds = useMemo(() => {
    // estojos deitados na areia, a direita do fuzil (lado da camera)
    const group = new THREE.Group()
    const spots: [number, number, number][] = [[0.34, -0.35, 0.4], [0.4, -0.3, 0.55], [0.46, -0.24, 0.3], [0.3, -0.18, 2.6]]
    for (const [x, z, yaw] of spots) {
      const c = cartridge()
      c.rotation.set(0, yaw, Math.PI / 2, 'YXZ')
      c.position.set(x, heightAt(SHOOTER.x + x, SHOOTER.z + z) - SHOOTER.y + 0.015 + 0.0072, z)
      group.add(c)
    }
    return group
  }, [])

  return (
    <group position={SHOOTER}>
      <ContactShadows position={[-0.2, 0.006, 0.5]} scale={4.5} far={0.7} blur={2.4} opacity={0.8} resolution={512} color="#1a120b" />
      <primitive object={rounds} />
    </group>
  )
}
