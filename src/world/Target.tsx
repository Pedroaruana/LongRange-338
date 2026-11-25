import { useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { TARGET, P_IMPACT } from './layout'
import { telemetry } from './telemetry'
import { heightAt } from './height'

// placa de aco AR500 de 1,0 x 1,2 m pintada de branco, pendurada por correntes num portico de tubo.
// marcas antigas de chumbo na tinta, ferrugem escorrendo e sacos de areia na base

const W = 1.0
const H = 1.2
const BAR = 0.75 // altura da travessa acima do centro da placa

const tex = (w: number, h: number, draw: (x: CanvasRenderingContext2D) => void) => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// respingo de chumbo: miolo cinza escuro com raios de tinta arrancada
const splat = (x: CanvasRenderingContext2D, px: number, py: number, r: number) => {
  x.fillStyle = 'rgba(70,70,72,.9)'
  x.beginPath()
  x.arc(px, py, r, 0, Math.PI * 2)
  x.fill()
  x.strokeStyle = 'rgba(95,95,98,.75)'
  for (let i = 0; i < 22; i++) {
    const a = Math.random() * Math.PI * 2
    const l = r * (1.5 + Math.random() * 3.5)
    x.lineWidth = 0.6 + Math.random() * 2
    x.beginPath()
    x.moveTo(px + Math.cos(a) * r * 0.6, py + Math.sin(a) * r * 0.6)
    x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l)
    x.stroke()
  }
}

const plateTex = tex(512, 614, (x) => {
  x.fillStyle = '#e8e4da'
  x.fillRect(0, 0, 512, 614)
  // camadas antigas de tinta aparecendo
  for (let i = 0; i < 70; i++) {
    x.fillStyle = `rgba(${150 + Math.random() * 40},${140 + Math.random() * 40},${120 + Math.random() * 30},.25)`
    x.beginPath()
    x.arc(Math.random() * 512, Math.random() * 614, 3 + Math.random() * 22, 0, Math.PI * 2)
    x.fill()
  }
  // ferrugem descendo das bordas e furos de suspensao
  for (const px of [90, 422]) {
    const g = x.createLinearGradient(0, 20, 0, 320)
    g.addColorStop(0, 'rgba(130,60,20,.7)')
    g.addColorStop(1, 'rgba(130,60,20,0)')
    x.fillStyle = g
    x.fillRect(px - 10, 20, 20, 300)
  }
  const edge = x.createLinearGradient(0, 520, 0, 614)
  edge.addColorStop(0, 'rgba(110,70,40,0)')
  edge.addColorStop(1, 'rgba(110,70,40,.6)')
  x.fillStyle = edge
  x.fillRect(0, 520, 512, 94)
  // tiros anteriores espalhados
  for (let i = 0; i < 9; i++) splat(x, 120 + Math.random() * 270, 140 + Math.random() * 340, 4 + Math.random() * 5)
})

const rustTex = tex(128, 128, (x) => {
  x.fillStyle = '#4a3226'
  x.fillRect(0, 0, 128, 128)
  for (let i = 0; i < 400; i++) {
    x.fillStyle = `rgba(${110 + Math.random() * 60},${50 + Math.random() * 30},${20},${Math.random() * 0.5})`
    x.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 5, 1 + Math.random() * 5)
  }
})

const bagTex = tex(128, 128, (x) => {
  x.fillStyle = '#8a7656'
  x.fillRect(0, 0, 128, 128)
  for (let i = 0; i < 128; i += 3) {
    x.fillStyle = 'rgba(50,38,22,.18)'
    x.fillRect(0, i, 128, 1)
    x.fillRect(i, 0, 1, 128)
  }
})

const sparkSprite = () => {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const x = c.getContext('2d')!
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.2, 'rgba(255,200,130,.7)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  x.fillStyle = g
  x.fillRect(0, 0, 128, 128)
  return new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(c), color: new THREE.Color(9, 6.5, 4),
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false
  }))
}

const dustSprite = () => {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const x = c.getContext('2d')!
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(190,150,110,.8)')
  g.addColorStop(1, 'rgba(190,150,110,0)')
  x.fillStyle = g
  x.fillRect(0, 0, 128, 128)
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthWrite: false, transparent: true }))
}

