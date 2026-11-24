import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { SHOOTER, BORE_HEIGHT, MUZZLE_Z, P_SHOT } from './layout'
import { telemetry } from './telemetry'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

// fuzil de chassi .338 Lapua em escala real (1,29 m), modelado a partir da foto de referencia.
// referencial local: boca do cano na origem, eixo do cano em y = 0, o fuzil cresce para +z (para tras)

// so MeshStandardMaterial: as variantes Physical (clearcoat, sheen, iridescencia) custavam
// segundos de compilacao de shader cada uma no Windows
const std = (color: number, roughness: number, metalness = 0, emissive = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive })

// textura de pintura cerakote: granulado fino que quebra o reflexo liso de plastico
const grain = (() => {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const x = c.getContext('2d')!
  const img = x.createImageData(256, 256)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 150 + Math.random() * 105
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v
    img.data[i + 3] = 255
  }
  x.putImageData(img, 0, 0)
  // marcas de uso
  x.strokeStyle = 'rgba(255,255,255,.35)'
  for (let i = 0; i < 60; i++) {
    x.lineWidth = Math.random() * 1.5
    x.beginPath()
    const px = Math.random() * 256, py = Math.random() * 256
    x.moveTo(px, py)
    x.lineTo(px + (Math.random() - 0.5) * 40, py + (Math.random() - 0.5) * 8)
    x.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(6, 6)
  return t
})()

const coated = (color: number, roughness: number, metalness: number) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, roughnessMap: grain, bumpMap: grain, bumpScale: 0.4 })

const mat = {
  fde: coated(0x7a6448, 0.7, 0.25),
  bronze: coated(0x5e4c36, 0.55, 0.5),
  black: coated(0x141414, 0.5, 0.55),
  rubber: std(0x0d0d0d, 0.92),
  steel: std(0xc4c4c4, 0.2, 1),
  glass: std(0x123033, 0.03, 0.95, 0x020809),
  green: std(0x2fd06a, 0.4, 0, 0x0c3a1c),
  fabric: std(0x6b5a42, 1)
}

// pecas usinadas nunca tem aresta viva: toda caixa sai com cantos arredondados
const rbox = (w: number, h: number, d: number) => new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * 0.22)

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

// ferrolho com estrias em espiral
const boltTex = canvasTex(256, 64, (x) => {
  x.fillStyle = '#cfcfcf'
  x.fillRect(0, 0, 256, 64)
  x.fillStyle = '#4a4a4a'
  for (let i = -4; i < 12; i++) {
    x.beginPath()
    x.moveTo(i * 32, 0); x.lineTo(i * 32 + 14, 0); x.lineTo(i * 32 + 54, 64); x.lineTo(i * 32 + 40, 64)
    x.fill()
  }
})

// tambor da torre de elevacao: tracos a cada 0,1 mrad e numeros a cada 1
const turretTex = canvasTex(512, 64, (x) => {
  x.fillStyle = '#111'
  x.fillRect(0, 0, 512, 64)
  x.fillStyle = '#d8d8d8'
  for (let i = 0; i < 100; i++) {
    const px = (i / 100) * 512
    x.fillRect(px, 0, 1.5, i % 10 === 0 ? 26 : i % 5 === 0 ? 18 : 11)
  }
  x.font = 'bold 22px monospace'
  x.textAlign = 'center'
  for (let i = 0; i < 10; i++) x.fillText(String(i), (i / 10) * 512 + 2, 54)
})

// gravacao a laser no cano
const engraveTex = canvasTex(512, 48, (x) => {
  x.clearRect(0, 0, 512, 48)
  x.fillStyle = 'rgba(30,24,16,.85)'
  x.font = 'bold 30px "Arial Narrow", Arial, sans-serif'
  x.textBaseline = 'middle'
  x.fillText('.338 LAPUA MAG   1:10   27"', 6, 25)
})

const V = (x: number, y: number) => new THREE.Vector2(x, y)

// perfil lateral desenhado em (z, y) e extrudado na largura (x)
const profile = (shape: THREE.Shape, width: number, bevel = 0.0015) => {
  const depth = Math.max(width - bevel * 2, 0.001)
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 10
  })
  g.translate(0, 0, -depth / 2)
  g.rotateY(-Math.PI / 2) // x do desenho vira z do mundo
  return g
}

