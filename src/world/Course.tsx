import { useMemo } from 'react'
import * as THREE from 'three'
import { heightAt } from './height'
import { MUZZLE } from './layout'
import { flapping } from './wind'

// equipamento de um campo de tiro de longa distancia: bandeiras de vento e placas de distancia

const FLAGS: [s: number, x: number][] = [[180, -7], [600, 8], [1080, -7.5], [1540, 8.5], [1940, -6.5]]
// uma placa em cada mudanca de etapa
const MARKERS = [400, 900, 1300, 1650, 1850]

const canvasTex = (w: number, h: number, draw: (x: CanvasRenderingContext2D) => void) => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// sujeira e desgaste por cima de qualquer textura
const grime = (x: CanvasRenderingContext2D, w: number, h: number, n: number) => {
  for (let i = 0; i < n; i++) {
    const r = 4 + Math.random() * 30
    const px = Math.random() * w, py = Math.random() * h
    const g = x.createRadialGradient(px, py, 0, px, py, r)
    g.addColorStop(0, `rgba(${90 + Math.random() * 40},${60 + Math.random() * 30},${30},${0.08 + Math.random() * 0.2})`)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    x.fillStyle = g
    x.fillRect(px - r, py - r, r * 2, r * 2)
  }
}

const flagTex = canvasTex(256, 128, (x) => {
  x.fillStyle = '#d4532a'
  x.fillRect(0, 0, 256, 128)
  x.fillStyle = '#e9e1d2'
  x.beginPath()
  x.moveTo(110, 0); x.lineTo(160, 0); x.lineTo(70, 128); x.lineTo(20, 128)
  x.fill()
  grime(x, 256, 128, 30)
})

const plateTex = (m: number) => canvasTex(512, 256, (x) => {
  x.fillStyle = '#d9d2c2'
  x.fillRect(0, 0, 512, 256)
  grime(x, 512, 256, 60)
  // escorrido de ferrugem dos parafusos
  for (const px of [40, 472]) {
    const g = x.createLinearGradient(0, 30, 0, 200)
    g.addColorStop(0, 'rgba(120,60,25,.55)')
    g.addColorStop(1, 'rgba(120,60,25,0)')
    x.fillStyle = g
    x.fillRect(px - 6, 30, 12, 170)
    x.fillStyle = '#3a3a3a'
    x.beginPath()
    x.arc(px, 34, 9, 0, Math.PI * 2)
    x.fill()
  }
  x.fillStyle = '#1b1a18'
  x.font = 'bold 150px "Courier New", monospace'
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  x.fillText(String(m), 256, 120)
  x.font = 'bold 40px "Courier New", monospace'
  x.fillText('METROS', 256, 218)
})

const woodTex = canvasTex(64, 256, (x) => {
  x.fillStyle = '#6a4e34'
  x.fillRect(0, 0, 64, 256)
  for (let i = 0; i < 40; i++) {
    x.strokeStyle = `rgba(${40 + Math.random() * 30},${28 + Math.random() * 20},15,.5)`
    x.lineWidth = 1 + Math.random() * 2
    x.beginPath()
    const px = Math.random() * 64
    x.moveTo(px, 0)
    x.bezierCurveTo(px + 6, 80, px - 6, 170, px + 3, 256)
    x.stroke()
  }
})

export const Course = () => {
  const group = useMemo(() => {
    const g = new THREE.Group()
    const steel = new THREE.MeshStandardMaterial({ color: 0x6f6a62, roughness: 0.55, metalness: 0.8 })
    const wood = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 1 })
    const flagMat = flapping(new THREE.MeshStandardMaterial({ map: flagTex, roughness: 0.9, side: THREE.DoubleSide }), 1.4, 0.16)

    for (const [s, x] of FLAGS) {
      const z = MUZZLE.z - s
      const y = heightAt(x, z)
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 4.6, 12), steel)
      pole.position.set(x, y + 2.3, z)
      g.add(pole)
      const geo = new THREE.PlaneGeometry(1.4, 0.55, 36, 10)
      geo.translate(0.7, -0.275, 0)
      const flag = new THREE.Mesh(geo, flagMat)
      // a bandeira aponta para onde o vento vai: -x
      flag.rotation.y = Math.PI
      flag.position.set(x, y + 4.55, z)
      g.add(flag)
    }

    for (const m of MARKERS) {
      const z = MUZZLE.z - m
      const x = 6
      const y = heightAt(x, z)
      for (const dx of [-0.35, 0.35]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.7, 0.09), wood)
        post.position.set(x + dx, y + 0.8, z)
        g.add(post)
      }
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(1.0, 0.5, 0.012),
        [steel, steel, steel, steel, new THREE.MeshStandardMaterial({ map: plateTex(m), roughness: 0.7, metalness: 0.15 }), steel]
      )
      plate.position.set(x, y + 1.35, z + 0.06)
      plate.rotation.y = -0.25 // virada para quem vem do atirador
      g.add(plate)
    }
    return g
  }, [])

  return <primitive object={group} />
}
