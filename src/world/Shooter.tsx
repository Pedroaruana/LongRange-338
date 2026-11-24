import { useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { SHOOTER } from './layout'
import { heightAt } from './height'
import { flapping, windTime } from './wind'
import { WRISTS } from './Rifle'

// atirador deitado em posicao de tiro. o modelo vem em pe (Mixamo);
// a pose e montada por codigo: deita o corpo e leva maos, pes e cabeca ate alvos fixos com IK de dois ossos.
// todas as coordenadas abaixo sao relativas a SHOOTER, com o fuzil apontando para -z

const URL = '/models/Soldier.glb'

// altura do chao relativa a SHOOTER: quadril e pes acompanham o relevo e nao afundam
const g = (x: number, z: number) => heightAt(SHOOTER.x + x, SHOOTER.z + z) + 0.015 - SHOOTER.y
const onGround = (x: number, lift: number, z: number) => new THREE.Vector3(x, g(x, z) + lift, z)

// alvos da pose (metros). corpo inclinado para a esquerda do fuzil
const POSE = {
  hips: onGround(-0.18, 0.12, 0.68),
  neck: new THREE.Vector3(-0.04, 0.27, 0.18),
  head: new THREE.Vector3(-0.02, 0.33, 0.06),
  headUp: new THREE.Vector3(0, 0.85, -0.5),
  // cotovelos apoiados no chao, abertos para fora
  rightPole: new THREE.Vector3(1, -1.2, 0.3),
  leftPole: new THREE.Vector3(-1, -1.2, 0.2),
  leftFoot: onGround(-0.6, 0.1, 1.6),
  leftKnee: new THREE.Vector3(-0.3, -1, 0),
  rightFoot: onGround(0.28, 0.1, 1.43),
  rightKnee: new THREE.Vector3(0.7, -0.8, 0.2),
  toes: new THREE.Vector3(0, -0.55, 0.85)
}

// tecido com trama e dobras desenhado em canvas
const clothTexture = () => {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const x = c.getContext('2d')!
  x.fillStyle = '#8f7a55'
  x.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 256; i += 2) {
    x.fillStyle = `rgba(60,45,25,${0.05 + Math.random() * 0.08})`
    x.fillRect(0, i, 256, 1)
    x.fillRect(i, 0, 1, 256)
  }
  // manchas de sujeira e desbotado, sem padrao regular
  for (let i = 0; i < 40; i++) {
    const r = 10 + Math.random() * 40
    const px = Math.random() * 256, py = Math.random() * 256
    const g = x.createRadialGradient(px, py, 0, px, py, r)
    const dark = Math.random() < 0.5
    g.addColorStop(0, dark ? 'rgba(50,36,18,.18)' : 'rgba(200,180,140,.12)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    x.fillStyle = g
    x.fillRect(px - r, py - r, r * 2, r * 2)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(3, 3)
  return t
}

// esfera amassada: ruido suave no raio vira dobras de tecido enrolado
const wrinkled = (r: number) => {
  const g = new THREE.SphereGeometry(r, 64, 48)
  const p = g.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    const n = v.clone().normalize()
    const k = 1 + 0.06 * Math.sin(n.x * 9 + n.y * 14) * Math.sin(n.z * 11 - n.y * 6) + 0.035 * Math.sin(n.y * 31 + n.x * 7)
    v.multiplyScalar(k)
    p.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  return g
}

const CLOTH = new THREE.MeshStandardMaterial({ map: clothTexture(), color: 0x8c7a5c, roughness: 1, side: THREE.DoubleSide })
const FLAP = flapping(new THREE.MeshStandardMaterial({ map: clothTexture(), color: 0x8c7a5c, roughness: 1, side: THREE.DoubleSide }), 0.3, 0.035, 14)

const wp = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3())

// gira `bone` para que a direcao ate `ref` (um descendente) aponte para `target` (mundo)
const aim = (bone: THREE.Object3D, ref: THREE.Object3D, target: THREE.Vector3) => {
  bone.updateWorldMatrix(true, true)
  const from = wp(ref).sub(wp(bone)).normalize()
  const to = target.clone().sub(wp(bone)).normalize()
  const delta = new THREE.Quaternion().setFromUnitVectors(from, to)
  const world = bone.getWorldQuaternion(new THREE.Quaternion())
  const parent = bone.parent ? bone.parent.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion()
  bone.quaternion.copy(parent.invert().multiply(delta.multiply(world)))
  bone.updateWorldMatrix(false, true)
}

// IK analitico de dois ossos: braco/antebraco ou coxa/canela
const twoBone = (upper: THREE.Object3D, lower: THREE.Object3D, end: THREE.Object3D, target: THREE.Vector3, pole: THREE.Vector3) => {
  upper.updateWorldMatrix(true, true)
  const A = wp(upper)
  const a = A.distanceTo(wp(lower))
  const b = wp(lower).distanceTo(wp(end))
  const toT = target.clone().sub(A)
  const d = THREE.MathUtils.clamp(toT.length(), 0.01, a + b - 0.002)
  const dir = toT.normalize()
  const x = (a * a - b * b + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(a * a - x * x, 0))
  const p = pole.clone().normalize()
  const side = p.sub(dir.clone().multiplyScalar(p.dot(dir))).normalize()
  const elbow = A.clone().addScaledVector(dir, x).addScaledVector(side, h)
  aim(upper, lower, elbow)
  aim(lower, end, A.clone().addScaledVector(dir, d))
}

export const Shooter = () => {
  const { scene } = useGLTF(URL)

  const model = useMemo(() => {
    const root = scene
    const bone = (n: string) => {
      const b = root.getObjectByName(`mixamorig${n}`)
      if (!b) throw new Error(`osso ausente: ${n}`)
      return b
    }
    const W = (v: THREE.Vector3) => v.clone().add(SHOOTER)

    // a textura original e uma armadura branca e vermelha: multiplicada por areia vira farda de deserto
    root.traverse((o) => {
      if (o instanceof THREE.SkinnedMesh) {
        o.frustumCulled = false
        o.castShadow = true
        const m = o.material as THREE.MeshStandardMaterial
        m.color.set(o.name.includes('visor') ? 0x1a1a18 : 0x9c8562)
        m.roughness = 0.85
        m.metalness = 0.05
        m.emissive?.set(0x000000)
      }
    })

    // deita de bruços com a cabeca para -z. este modelo olha para -z em pe,
    // entao -90 em x ja leva o rosto para baixo e mantem o lado direito em +x
    root.quaternion.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))
    root.position.set(0, 0, 0)
    root.updateMatrixWorld(true)
    // encaixa o quadril no ponto da pose
    const hipsNow = wp(bone('Hips'))
    root.position.add(W(POSE.hips).sub(hipsNow))
    root.updateMatrixWorld(true)

    // tronco levantado pelos cotovelos, pescoco estendido, olho na ocular
    aim(bone('Spine'), bone('Neck'), W(POSE.neck))
    aim(bone('Neck'), bone('Head'), W(POSE.head))
    aim(bone('Head'), bone('HeadTop_End'), W(POSE.head).add(POSE.headUp))

    // antebracos terminam no punho das luvas modeladas no fuzil; as maos do modelo somem
    twoBone(bone('RightArm'), bone('RightForeArm'), bone('RightHand'), W(WRISTS.right), POSE.rightPole)
    twoBone(bone('LeftArm'), bone('LeftForeArm'), bone('LeftHand'), W(WRISTS.left), POSE.leftPole)
    for (const s of ['Right', 'Left']) bone(`${s}Hand`).scale.setScalar(0.001)
    if (import.meta.env.DEV) {
      const rel = (n: string) => wp(bone(n)).sub(SHOOTER).toArray().map((v) => +v.toFixed(3))
      ;(window as Window & { __pose?: unknown }).__pose = {
        rArm: rel('RightArm'), rFore: rel('RightForeArm'), rHand: rel('RightHand'), rTarget: WRISTS.right.toArray(),
        lArm: rel('LeftArm'), lFore: rel('LeftForeArm'), lHand: rel('LeftHand'), lTarget: WRISTS.left.toArray(),
        head: rel('Head'), hips: rel('Hips')
      }
    }

    twoBone(bone('LeftUpLeg'), bone('LeftLeg'), bone('LeftFoot'), W(POSE.leftFoot), POSE.leftKnee)
    twoBone(bone('RightUpLeg'), bone('RightLeg'), bone('RightFoot'), W(POSE.rightFoot), POSE.rightKnee)
    for (const s of ['Left', 'Right']) {
      const foot = bone(`${s}Foot`)
      aim(foot, bone(`${s}ToeBase`), wp(foot).add(POSE.toes))
    }

    // shemagh: pano enrolado na cabeca, como na referencia
    const head = bone('Head')
    root.updateMatrixWorld(true)
    const top = wp(bone('HeadTop_End'))
    const center = wp(head).lerp(top, 0.48)
    const wrap = new THREE.Mesh(wrinkled(0.112), CLOTH)
    wrap.position.copy(center)
    wrap.scale.set(1.05, 1.1, 1.12)
    wrap.lookAt(top)
    head.attach(wrap)
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.22, 32, 1, true), CLOTH)
    tail.position.copy(wp(head)).lerp(center, 0.2)
    tail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(wp(head)).normalize())
    head.attach(tail)

    // ponta solta do shemagh tremulando para o lado do vento
    const flapGeo = new THREE.PlaneGeometry(0.3, 0.13, 20, 6)
    flapGeo.translate(0.15, 0, 0)
    const flap = new THREE.Mesh(flapGeo, FLAP)
    flap.position.copy(center).add(new THREE.Vector3(-0.02, -0.04, 0.1))
    flap.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), new THREE.Vector3(-0.55, -0.35, 0.75).normalize())
    head.attach(flap)

    // a cena do modelo ja esta em coordenadas de mundo
    root.position.sub(SHOOTER)
    const chest = bone('Spine2')
    return { root, chest, rest: chest.quaternion.clone() }
  }, [scene])

  // respiracao lenta e controlada, como antes do disparo
  useFrame(() => {
    model.chest.quaternion.copy(model.rest)
    model.chest.rotateX(Math.sin(windTime.value * 1.3) * 0.012)
  })

  return (
    <group position={SHOOTER}>
      <primitive object={model.root} />
    </group>
  )
}

useGLTF.preload(URL)