const poly = (pts: [number, number][]) => new THREE.Shape(pts.map(([a, b]) => V(a, b)))
const hole = (pts: [number, number][]) => new THREE.Path(pts.map(([a, b]) => V(a, b)))

// rasgo M-LOK: retangulo com pontas arredondadas
const slot = (z: number, y: number, len: number, h: number) => {
  const r = h / 2
  const p = new THREE.Path()
  p.moveTo(z - len / 2 + r, y - r)
  p.lineTo(z + len / 2 - r, y - r)
  p.absarc(z + len / 2 - r, y, r, -Math.PI / 2, Math.PI / 2, false)
  p.lineTo(z - len / 2 + r, y + r)
  p.absarc(z - len / 2 + r, y, r, Math.PI / 2, Math.PI * 1.5, false)
  return p
}

const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
  const o = new THREE.Mesh(g, m)
  o.position.set(x, y, z)
  return o
}

// cilindro ao longo de z: r0 em z0, r1 em z1
const tube = (r0: number, r1: number, z0: number, z1: number, m: THREE.Material, y = 0, seg = 32, x = 0, open = false) => {
  const g = new THREE.CylinderGeometry(r1, r0, Math.abs(z1 - z0), seg, 1, open)
  g.rotateX(Math.PI / 2)
  return mesh(g, m, x, y, (z0 + z1) / 2)
}

// barra de secao retangular entre dois pontos
const beam = (a: THREE.Vector3, b: THREE.Vector3, w: number, d: number, m: THREE.Material) => {
  const dir = b.clone().sub(a)
  const o = new THREE.Mesh(rbox(w, dir.length(), d), m)
  o.position.copy(a).add(b).multiplyScalar(0.5)
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
  return o
}

// knob recartilhado: engrenagem fina extrudada
const knurl = (r: number, h: number, teeth: number, m: THREE.Material) => {
  const s = new THREE.Shape()
  for (let i = 0; i <= teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2
    const rr = i % 2 ? r * 0.94 : r
    if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr)
    else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false })
  g.translate(0, 0, -h / 2)
  g.rotateX(Math.PI / 2) // eixo vertical
  return new THREE.Mesh(g, m)
}

