function clampInt(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function hash2i(x: number, z: number, seed: number): number {
  let h = x * 374761393 + z * 668265263 + seed * 1442695041
  h = (h ^ (h >> 13)) >>> 0
  h = (h * 1274126177) >>> 0
  return ((h ^ (h >> 16)) >>> 0) / 4294967296
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}

function valueNoise2(x: number, z: number, seed: number): number {
  const x0 = Math.floor(x)
  const z0 = Math.floor(z)
  const x1 = x0 + 1
  const z1 = z0 + 1

  const sx = smoothstep(x - x0)
  const sz = smoothstep(z - z0)

  const n00 = hash2i(x0, z0, seed)
  const n10 = hash2i(x1, z0, seed)
  const n01 = hash2i(x0, z1, seed)
  const n11 = hash2i(x1, z1, seed)

  const ix0 = lerp(n00, n10, sx)
  const ix1 = lerp(n01, n11, sx)
  return lerp(ix0, ix1, sz)
}

export function fbm2(
  x: number,
  z: number,
  seed: number,
  freq: number,
  octaves: number,
  lacunarity: number,
  persistence: number,
): number {
  let amp = 1
  let f = freq
  let sum = 0
  let norm = 0

  for (let o = 0; o < octaves; o++) {
    sum += valueNoise2(x * f, z * f, seed + o * 1013) * amp
    norm += amp
    amp *= persistence
    f *= lacunarity
  }

  return norm > 0 ? sum / norm : 0
}

export function rand2i(x: number, z: number, seed: number): number {
  return hash2i(x, z, seed)
}

export function clampHeight(v: number, min: number, max: number): number {
  return clampInt(v, min, max)
}

