// scenes.mjs — procedural duotone backdrops (spec §6 imagery integration).
//
// Until the FLUX pipeline lands (M3), scenes are painted in-client: layered
// grayscale silhouettes — lamplight, rain, architecture — run through the
// same deterministic duotone post-process the model art will use (art.mjs).
// The backdrop sits BEHIND the drum at low luminance and drifts slowly
// (Ken Burns), honoring prefers-reduced-motion. Scene kind rides inside
// each scope's encrypted payload: the art is intel, same as the text.
//
// Deterministic per (kind, seed): the same dossier always shows the same
// night. Swapping in generateScene(brief, era) later changes the painter,
// not this seam.

import { ERAS, duotone } from './art.mjs'

const W = 960, H = 540           // painter coordinate space
const DPR = 2                    // render at 2x so fullscreen stays crisp

function hash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ------------------------------------------------------- grayscale painters
// Luminance only — the duotone pass owns color. 0 = ink, 1 = era accent.

const g = (v) => `rgba(${Math.round(v * 255)},${Math.round(v * 255)},${Math.round(v * 255)},1)`
const ga = (v, a) => `rgba(${Math.round(v * 255)},${Math.round(v * 255)},${Math.round(v * 255)},${a})`

function base(ctx, rand, horizon = 0.62) {
  const sky = ctx.createLinearGradient(0, 0, 0, H)
  sky.addColorStop(0, g(0.10 + rand() * 0.04))
  sky.addColorStop(horizon, g(0.22 + rand() * 0.06))
  sky.addColorStop(1, g(0.05))
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, H)
}

function glow(ctx, x, y, r, v = 0.9, a = 0.5) {
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r)
  grad.addColorStop(0, ga(v, a))
  grad.addColorStop(1, ga(v, 0))
  ctx.fillStyle = grad
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
}

function lampCone(ctx, x, top, spread, v = 0.55, a = 0.16) {
  ctx.fillStyle = ga(v, a)
  ctx.beginPath()
  ctx.moveTo(x, top)
  ctx.lineTo(x - spread, H)
  ctx.lineTo(x + spread, H)
  ctx.closePath()
  ctx.fill()
  glow(ctx, x, top, 14, 0.95, 0.8)
}

function figure(ctx, x, baseY, h, v = 0.04) {
  ctx.fillStyle = g(v)
  ctx.beginPath()
  ctx.ellipse(x, baseY - h * 0.86, h * 0.10, h * 0.12, 0, 0, Math.PI * 2)  // hat/head
  ctx.fill()
  ctx.beginPath()                                                          // coat
  ctx.moveTo(x - h * 0.16, baseY)
  ctx.lineTo(x - h * 0.10, baseY - h * 0.74)
  ctx.lineTo(x + h * 0.10, baseY - h * 0.74)
  ctx.lineTo(x + h * 0.16, baseY)
  ctx.closePath()
  ctx.fill()
}

function rain(ctx, rand, n = 90) {
  ctx.strokeStyle = ga(0.75, 0.05)
  ctx.lineWidth = 1
  for (let i = 0; i < n; i++) {
    const x = rand() * W, y = rand() * H, len = 14 + rand() * 26
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + len); ctx.stroke()
  }
}

