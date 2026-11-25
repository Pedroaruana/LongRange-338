import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { PLATES, EYE, anglesTo, losDir, fire, platePos, gun, type Plate } from './engine'
import { train, LESSONS, TEST_PLATES, air, activeScope, saveScore } from './lessons'
import { fovFor, MOA } from './scopes'
import { windStrength } from '../world/wind'
import { telemetry } from '../world/telemetry'
import { scenario } from '../world/scenarios'

// cena da escola de tiro: placas de aco no corredor, camera dentro da luneta,
// rastro da bala, impacto na placa ou poeira no chao

const view = { yaw: 0, pitch: 0, tYaw: 0, tPitch: 0, sway: 0.0005, aimYaw: 0, aimPitch: 0, recoil: 0 }
const now = () => performance.now() / 1000

const moverOn = () => train.mode === 'free' || LESSONS[train.lesson].id === 'move'
const isActive = (p: Plate) => !p.move || moverOn()

const canvasSprite = (draw: (x: CanvasRenderingContext2D) => void, color: THREE.Color, additive: boolean) => {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  draw(c.getContext('2d')!)
  return new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(c), color, transparent: true, depthWrite: false, toneMapped: !additive,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
  }))
}

const radial = (inner: string, outer: string) => (x: CanvasRenderingContext2D) => {
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, inner)
  g.addColorStop(1, outer)
  x.fillStyle = g
  x.fillRect(0, 0, 128, 128)
}

const traceVertex = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute float aS;
  varying float vS;
  void main() {
    vS = aS;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`
const traceFragment = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  uniform float uS;
  varying float vS;
  void main() {
    #include <logdepthbuf_fragment>
    float behind = uS - vS;
    if (behind < 0.0) discard;
    gl_FragColor = vec4(vec3(1.0, 0.92, 0.78) * 1.5, exp(-behind / 35.0) * 0.8);
  }
`

const dotsVertex = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute float aS;
  uniform float uS;
  uniform float uSize;
  varying float vA;
  void main() {
    float behind = uS - aS;
    // so a cabeca do rastro, os ultimos ~60 m, aparece como pontos
    vA = behind < 0.0 ? 0.0 : exp(-behind / 18.0);
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * (0.5 + vA);
    #include <logdepthbuf_vertex>
  }
`
const dotsFragment = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  varying float vA;
  void main() {
    #include <logdepthbuf_fragment>
    float r = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, r) * vA;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vec3(1.0, 0.85, 0.6) * 2.2, a);
  }
`

const BAR = 0.78 // travessa acima do centro da placa
const REPLAY = 3.6 // segundos do replay lateral

const buildPlate = (pl: Plate, rust: THREE.Material, paint: THREE.Material) => {
  const g = new THREE.Group()
  // a placa movel corre num trilho baixo, sem portico
  if (!pl.move) {
    for (const x of [-0.75, 0.75]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, BAR + 1.05, 0.06), rust)
      post.position.set(x, (BAR - 1.05) / 2, 0)
      g.add(post)
    }
    const cross = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.06), rust)
    cross.position.y = BAR
    g.add(cross)
  } else {
    const cart = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 0.6), rust)
    cart.position.y = -0.85
    g.add(cart)
  }
  const hang = new THREE.Group()
  hang.position.y = BAR
  const plate = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.02), paint)
  plate.position.y = -BAR
  hang.add(plate)
  for (const x of [-0.3, 0.3]) {
    const chain = new THREE.Mesh(new THREE.BoxGeometry(0.012, BAR - 0.5, 0.012), rust)
    chain.position.set(x, -(BAR - 0.5) / 2, 0)
    if (!pl.move) hang.add(chain)
  }
  g.add(hang)
  return { group: g, hang, swingStart: -10, plate: pl }
}

