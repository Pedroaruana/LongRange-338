import { useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { MUZZLE, P_SHOT } from './layout'
import { telemetry } from './telemetry'
import { WIND_SPEED } from './wind'

// nuvem de areia levantada pelo freio de boca: os gases saem pelas portas laterais,
// batem no chao e o vento leva a poeira. roda em tempo real a partir do disparo

const COUNT = 46
const LIFE = 3.2

const puffTexture = () => {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const x = c.getContext('2d')!
  for (let i = 0; i < 14; i++) {
    const px = 64 + (Math.random() - 0.5) * 50
    const py = 64 + (Math.random() - 0.5) * 50
    const r = 18 + Math.random() * 34
    const g = x.createRadialGradient(px, py, 0, px, py, r)
    g.addColorStop(0, 'rgba(255,255,255,.35)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = g
    x.fillRect(0, 0, 128, 128)
  }
  return new THREE.CanvasTexture(c)
}

type Puff = { sprite: THREE.Sprite; dir: THREE.Vector3; reach: number; delay: number; size: number }

export const Blast = () => {
  const { group, puffs } = useMemo(() => {
    const tex = puffTexture()
    const group = new THREE.Group()
    const puffs: Puff[] = []
    for (let i = 0; i < COUNT; i++) {
      const side = i % 2 ? 1 : -1
      // a maior parte sai para os lados, rente ao chao; um pouco para tras e para cima
      const dir = new THREE.Vector3(side * (0.6 + Math.random() * 0.6), -0.15 + Math.random() * 0.5, (Math.random() - 0.3) * 0.9).normalize()
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, color: new THREE.Color(0.72, 0.56, 0.4), transparent: true, depthWrite: false, opacity: 0,
        rotation: Math.random() * Math.PI * 2
      }))
      group.add(sprite)
      puffs.push({ sprite, dir, reach: 0.6 + Math.random() * 1.6, delay: Math.random() * 0.12, size: 0.15 + Math.random() * 0.3 })
    }
    return { group, puffs }
  }, [])

  const state = useMemo(() => ({ start: -1 }), [])

  useFrame(({ clock, camera }) => {
    const fired = telemetry.mode === 'shot' && telemetry.p >= P_SHOT
    if (fired && state.start < 0) state.start = clock.elapsedTime
    if (!fired) state.start = -1
    const t = state.start < 0 ? -1 : clock.elapsedTime - state.start
    group.visible = t >= 0 && t < LIFE + 0.3

    if (!group.visible) return
    for (const p of puffs) {
      const lt = Math.max(0, t - p.delay)
      const out = 1 - Math.exp(-lt * 4)
      p.sprite.position.copy(MUZZLE)
        .addScaledVector(p.dir, out * p.reach)
        .add(new THREE.Vector3(-WIND_SPEED * 0.35 * lt, 0.12 * lt - 0.12, 0))
      p.sprite.scale.setScalar(p.size * (0.4 + out * 1.6 + lt * 0.5))
      const fadeIn = Math.min(1, lt * 12)
      const fadeOut = 1 - THREE.MathUtils.smoothstep(lt, LIFE * 0.35, LIFE)
      // some perto da camera para a lente nunca ficar dentro da nuvem
      const near = THREE.MathUtils.smoothstep(p.sprite.position.distanceTo(camera.position), 0.4, 1.6)
      p.sprite.material.opacity = fadeIn * fadeOut * near * 0.24
    }
  })

  return <primitive object={group} />
}