const painters = {
  street(ctx, rand) {
    base(ctx, rand, 0.55)
    // skyline
    ctx.fillStyle = g(0.03)
    let x = -20
    while (x < W) {
      const w = 60 + rand() * 140, h = 120 + rand() * 220
      ctx.fillRect(x, H * 0.62 - h, w, h)
      // a few lit windows
      for (let i = 0; i < 5; i++) if (rand() < 0.25)
        ctx.fillStyle = ga(0.8, 0.5), ctx.fillRect(x + 8 + rand() * (w - 20), H * 0.62 - h + 10 + rand() * (h - 30), 5, 8), ctx.fillStyle = g(0.03)
      x += w + 8 + rand() * 30
    }
    lampCone(ctx, W * (0.22 + rand() * 0.1), H * 0.34, 90)
    lampCone(ctx, W * (0.68 + rand() * 0.12), H * 0.30, 110)
    // wet street sheen
    const wet = ctx.createLinearGradient(0, H * 0.62, 0, H)
    wet.addColorStop(0, ga(0.35, 0.25)); wet.addColorStop(1, ga(0.02, 0))
    ctx.fillStyle = wet; ctx.fillRect(0, H * 0.62, W, H * 0.38)
    figure(ctx, W * (0.4 + rand() * 0.2), H * 0.86, 150)
    rain(ctx, rand)
  },

  station(ctx, rand) {
    base(ctx, rand, 0.5)
    // great arched roof
    ctx.strokeStyle = ga(0.5, 0.5); ctx.lineWidth = 7
    ctx.beginPath(); ctx.ellipse(W / 2, H * 0.95, W * 0.55, H * 0.85, 0, Math.PI, 2 * Math.PI); ctx.stroke()
    ctx.lineWidth = 2
    for (let i = 1; i < 7; i++) {
      ctx.beginPath(); ctx.ellipse(W / 2, H * 0.95, W * 0.55 * (i / 7), H * 0.85 * (i / 7), 0, Math.PI, 2 * Math.PI); ctx.stroke()
    }
    // platform lamps into the distance
    for (let i = 0; i < 6; i++) {
      const t = i / 6
      glow(ctx, W * (0.28 + t * 0.42), H * (0.52 + t * 0.06), 10 + 18 * (1 - t), 0.95, 0.7)
    }
    // tracks
    ctx.strokeStyle = ga(0.6, 0.35)
    for (const off of [-40, -10, 15, 50]) {
      ctx.beginPath(); ctx.moveTo(W / 2 + off * 5, H); ctx.lineTo(W / 2 + off, H * 0.55); ctx.stroke()
    }
    figure(ctx, W * 0.62, H * 0.72, 90)
    ctx.fillStyle = ga(0.06, 0.9); ctx.fillRect(0, H * 0.88, W, H * 0.12)
  },

  cafe(ctx, rand) {
    base(ctx, rand, 0.45)
    ctx.fillStyle = g(0.02); ctx.fillRect(0, 0, W, H)   // interior dark
    // two warm windows
    for (const [wx, ww] of [[W * 0.14, W * 0.3], [W * 0.56, W * 0.3]]) {
      const warm = ctx.createLinearGradient(wx, 0, wx + ww, 0)
      warm.addColorStop(0, ga(0.85, 0.75)); warm.addColorStop(1, ga(0.65, 0.7))
      ctx.fillStyle = warm
      ctx.fillRect(wx, H * 0.22, ww, H * 0.5)
      // mullions
      ctx.fillStyle = g(0.02)
      ctx.fillRect(wx + ww / 2 - 3, H * 0.22, 6, H * 0.5)
      ctx.fillRect(wx, H * 0.44, ww, 5)
    }
    // figures in the near window
    ctx.save()
    ctx.globalCompositeOperation = 'source-atop'
    ctx.restore()
    figure(ctx, W * 0.24, H * 0.72, 120, 0.12)
    figure(ctx, W * 0.36, H * 0.72, 110, 0.12)
    // awning scallops
    ctx.fillStyle = g(0.05)
    for (let x = W * 0.1; x < W * 0.92; x += 36) {
      ctx.beginPath(); ctx.arc(x, H * 0.2, 18, 0, Math.PI); ctx.fill()
    }
    ctx.fillRect(W * 0.08, H * 0.14, W * 0.86, H * 0.06)
    glow(ctx, W * 0.3, H * 0.86, 60, 0.7, 0.2)   // spill on the pavement
  },

  office(ctx, rand) {
    base(ctx, rand, 0.4)
    ctx.fillStyle = g(0.04); ctx.fillRect(0, 0, W, H)
    // blind slats of streetlight on the wall
    ctx.save()
    ctx.translate(W * 0.5, 0); ctx.rotate(-0.06)
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = ga(0.55, 0.12 + rand() * 0.05)
      ctx.fillRect(-W * 0.55, H * 0.12 + i * 34, W * 0.9, 12)
    }
    ctx.restore()
    // desk plane + lamp
    ctx.fillStyle = g(0.07); ctx.fillRect(0, H * 0.7, W, H * 0.3)
    lampCone(ctx, W * 0.3, H * 0.42, 130, 0.85, 0.14)
    glow(ctx, W * 0.3, H * 0.7, 150, 0.85, 0.25)
    // papers in the pool of light
    ctx.fillStyle = ga(0.9, 0.5)
    ctx.save(); ctx.translate(W * 0.3, H * 0.74); ctx.rotate(-0.08)
    ctx.fillRect(-60, -10, 90, 60); ctx.rotate(0.14); ctx.fillRect(-20, -6, 90, 60)
    ctx.restore()
  },

  yard(ctx, rand) {
    base(ctx, rand, 0.58)
    // long low freight cars
    ctx.fillStyle = g(0.03)
    let x = -30
    while (x < W) {
      const w = 180 + rand() * 80
      ctx.fillRect(x, H * 0.5, w, H * 0.16)
      ctx.fillRect(x + 12, H * 0.66, 18, 10); ctx.fillRect(x + w - 30, H * 0.66, 18, 10)
      x += w + 26
    }
    // telegraph poles
    ctx.strokeStyle = ga(0.15, 0.9); ctx.lineWidth = 4
    for (const px of [W * 0.15, W * 0.5, W * 0.85]) {
      ctx.beginPath(); ctx.moveTo(px, H * 0.5); ctx.lineTo(px, H * 0.16); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(px - 28, H * 0.2); ctx.lineTo(px + 28, H * 0.2); ctx.stroke()
    }
    glow(ctx, W * (0.7 + rand() * 0.1), H * 0.42, 26, 0.9, 0.5)   // one far lamp
    figure(ctx, W * 0.32, H * 0.66, 70, 0.02)
    const mist = ctx.createLinearGradient(0, H * 0.66, 0, H)
    mist.addColorStop(0, ga(0.3, 0.18)); mist.addColorStop(1, ga(0.05, 0))
    ctx.fillStyle = mist; ctx.fillRect(0, H * 0.66, W, H * 0.34)
  },

  epilogue(ctx, rand) {
    // first light — the one scene allowed brightness
    const sky = ctx.createLinearGradient(0, 0, 0, H)
    sky.addColorStop(0, g(0.12)); sky.addColorStop(0.7, g(0.55)); sky.addColorStop(1, g(0.2))
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H)
    glow(ctx, W * 0.5, H * 0.72, 180, 0.95, 0.5)
    ctx.fillStyle = g(0.04)
    let x = -20
    while (x < W) { const w = 80 + rand() * 120, h = 60 + rand() * 130; ctx.fillRect(x, H * 0.72 - h, w, h); x += w + 12 }
    ctx.fillStyle = g(0.05); ctx.fillRect(0, H * 0.72, W, H * 0.28)
    figure(ctx, W * 0.5, H * 0.86, 130, 0.03)
  },
}