export const TrainWorld = () => {
  const built = useMemo(() => {
    const rust = new THREE.MeshStandardMaterial({ color: 0x4a3226, roughness: 0.85, metalness: 0.5 })
    const paint = new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.7, metalness: 0.1 })
    const plates = PLATES.map((p) => buildPlate(p, rust, paint))

    // respingo de chumbo na tinta: miolo cinza com raios de tinta arrancada, ~25 cm como num AR500 real
    const splat = document.createElement('canvas')
    splat.width = splat.height = 128
    const sx = splat.getContext('2d')!
    sx.fillStyle = 'rgba(70,70,74,.95)'
    sx.beginPath()
    sx.arc(64, 64, 16, 0, Math.PI * 2)
    sx.fill()
    sx.strokeStyle = 'rgba(90,90,96,.85)'
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2
      const l = 22 + Math.random() * 40
      sx.lineWidth = 1 + Math.random() * 3
      sx.beginPath()
      sx.moveTo(64 + Math.cos(a) * 10, 64 + Math.sin(a) * 10)
      sx.lineTo(64 + Math.cos(a) * l, 64 + Math.sin(a) * l)
      sx.stroke()
    }
    const markMat = new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(splat), transparent: true, roughness: 0.5, metalness: 0.6 })
    const markGeo = new THREE.PlaneGeometry(0.26, 0.26)

    const traceMat = new THREE.ShaderMaterial({
      vertexShader: traceVertex, fragmentShader: traceFragment, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, uniforms: { uS: { value: 0 } }
    })
    const trace = new THREE.Line(new THREE.BufferGeometry(), traceMat)
    trace.frustumCulled = false
    // pontos de tamanho fixo em pixels: o rastro aparece igual a 300 m ou a 1300 m
    const dotsMat = new THREE.ShaderMaterial({
      vertexShader: dotsVertex, fragmentShader: dotsFragment, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, uniforms: { uS: { value: 0 }, uSize: { value: 5 } }
    })
    const dots = new THREE.Points(new THREE.BufferGeometry(), dotsMat)
    dots.frustumCulled = false

    const spark = canvasSprite(radial('rgba(255,255,255,1)', 'rgba(0,0,0,0)'), new THREE.Color(9, 6.5, 4), true)
    const dust = canvasSprite(radial('rgba(200,160,120,.85)', 'rgba(200,160,120,0)'), new THREE.Color(1, 1, 1), false)
    const arrow = canvasSprite((x) => {
      x.fillStyle = '#e8a76b'
      x.beginPath()
      x.moveTo(24, 20); x.lineTo(104, 20); x.lineTo(64, 100)
      x.fill()
    }, new THREE.Color(1.6, 1.2, 0.9), false)

    return { plates, markMat, markGeo, trace, traceMat, dots, dotsMat, spark, dust, arrow, marks: [] as THREE.Mesh[] }
  }, [])

  // entradas: o primeiro clique trava o mouse na luneta (como num jogo de tiro) e os seguintes atiram.
  // roda muda o aumento, espaco prende a respiracao, WASD gira as torres, Esc solta o mouse
  useEffect(() => {
    const canvas = () => document.querySelector('canvas')
    const lockChange = () => { train.locked = document.pointerLockElement === canvas() }
    const move = (e: MouseEvent) => {
      if (!train.locked) return
      // 1 pixel de mouse = 1 pixel de angulo no aumento atual: a mira anda junto com a mao
      const k = ((fovFor(train.mag) * Math.PI) / 180) / innerHeight
      view.tYaw += e.movementX * k
      view.tPitch -= e.movementY * k
    }
    const down = (e: PointerEvent) => {
      if (telemetry.mode !== 'train' || train.phase !== 'run' || e.button !== 0) return
      if ((e.target as Element).closest?.('[data-ui]')) return
      if (!train.locked) {
        canvas()?.requestPointerLock()
        return
      }
      const l = LESSONS[train.lesson]
      if (train.mode === 'lessons' && l.kind !== 'shoot') return
      if (train.shot && !train.resolved) return
      if (train.mode === 'lessons' && l.shots && train.shots >= l.shots) return
      train.shot = fire(
        view.aimYaw + train.dialWind / 1000, view.aimPitch + train.dialElev / 1000,
        train.windX, PLATES[train.target], air(), now(), isActive
      )
      train.shotStart = now()
      train.resolved = false
      train.shots++
      view.recoil = 1
    }
    const wheel = (e: WheelEvent) => {
      if (telemetry.mode !== 'train' || train.phase !== 'run') return
      const s = activeScope()
      train.mag = THREE.MathUtils.clamp(train.mag - Math.sign(e.deltaY), s.magMin, s.magMax)
    }
    const key = (down: boolean) => (e: KeyboardEvent) => {
      if (telemetry.mode !== 'train' || train.phase !== 'run') return
      if (e.code === 'Space') {
        e.preventDefault()
        train.holding = down
        return
      }
      if (!down) return
      // um clique da torre na unidade da luneta, convertido para mrad
      const s = activeScope()
      const step = s.unit === 'moa' ? s.click * MOA : s.click
      const k = e.shiftKey ? 5 : 1
      if (e.code === 'KeyW' || e.code === 'ArrowUp') train.dialElev += step * k
      else if (e.code === 'KeyS' || e.code === 'ArrowDown') train.dialElev -= step * k
      else if (e.code === 'KeyD' || e.code === 'ArrowRight') train.dialWind += step * k
      else if (e.code === 'KeyA' || e.code === 'ArrowLeft') train.dialWind -= step * k
      else if (e.code === 'KeyR') train.dialElev = train.dialWind = 0
      else if (e.code === 'KeyV' && train.shot && train.resolved) train.replay = now()
    }
    const kd = key(true), ku = key(false)
    addEventListener('pointerdown', down)
    addEventListener('wheel', wheel, { passive: true })
    addEventListener('keydown', kd)
    addEventListener('keyup', ku)
    addEventListener('mousemove', move)
    document.addEventListener('pointerlockchange', lockChange)
    return () => {
      removeEventListener('pointerdown', down)
      removeEventListener('wheel', wheel)
      removeEventListener('keydown', kd)
      removeEventListener('keyup', ku)
      removeEventListener('mousemove', move)
      document.removeEventListener('pointerlockchange', lockChange)
      if (document.pointerLockElement) document.exitPointerLock()
      train.locked = false
    }
  }, [])

  const state = useMemo(() => ({ key: '', aimKey: '', shot: null as unknown, nextAt: 0, replayHead: -1 }), [])

  useFrame(({ camera, clock }, dtRaw) => {
    if (telemetry.mode !== 'train' || train.phase !== 'run') return
    const dt = Math.min(dtRaw, 0.05)
    const tNow = now()
    const t = clock.elapsedTime

    // nova licao ou modo: limpa marcas antigas
    const key = `${train.mode}-${train.lesson}-${train.scenarioId}`
    if (state.key !== key) {
      state.key = key
      built.marks.forEach((m) => m.removeFromParent())
      built.marks.length = 0
    }

    // rajadas: o vento oscila entre ~20% e ~180% da media; as bandeiras mostram a hora certa de atirar
    if (train.gusts) {
      const base = -scenario.current.wind
      const k = 1 + 0.55 * Math.sin(t * 0.37) + 0.3 * Math.sin(t * 0.83 + 1.3)
      train.windX = Math.round(base * k * 10) / 10
    }

    // vento visivel acompanha o vento do tiro
    windStrength.value += (Math.abs(train.windX) / 5 - windStrength.value) * Math.min(1, dt * 1.5)

    // respiracao: prender reduz a oscilacao por ~5 s; sem folego a mira treme mais
    if (train.holding && train.breath > 0) train.breath = Math.max(0, train.breath - dt / 5)
    else if (!train.holding) train.breath = Math.min(1, train.breath + dt / 3)
    const amp = train.holding && train.breath > 0 ? 0.00005 : train.breath < 0.05 ? 0.0013 : 0.00045
    view.sway += (amp - view.sway) * Math.min(1, dt * 3)

    // ao trocar de alvo a luneta comeca apontada para ele; dai em diante so o mouse mexe a mira
    const aimKey = `${train.mode}-${train.lesson}-${train.target}`
    if (state.aimKey !== aimKey) {
      state.aimKey = aimKey
      const base = anglesTo(PLATES[train.target].base)
      view.tYaw = base.yaw
      view.tPitch = base.pitch
    }
    view.yaw += (view.tYaw - view.yaw) * Math.min(1, dt * 30)
    view.pitch += (view.tPitch - view.pitch) * Math.min(1, dt * 30)
    view.aimYaw = view.yaw + Math.sin(t * 0.83) * view.sway + Math.sin(t * 2.3) * view.sway * 0.3
    view.aimPitch = view.pitch + Math.sin(t * 1.07 + 1) * view.sway * 0.8 + Math.sin(t * 0.29) * view.sway * 0.6

    view.recoil = Math.max(0, view.recoil - dt * 2.2)
    const kick = Math.sin(Math.min(1, 1 - view.recoil) * Math.PI) * view.recoil * 0.012

    const persp = camera as THREE.PerspectiveCamera
    // replay: a camera sai da luneta e acompanha a bala de lado, do cano ate o impacto
    const rp = train.replay > 0 && train.shot ? (tNow - train.replay) / REPLAY : -1
    if (rp >= 1) train.replay = 0
    const fov = rp >= 0 && rp < 1 ? 32 : fovFor(train.mag)
    if (Math.abs(persp.fov - fov) > 1e-4) {
      persp.fov = fov
      persp.updateProjectionMatrix()
    }
    if (rp >= 0 && rp < 1 && train.shot) {
      const path = train.shot.path
      const ease = rp < 0.85 ? rp / 0.85 : 1
      const i = Math.min(path.length - 1, Math.floor(ease * (path.length - 1)))
      const head = path[i]
      const back = Math.min(18, 6 + i * 0.02)
      camera.position.set(head.x + back * 0.9, head.y + 1.2 + i * 0.004, head.z + back)
      camera.lookAt(head)
      state.replayHead = i
    } else {
      camera.position.copy(EYE)
      camera.lookAt(losDir(view.aimYaw, view.aimPitch + kick).add(EYE))
      state.replayHead = -1
    }

    // placas: posicao (a movel anda), visibilidade e balanco depois do acerto
    for (const pl of built.plates) {
      pl.group.visible = isActive(pl.plate)
      platePos(pl.plate, tNow, pl.group.position)
      const k = tNow - pl.swingStart
      pl.hang.rotation.x = k < 4 ? -0.45 * Math.exp(-k * 2.2) * Math.sin(k * 9) : 0
    }

    const tp = built.plates[train.target]
    built.arrow.position.copy(tp.group.position).add(new THREE.Vector3(0, 1.25 + tp.plate.d * 0.0012, 0))
    built.arrow.scale.setScalar(tp.plate.d * 0.0014)

    const shot = train.shot
    if (shot !== state.shot) {
      state.shot = shot
      if (shot) {
        const pos = new Float32Array(shot.path.length * 3)
        const s = new Float32Array(shot.path.length)
        shot.path.forEach((p, i) => {
          p.toArray(pos, i * 3)
          s[i] = i
        })
        built.trace.geometry.dispose()
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
        g.setAttribute('aS', new THREE.BufferAttribute(s, 1))
        built.trace.geometry = g
        built.dots.geometry = g
      }
    }

    built.trace.visible = built.dots.visible = !!shot
    if (!shot) {
      built.spark.visible = false
      built.dust.visible = false
      train.mark = null
      return
    }

    const el = tNow - train.shotStart
    let i = 0
    while (i < shot.times.length - 1 && shot.times[i] < el) i++
    // depois do impacto a cauda do rastro continua se apagando; no replay o rastro segue a camera
    const head = state.replayHead >= 0 ? state.replayHead : el >= shot.tImpact ? shot.path.length + (el - shot.tImpact) * 300 : i
    built.traceMat.uniforms.uS.value = head
    built.dotsMat.uniforms.uS.value = head
    built.dotsMat.uniforms.uSize.value = 5 * Math.min(devicePixelRatio, 1.5)

    // resultado do tiro para o aviso fixo embaixo da luneta
    train.mark = train.resolved ? { x: 0, y: 0, hit: shot.hit?.id === shot.target.id, age: el - shot.tImpact } : null

    if (!train.resolved && el >= shot.tImpact) {
      train.resolved = true
      const onTarget = shot.hit?.id === shot.target.id
      if (onTarget) train.hits++

      // fim da prova: grava a pontuacao no ranking uma vez
      const lesson = LESSONS[train.lesson]
      if (train.mode === 'lessons' && lesson.id === 'test' && train.shots >= (lesson.shots ?? 5) && !train.saved) {
        train.saved = true
        saveScore({
          hits: train.hits, shots: train.shots, scenario: scenario.current.name,
          scope: activeScope().name, ammo: gun.ammo.name, date: Date.now()
        })
      }
      train.log.unshift({ d: shot.target.d, hit: onTarget, up: shot.up, right: shot.right })
      train.log.length = Math.min(train.log.length, 12)
      if (shot.hit && shot.local) {
        const pl = built.plates[shot.hit.id]
        pl.swingStart = tNow
        const m = new THREE.Mesh(built.markGeo, built.markMat)
        m.position.set(shot.local.x, shot.local.y - BAR, 0.011)
        pl.hang.add(m)
        built.marks.push(m)
        built.spark.position.copy(shot.impact).add(new THREE.Vector3(0, 0, 0.05))
      } else {
        built.dust.position.copy(shot.impact)
      }
      state.nextAt = tNow + 1.8
    }

    const live = train.resolved ? Math.max(0, el - shot.tImpact) : -1
    // faisca do aco: forte o bastante para ser vista na luneta a qualquer distancia
    built.spark.visible = !!shot.hit && live >= 0 && live < 0.7
    built.spark.material.opacity = Math.exp(-live * 6)
    built.spark.scale.setScalar(shot.target.d * 0.006 * (1 + live * 1.5))
    // poeira proporcional a distancia para continuar visivel na luneta
    const far = shot.impact.distanceTo(EYE) / 600
    built.dust.visible = !shot.hit && live >= 0 && live < 3
    built.dust.material.opacity = Math.exp(-live * 1.1)
    built.dust.scale.setScalar((1.2 + live * 3.5) * Math.max(1, far))
    built.dust.position.y = shot.impact.y + live * 0.8 * Math.max(1, far)

    // na prova, sorteia a proxima placa sozinho
    const l = LESSONS[train.lesson]
    if (train.mode === 'lessons' && l.id === 'test' && train.resolved && tNow > state.nextAt && train.shots < (l.shots ?? 0)) {
      const others = TEST_PLATES.filter((id) => id !== train.target)
      train.target = others[Math.floor(Math.random() * others.length)]
      train.shot = null
      train.resolved = false
    }
  })

  // o vento da cena acompanha o cenario mesmo antes do primeiro tiro
  useEffect(() => {
    windStrength.value = scenario.current.wind / 5
  }, [])

  return (
    <>
      {built.plates.map((p, i) => <primitive key={i} object={p.group} />)}
      <primitive object={built.trace} />
      <primitive object={built.dots} />
      <primitive object={built.spark} />
      <primitive object={built.dust} />
      <primitive object={built.arrow} />
    </>
  )
}
