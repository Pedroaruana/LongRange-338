// funcao de altura unica: o terreno e a camera usam a mesma, entao a camera nunca atravessa o chao

const hash = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}

const smooth = (t: number) => t * t * (3 - 2 * t)

const noise = (x: number, y: number) => {
  const ix = Math.floor(x), iy = Math.floor(y)
  const fx = x - ix, fy = y - iy
  const ux = smooth(fx), uy = smooth(fy)
  const a = hash(ix, iy), b = hash(ix + 1, iy)
  const c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1)
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy
}

const fbm = (x: number, y: number, oct: number) => {
  let sum = 0, amp = 0.5, f = 1, norm = 0
  for (let i = 0; i < oct; i++) {
    sum += noise(x * f, y * f) * amp
    norm += amp
    amp *= 0.5
    f *= 2.03
  }
  return sum / norm
}

const ridged = (x: number, y: number, oct: number) => {
  let sum = 0, amp = 0.5, f = 1, norm = 0, prev = 1
  for (let i = 0; i < oct; i++) {
    let r = 1 - Math.abs(noise(x * f, y * f) * 2 - 1)
    r *= r
    sum += r * amp * prev
    norm += amp
    prev = r
    amp *= 0.5
    f *= 2.1
  }
  return sum / norm
}

export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// centro do canion: um rio seco que serpenteia ao longo de z
// corredor reto do tiro: de z=0 ate z=-2000 o canion endireita e alarga para a bala passar
const corridor = (z: number) => smoothstep(-2700, -2150, z) * (1 - smoothstep(150, 700, z))

export const valleyX = (z: number) =>
  -(Math.sin(z * 0.0015) * 180 + Math.sin(z * 0.0041 + 1.3) * 60) * (1 - corridor(z))

export const heightAt = (x: number, z: number) => {
  const c = corridor(z)
  const v = Math.max(0, Math.abs(x - valleyX(z)) - 90 * c)
  // no corredor do tiro o ruido nao pode empurrar a parede para o centro
  const wall = smoothstep(50, 480, v + fbm(x * 0.004, z * 0.004, 3) * 140 * (1 - c))

  const m = ridged(x * 0.0011 + 7.3, z * 0.0011, 6)
  let h = wall * (90 + m * 460)

  // patamares de mesa: o que da cara de canion de arenito
  const step = 34
  const k = h / step
  const fl = Math.floor(k)
  const terr = (fl + smoothstep(0.3, 0.7, k - fl)) * step
  h += (terr - h) * 0.8 * wall

  // dunas no leito
  const lane = 1 - 0.75 * c * (1 - smoothstep(30, 140, Math.abs(x)))
  h += fbm(x * 0.006, z * 0.006, 4) * 10 * (1 - wall * 0.6) * lane

  // elevacao suave onde o atirador esta deitado
  h += 5 * Math.exp(-(x * x + (z - 1) * (z - 1)) / (2 * 14 * 14))
  return h
}