// ------------------------------------------------------------ the backdrop

let currentKind = null
let directorScenes = null   // { url } once a FLUX-capable Director is detected

/** Upgrade backdrops to Director FLUX stills when the local service has them. */
export function enableDirectorScenes(url) { directorScenes = { url } }

/** Crossfade the backdrop to a scene. Deterministic per (kind, seed). */
export function setScene(kind, eraId, seed = '') {
  const paint = painters[kind] ?? painters.street
  if (currentKind === kind + seed) return
  currentKind = kind + seed

  const canvas = document.createElement('canvas')
  canvas.width = W * DPR; canvas.height = H * DPR
  const ctx = canvas.getContext('2d')
  ctx.scale(DPR, DPR)
  const rand = mulberry32(hash(kind + '|' + seed))
  paint(ctx, rand)

  // brighter than the model-art defaults: backdrops must read through the drum
  const toned = duotone(canvas, eraId, { grain: 0.035, gain: 1.45, lift: 0.07, vignette: 0.38 })
  toned.className = 'backdrop-canvas'
  const holder = document.getElementById('backdrop')
  const old = [...holder.querySelectorAll('.backdrop-canvas')]
  holder.appendChild(toned)
  requestAnimationFrame(() => requestAnimationFrame(() => toned.classList.add('active')))
  setTimeout(() => old.forEach(el => el.remove()), 2800)
}