const buildScope = (g: THREE.Group) => {
  const front = 0.56
  const axis = 0.075
  // corpo inteiro num unico torno: campana da objetiva, tubo de 34 mm, sela, anel de zoom e ocular
  const pts: [number, number][] = [
    [0.0255, 0], [0.031, 0.002], [0.031, 0.074], [0.0305, 0.08], [0.0175, 0.15], [0.017, 0.2],
    [0.0188, 0.204], [0.0188, 0.266], [0.017, 0.27], [0.017, 0.33], [0.0205, 0.334], [0.0205, 0.372],
    [0.0185, 0.376], [0.0215, 0.392], [0.0218, 0.436], [0.02, 0.44], [0.016, 0.44]
  ]
  const lg = new THREE.LatheGeometry(pts.map(([r, a]) => V(r, a)), 64)
  lg.rotateX(Math.PI / 2)
  g.add(mesh(lg, mat.black, 0, axis, front))

  // anel verde da objetiva, como na foto
  // aneis abertos: a camera da fase da luneta olha por dentro do tubo
  g.add(tube(0.0312, 0.0312, front + 0.064, front + 0.07, mat.green, axis, 64, 0, true))

  // vidros com tratamento antirreflexo (iridescente)
  const lens = (r: number, z: number, flip: boolean) => {
    const c = new THREE.CircleGeometry(r, 48)
    if (flip) c.rotateY(Math.PI)
    g.add(mesh(c, mat.glass, 0, axis, z))
  }
  lens(0.0255, front + 0.004, true)
  lens(0.016, front + 0.437, false)

  // recartilhado do anel de zoom
  const zoom = knurl(0.021, 0.034, 48, mat.black)
  zoom.rotation.set(Math.PI / 2, 0, 0)
  zoom.position.set(0, axis, front + 0.353)
  g.add(zoom)

  // torre de elevacao em cima, deriva a direita, paralaxe a esquerda
  const sela = front + 0.235
  g.add(mesh(new THREE.CylinderGeometry(0.012, 0.013, 0.014, 32), mat.black, 0, axis + 0.025, sela))
  // tambor graduado em mrad embaixo, tampa recartilhada em cima
  g.add(mesh(new THREE.CylinderGeometry(0.0205, 0.0205, 0.013, 64, 1, true), new THREE.MeshStandardMaterial({ map: turretTex, roughness: 0.5, metalness: 0.4 }), 0, axis + 0.0385, sela))
  const elev = knurl(0.021, 0.014, 40, mat.black)
  elev.position.set(0, axis + 0.052, sela)
  g.add(elev)
  g.add(mesh(new THREE.CylinderGeometry(0.0195, 0.0195, 0.003, 40), mat.black, 0, axis + 0.0605, sela))

  const wind = knurl(0.016, 0.016, 32, mat.black)
  wind.rotation.z = Math.PI / 2
  wind.position.set(0.036, axis, sela)
  g.add(wind)
  const par = knurl(0.019, 0.014, 36, mat.black)
  par.rotation.z = Math.PI / 2
  par.position.set(-0.034, axis, sela)
  g.add(par)

  // tampas basculantes abertas
  const cap = (r: number, z: number, tilt: number) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.004, 40), mat.black)
    c.rotation.x = tilt
    c.position.set(0, axis + r + 0.006, z)
    g.add(c)
  }
  cap(0.033, front - 0.008, 0.25)
  cap(0.023, front + 0.446, -0.15)

  // aneis e bases sobre o trilho
  for (const z of [front + 0.17, front + 0.3]) {
    g.add(tube(0.0215, 0.0215, z - 0.011, z + 0.011, mat.black, axis, 40, 0, true))
    g.add(mesh(rbox(0.03, 0.026, 0.022), mat.black, 0, 0.046, z))
    for (const s of [-1, 1]) g.add(tube(0.004, 0.004, z - 0.006, z + 0.006, mat.steel, axis - 0.012, 12, 0.023 * s))
    // parafusos da capa do anel, dois de cada lado
    for (const s of [-1, 1]) {
      for (const dz of [-0.005, 0.005]) {
        const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.0026, 0.0026, 0.003, 12), mat.black)
        screw.rotation.z = Math.PI / 2
        screw.position.set(0.0222 * s, axis + 0.009, z + dz)
        g.add(screw)
      }
    }
  }
}

// cano com estrias: cilindro com o raio cavado em 6 sulcos estreitos no trecho do meio
const fluted = (z0: number, z1: number, r0: number, r1: number) => {
  const len = z1 - z0
  const geo = new THREE.CylinderGeometry(r1, r0, len, 96, 48)
  const p = geo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    const t = y / len + 0.5
    const ramp = THREE.MathUtils.smoothstep(t, 0.06, 0.14) * (1 - THREE.MathUtils.smoothstep(t, 0.76, 0.84))
    const flute = Math.pow(Math.max(0, Math.cos(6 * Math.atan2(z, x))), 4)
    const k = 1 - 0.17 * flute * ramp
    p.setXYZ(i, x * k, y, z * k)
  }
  geo.computeVertexNormals()
  geo.rotateX(Math.PI / 2)
  return mesh(geo, mat.bronze, 0, 0, (z0 + z1) / 2)
}

// ---------- luvas taticas encaixadas no fuzil ----------
// as maos do modelo humano tem pouca geometria e nao fecham em volta do punho;
// elas sao escondidas e estas luvas, modeladas no referencial do fuzil, ocupam o lugar
const glove = coated(0x2e2a24, 0.9, 0.05)

const finger = (pts: THREE.Vector3[], r: number) => {
  const curve = new THREE.CatmullRomCurve3(pts)
  const grp = new THREE.Group()
  grp.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, r, 10, false), glove))
  const tip = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), glove)
  tip.position.copy(pts[pts.length - 1])
  grp.add(tip)
  return grp
}

const oriented = (geo: THREE.BufferGeometry, pos: THREE.Vector3, basis: THREE.Matrix4) => {
  const m = new THREE.Mesh(geo, glove)
  m.quaternion.setFromRotationMatrix(basis)
  m.position.copy(pos)
  return m
}

const cuff = (wrist: THREE.Vector3, dir: THREE.Vector3) => {
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.029, 0.075, 20), glove)
  c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
  c.position.copy(wrist).addScaledVector(dir, 0.03)
  return c
}