export const Target = () => {
  const built = useMemo(() => {
    const ground = heightAt(TARGET.x, TARGET.z) - TARGET.y
    const rust = new THREE.MeshStandardMaterial({ map: rustTex, roughness: 0.85, metalness: 0.5 })
    const paint = new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.75, metalness: 0.1 })
    const steelEdge = new THREE.MeshStandardMaterial({ color: 0x5a5550, roughness: 0.5, metalness: 0.8 })
    const bag = new THREE.MeshStandardMaterial({ map: bagTex, roughness: 1 })

    const frame = new THREE.Group()
    const tubeH = BAR - ground
    for (const x of [-0.95, 0.95]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, tubeH, 0.06), rust)
      post.position.set(x, ground + tubeH / 2, 0)
      frame.add(post)
      // pe em T sobre o chao
      const skid = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.9), rust)
      skid.position.set(x, ground + 0.025, 0)
      frame.add(skid)
      // mao-francesa
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.6, 0.04), rust)
      brace.position.set(x, ground + 0.28, -0.2)
      brace.rotation.x = 0.7
      frame.add(brace)
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.06, 0.06), rust)
    bar.position.set(0, BAR, 0)
    frame.add(bar)

    // sacos de areia segurando os pes
    for (const x of [-0.95, 0.95]) {
      for (let k = 0; k < 3; k++) {
        const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.3, 6, 16), bag)
        b.rotation.set(Math.PI / 2, 0, (Math.random() - 0.5) * 0.5)
        b.scale.set(1, 1, 0.55)
        b.position.set(x + (k - 1) * 0.08, ground + 0.07 + (k === 2 ? 0.12 : 0), (k - 1) * 0.28)
        frame.add(b)
      }
    }

    // placa articulada na travessa
    const hang = new THREE.Group()
    hang.position.set(0, BAR, 0)
    const shape = new THREE.Shape()
    const r = 0.04
    shape.moveTo(-W / 2 + r, -H / 2)
    shape.lineTo(W / 2 - r, -H / 2)
    shape.quadraticCurveTo(W / 2, -H / 2, W / 2, -H / 2 + r)
    shape.lineTo(W / 2, H / 2 - r)
    shape.quadraticCurveTo(W / 2, H / 2, W / 2 - r, H / 2)
    shape.lineTo(-W / 2 + r, H / 2)
    shape.quadraticCurveTo(-W / 2, H / 2, -W / 2, H / 2 - r)
    shape.lineTo(-W / 2, -H / 2 + r)
    shape.quadraticCurveTo(-W / 2, -H / 2, -W / 2 + r, -H / 2)
    const pg = new THREE.ExtrudeGeometry(shape, { depth: 0.013, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 })
    // uv da frente cobrindo a placa inteira
    const uv = pg.attributes.uv as THREE.BufferAttribute
    const pos = pg.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / W + 0.5, pos.getY(i) / H + 0.5)
    const plateMesh = new THREE.Mesh(pg, [paint, steelEdge])
    const plateY = -(BAR - 0.0) // centro da placa coincide com TARGET
    plateMesh.position.set(0, plateY, -0.007)
    hang.add(plateMesh)

    // correntes: elos alternados
    const linkGeo = new THREE.TorusGeometry(0.012, 0.0035, 6, 12)
    const top = plateY + H / 2
    for (const x of [-0.36, 0.36]) {
      const n = Math.floor(-top / 0.019)
      for (let i = 0; i < n; i++) {
        const l = new THREE.Mesh(linkGeo, steelEdge)
        l.scale.set(1, 1.6, 1)
        l.position.set(x, -0.03 - i * 0.019, 0)
        l.rotation.y = i % 2 ? Math.PI / 2 : 0
        hang.add(l)
      }
    }

    const spark = sparkSprite()
    const dust = dustSprite()
    // marca do tiro novo: so aparece depois do impacto
    const hit = new THREE.Mesh(
      new THREE.CircleGeometry(0.05, 24),
      new THREE.MeshStandardMaterial({ map: tex(128, 128, (x) => splat(x, 64, 64, 10)), transparent: true, roughness: 0.6, metalness: 0.4 })
    )
    hit.position.set(0, plateY + 0, 0.009)
    hit.visible = false
    hang.add(hit)

    return { frame, hang, spark, dust, hit }
  }, [])

  useFrame(() => {
    const k = telemetry.p - P_IMPACT
    const hit = k > 0
    // pendulo amortecido em torno da travessa
    built.hang.rotation.x = hit ? -0.5 * Math.exp(-k * 14) * Math.sin(k * 80) : 0
    built.hit.visible = hit
    built.spark.material.opacity = hit ? Math.exp(-k * 120) : 0
    built.spark.scale.setScalar(0.5 + (hit ? Math.exp(-k * 60) * 2.2 : 0))
    // nuvem de poeira atras da placa que sobe e se dissipa
    const d = hit ? Math.min(1, k * 40) : 0
    built.dust.material.opacity = d * Math.exp(-k * 18) * 0.8
    built.dust.scale.setScalar(0.8 + k * 30)
    built.dust.position.set(-k * 6, -0.6 + k * 8, -0.6)
  })

  return (
    <group position={TARGET}>
      <primitive object={built.frame} />
      <primitive object={built.hang} />
      <primitive object={built.spark} position={[0, 0, 0.1]} />
      <primitive object={built.dust} />
    </group>
  )
}