// referencial do punho: topo, eixo descendo pelo punho, frente da empunhadura
const GT = new THREE.Vector3(0, -0.05, 0.955)
const GA = new THREE.Vector3(0, -0.909, 0.417)
const GF = new THREE.Vector3(0, -0.417, -0.909)
const GX = new THREE.Vector3(1, 0, 0)
const G = (u: number, f: number, x: number) => GT.clone().addScaledVector(GA, u).addScaledVector(GF, f).addScaledVector(GX, x)
const gripBasis = new THREE.Matrix4().makeBasis(GX, GA, GF)

const RIGHT_CUFF_DIR = new THREE.Vector3(0.45, -0.3, 0.84).normalize()
const RIGHT_WRIST = G(0.075, -0.03, 0.028)
const LEFT_FIST = new THREE.Vector3(-0.07, -0.128, 1.2)
const LEFT_CUFF_DIR = new THREE.Vector3(-0.6, -0.3, 0.74).normalize()
const LEFT_WRIST = LEFT_FIST.clone().add(new THREE.Vector3(-0.035, -0.005, 0.045))

// pontos onde o antebraco do modelo deve terminar, em coordenadas do atirador
const toShooter = (v: THREE.Vector3) => v.clone().add(new THREE.Vector3(0, BORE_HEIGHT, MUZZLE_Z))
export const WRISTS = {
  right: toShooter(RIGHT_WRIST.clone().addScaledVector(RIGHT_CUFF_DIR, 0.065)),
  left: toShooter(LEFT_WRIST.clone().addScaledVector(LEFT_CUFF_DIR, 0.065))
}

const buildGloves = (g: THREE.Group) => {
  // mao direita: palma do lado direito do punho, dorso por cima da empunhadura
  // palma e dorso como elipsoides: mao nao tem face plana
  const palm = oriented(new THREE.SphereGeometry(1, 24, 18), G(0.05, -0.006, 0.03), gripBasis)
  palm.scale.set(0.016, 0.05, 0.042)
  g.add(palm)
  const web = oriented(new THREE.SphereGeometry(1, 20, 14), G(0.01, -0.022, 0.014), gripBasis)
  web.scale.set(0.026, 0.02, 0.019)
  g.add(web)
  // medio, anelar e minimo contornando a frente do punho ate o lado esquerdo
  for (let k = 0; k < 3; k++) {
    const u = 0.041 + k * 0.021
    const r = 0.0094 - k * 0.0006
    g.add(finger([G(u, 0.004, 0.031), G(u, 0.024, 0.027), G(u, 0.034, 0.009), G(u, 0.031, -0.012), G(u, 0.016, -0.024), G(u, 0.0, -0.025)], r))
  }
  // indicador esticado ate o gatilho
  g.add(finger([G(0.016, 0.006, 0.029), new THREE.Vector3(0.026, -0.062, 0.885), new THREE.Vector3(0.016, -0.067, 0.867), new THREE.Vector3(0.005, -0.064, 0.857)], 0.0088))
  // polegar passando por cima do punho e apoiado no lado esquerdo do chassi
  g.add(finger([G(0.006, -0.02, 0.016), new THREE.Vector3(0.004, -0.04, 0.958), new THREE.Vector3(-0.022, -0.044, 0.935), new THREE.Vector3(-0.034, -0.042, 0.91)], 0.0098))
  g.add(cuff(RIGHT_WRIST, RIGHT_CUFF_DIR))

  // mao esquerda: punho fechado apertando o saco traseiro por baixo da coronha
  const fistBasis = new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1))
  const fist = oriented(new THREE.SphereGeometry(1, 24, 18), LEFT_FIST, fistBasis)
  fist.scale.set(0.036, 0.03, 0.048)
  g.add(fist)
  for (let k = 0; k < 4; k++) {
    const z = LEFT_FIST.z - 0.032 + k * 0.021
    const c = new THREE.Mesh(new THREE.CapsuleGeometry(0.0098, 0.03, 4, 10), glove)
    c.position.set(LEFT_FIST.x + 0.036, LEFT_FIST.y - 0.012, z)
    c.rotation.z = 0.35
    g.add(c)
  }
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.0105, 0.04, 4, 10), glove)
  thumb.rotation.z = Math.PI / 2
  thumb.position.set(LEFT_FIST.x + 0.01, LEFT_FIST.y + 0.03, LEFT_FIST.z - 0.03)
  g.add(thumb)
  g.add(cuff(LEFT_WRIST, LEFT_CUFF_DIR))
}

const build = () => {
  const g = new THREE.Group()

  // freio de boca: aneis com portas entre eles e barras solidas em cima e embaixo
  g.add(tube(0.0105, 0.0105, 0, 0.088, mat.bronze))
  for (const [a, b] of [[0, 0.01], [0.02, 0.03], [0.04, 0.05], [0.06, 0.07], [0.078, 0.088]]) g.add(tube(0.0168, 0.0168, a, b, mat.bronze, 0, 32))
  for (const s of [-1, 1]) g.add(mesh(rbox(0.02, 0.006, 0.088), mat.bronze, 0, 0.0135 * s, 0.044))

  // cano conico com 6 estrias usinadas e gravacao do calibre
  g.add(fluted(0.088, 0.64, 0.0125, 0.0158))
  const engr = new THREE.Mesh(
    new THREE.PlaneGeometry(0.14, 0.013),
    new THREE.MeshStandardMaterial({ map: engraveTex, transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 })
  )
  engr.rotation.y = Math.PI / 2
  engr.position.set(0.0157, 0.0, 0.55)
  g.add(engr)

  // guarda-mao com rasgos M-LOK vazados
  const hg = poly([[0.27, 0.018], [0.7, 0.018], [0.7, -0.042], [0.285, -0.042], [0.27, -0.03]])
  for (let i = 0; i < 9; i++) hg.holes.push(slot(0.315 + i * 0.042, -0.011, 0.03, 0.0085))
  g.add(mesh(profile(hg, 0.062, 0.003), mat.fde))
  // trilho inferior para o bipe
  g.add(mesh(rbox(0.02, 0.008, 0.14), mat.black, 0, -0.046, 0.33))

  // chassi central com guarda-mato vazado
  const ch = poly([
    [0.7, 0.02], [0.985, 0.02], [1.02, 0.002], [1.02, -0.036], [0.975, -0.05], [0.9, -0.05], [0.89, -0.085],
    [0.83, -0.085], [0.826, -0.068], [0.8, -0.068], [0.79, -0.062], [0.74, -0.062], [0.72, -0.045], [0.7, -0.042]
  ])
  ch.holes.push(hole([[0.84, -0.058], [0.878, -0.058], [0.876, -0.077], [0.842, -0.077]]))
  g.add(mesh(profile(ch, 0.07, 0.003), mat.fde))
  for (const s of [-1, 1]) g.add(mesh(rbox(0.003, 0.024, 0.085), mat.black, 0.036 * s, -0.012, 0.91))

  // gatilho
  const trig = new THREE.Mesh(rbox(0.006, 0.022, 0.006), mat.steel)
  trig.position.set(0, -0.064, 0.858)
  trig.rotation.x = -0.35
  g.add(trig)

  // carregador e base
  g.add(mesh(rbox(0.036, 0.085, 0.058), mat.fde, 0, -0.1, 0.768))
  g.add(mesh(rbox(0.04, 0.008, 0.064), mat.black, 0, -0.145, 0.768))

  // acao e ferrolho
  g.add(tube(0.021, 0.021, 0.64, 0.985, mat.fde, 0.002, 40))
  g.add(tube(0.0105, 0.0105, 0.82, 0.93, new THREE.MeshStandardMaterial({ map: boltTex, metalness: 1, roughness: 0.28 }), 0.004, 32, 0.014))
  // copo QD da bandoleira na coronha
  g.add(tube(0.009, 0.009, 1.055, 1.067, mat.black, -0.03, 20, 0.016))
  g.add(beam(new THREE.Vector3(0.02, 0.0, 0.95), new THREE.Vector3(0.058, -0.03, 0.958), 0.007, 0.007, mat.steel))
  g.add(mesh(new THREE.SphereGeometry(0.011, 24, 16), mat.rubber, 0.062, -0.034, 0.96))

  // trilho picatinny com dentes
  g.add(mesh(rbox(0.021, 0.008, 0.37), mat.black, 0, 0.026, 0.8))
  for (let i = 0; i < 36; i++) g.add(mesh(rbox(0.021, 0.004, 0.005), mat.black, 0, 0.032, 0.62 + i * 0.01))

  buildScope(g)

  // punho de borracha com dedos
  const grip = poly([
    [0.928, -0.046], [0.978, -0.046], [1.02, -0.145], [0.985, -0.152], [0.968, -0.13], [0.962, -0.112],
    [0.95, -0.105], [0.946, -0.088], [0.936, -0.082], [0.932, -0.066]
  ])
  g.add(mesh(profile(grip, 0.034, 0.005), mat.rubber))

  // coronha esqueletada
  const st = poly([
    [1.0, 0.009], [1.258, 0.009], [1.268, 0.0], [1.268, -0.136], [1.24, -0.142], [1.16, -0.106], [1.06, -0.061], [1.02, -0.046], [1.0, -0.036]
  ])
  st.holes.push(hole([[1.03, -0.012], [1.085, -0.012], [1.046, -0.05]]))
  st.holes.push(hole([[1.1, -0.014], [1.17, -0.014], [1.17, -0.09], [1.072, -0.054]]))
  st.holes.push(hole([[1.19, -0.014], [1.245, -0.014], [1.245, -0.118], [1.19, -0.094]]))
  g.add(mesh(profile(st, 0.028, 0.0025), mat.fde))

  // apoio de face e soleira
  const cheek = poly([[1.05, 0.018], [1.21, 0.018], [1.215, 0.04], [1.2, 0.046], [1.06, 0.046], [1.045, 0.036]])
  g.add(mesh(profile(cheek, 0.036, 0.005), mat.rubber))
  for (const z of [1.09, 1.17]) g.add(tube(0.004, 0.004, z - 0.004, z + 0.004, mat.steel, 0.013, 12))
  const pad = poly([[1.268, 0.038], [1.29, 0.04], [1.292, -0.14], [1.268, -0.142]])
  g.add(mesh(profile(pad, 0.046, 0.006), mat.rubber))

  // monope traseiro
  const mono = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.07, 16), mat.black)
  mono.position.set(0, -0.155, 1.215)
  g.add(mono)
  const monoKnob = knurl(0.014, 0.014, 24, mat.black)
  monoKnob.position.set(0, -0.15, 1.215)
  g.add(monoKnob)

  // bipe: braçadeira, corpo e pernas de duas secoes inclinadas para frente
  g.add(mesh(rbox(0.03, 0.018, 0.04), mat.black, 0, -0.058, 0.33))
  g.add(mesh(rbox(0.05, 0.022, 0.028), mat.black, 0, -0.075, 0.33))
  for (const s of [-1, 1]) {
    const top = new THREE.Vector3(0.022 * s, -0.082, 0.33)
    const knee = new THREE.Vector3(0.06 * s, -0.19, 0.29)
    const foot = new THREE.Vector3(0.088 * s, -0.292, 0.255)
    g.add(beam(top, knee, 0.014, 0.02, mat.black))
    g.add(beam(knee, foot, 0.01, 0.014, mat.black))
    g.add(mesh(new THREE.SphereGeometry(0.011, 16, 12), mat.rubber, foot.x, foot.y, foot.z))
  }

  // saco de apoio traseiro sob a coronha
  const bag = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.12, 8, 24), mat.fabric)
  bag.rotation.z = Math.PI / 2
  bag.scale.set(1, 1, 1.2)
  bag.position.set(0, -0.228, 1.215)
  g.add(bag)

  buildGloves(g)

  g.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true
      o.receiveShadow = true
    }
  })
  return g
}

export const Rifle = () => {
  const rifle = useMemo(build, [])
  const recoil = useRef<THREE.Group>(null)

  // recuo: o fuzil desliza para tras e a boca sobe logo depois do disparo
  useFrame(() => {
    const g = recoil.current
    if (!g) return
    const k = telemetry.p - P_SHOT
    const r = k > 0 ? Math.exp(-k * 160) * Math.min(1, k * 900) : 0
    g.position.z = r * 0.045
    g.rotation.x = r * 0.04
  })

  return (
    <group position={[SHOOTER.x, SHOOTER.y + BORE_HEIGHT, SHOOTER.z + MUZZLE_Z]}>
      <group ref={recoil}>
        <primitive object={rifle} />
      </group>
    </group>
  )
}
