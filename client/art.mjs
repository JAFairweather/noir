// art.mjs — era palettes and the duotone treatment (spec §7).
//
// The era IS a color: one signature tone over near-black drives UI chrome,
// the drum's focal tint, and image treatment alike. Palette constants mirror
// the era bibles (eras/*.md) — change them there first.
//
// duotone() is the deterministic post-process seam: grayscale → tone curve →
// duotone map → grain + vignette. Never ship raw model output (M4).

export const ERAS = {
  'berlin-1938': {
    label: 'Berlin 1938',
    accent: '#c39a56',            // sepia
    accentDim: '#6b5530',
    ink: '#0a0806',
    font: "'Special Elite', 'Courier New', monospace",
  },
  'paris-1954': {
    label: 'Paris 1954',
    accent: '#7da7c7',            // smoky blue
    accentDim: '#3d5a70',
    ink: '#06080a',
    font: "'Archivo', 'Helvetica Neue', sans-serif",
  },
  'neworleans-1968': {
    label: 'New Orleans 1968',
    accent: '#7fa06f',            // swamp green
    accentDim: '#42553a',
    ink: '#070a06',
    font: "'Zilla Slab', 'Georgia', serif",
  },
  'meridian-1849': {
    label: 'West Texas 1849',
    accent: '#e6e1d3',            // bone-white
    accentDim: '#8a867c',
    ink: '#080807',
    font: "'Special Elite', 'Courier New', monospace",
  },
}

export function applyEra(eraId) {
  const era = ERAS[eraId] ?? ERAS['berlin-1938']
  const root = document.documentElement
  root.style.setProperty('--accent', era.accent)
  root.style.setProperty('--accent-dim', era.accentDim)
  root.style.setProperty('--ink', era.ink)
  root.style.setProperty('--era-font', era.font)
  return era
}

/**
 * Deterministic duotone post-process for case imagery (M4 seam, working now).
 * Takes anything drawable (ImageBitmap, <img>, canvas), returns a canvas
 * mapped to the era's tone over near-black, with grain and vignette.
 */
export function duotone(source, eraId, { grain = 0.06, gain = 1, lift = 0, vignette = 0.55 } = {}) {
  const era = ERAS[eraId] ?? ERAS['berlin-1938']
  const [r2, g2, b2] = hex(era.accent)
  const [r1, g1, b1] = hex(era.ink)
  const canvas = document.createElement('canvas')
  canvas.width = source.width
  canvas.height = source.height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(source, 0, 0)
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    let y = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255
    y = y * y * (3 - 2 * y)                             // tone curve: crush + lift
    y = y * gain + lift                                 // exposure push (backdrops)
    const n = (Math.random() - 0.5) * grain             // grain
    const t = Math.min(1, Math.max(0, y + n))
    d[i] = r1 + (r2 - r1) * t
    d[i + 1] = g1 + (g2 - g1) * t
    d[i + 2] = b1 + (b2 - b1) * t
  }
  ctx.putImageData(img, 0, 0)
  // vignette
  const g = ctx.createRadialGradient(
    canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * 0.35,
    canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.72)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, `rgba(0,0,0,${vignette})`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  return canvas
}

const hex = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))

// ------------------------------------------------ §5.5 photo-detail overlay
//
// Photo-analysis puzzles: the ANSWER lives in the image. A scope that
// carries one declares `payload.photo`, and the client composites the
// print here — code-drawn marks and lettering, deterministic per
// (photo.id, seed) — never left to an image model's hand (spec §5.5, §7).
// Everything draws in grayscale before the duotone pass, so the print
// wears the era like the rest of the frame.

const pg = (v, a = 1) => `rgba(${Math.round(v * 255)},${Math.round(v * 255)},${Math.round(v * 255)},${a})`

function photoHash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
function photoRand(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Deterministic placement of the print on a W×H scene. Pure math —
 *  exported on its own so the smoke suite can prove determinism in Node,
 *  where no canvas exists. */
export function photoLayout(photo, seed, W = 960, H = 540) {
  const r = photoRand(photoHash(`photo|${photo?.id ?? ''}|${seed}`))
  // four hanging spots, all clear of the drum's focal band
  const slots = [[0.66, 0.12], [0.05, 0.12], [0.62, 0.5], [0.07, 0.48]]
  const [sx, sy] = slots[Math.floor(r() * slots.length) % slots.length]
  const w = W * (0.24 + r() * 0.05)
  return { x: sx * W + r() * 20, y: sy * H + r() * 14, w, h: w * 0.72, rot: (r() - 0.5) * 0.09 }
}

/** The detail vocabulary: each entry is the whole point of its print.
 *  `mark: 'chevrons'` — sergeant's stripes on the near sleeve.
 *  `text` + `style` — code-rendered lettering: 'stencil' on a panel,
 *  'mirror' for a sign caught in reflection, 'newsprint' for a headline
 *  fragment. `spot` lays the water damage where a face would be. */
function drawPhotoDetail(ctx, photo, iw, ih) {
  if (photo.mark === 'chevrons') {
    // the subject: quarter-turned into the light, face lost, sleeve held
    ctx.fillStyle = pg(0.03)
    ctx.beginPath(); ctx.ellipse(iw * 0.44, ih * 0.3, iw * 0.05, ih * 0.1, -0.1, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath()
    ctx.moveTo(iw * 0.28, ih)
    ctx.lineTo(iw * 0.3, ih * 0.5)
    ctx.quadraticCurveTo(iw * 0.44, ih * 0.38, iw * 0.6, ih * 0.48)
    ctx.lineTo(iw * 0.62, ih)
    ctx.closePath(); ctx.fill()
    // the near sleeve, upper arm turned toward the light
    ctx.save()
    ctx.translate(iw * 0.56, ih * 0.58); ctx.rotate(0.35)
    ctx.fillStyle = pg(0.1)
    ctx.fillRect(-iw * 0.05, -ih * 0.08, iw * 0.1, ih * 0.44)
    // three chevrons, point up — the detail that IS the answer
    ctx.strokeStyle = pg(0.82); ctx.lineWidth = Math.max(2, iw * 0.012)
    ctx.lineJoin = ctx.lineCap = 'round'
    for (let i = 0; i < 3; i++) {
      const cy = ih * 0.02 + i * ih * 0.08
      ctx.beginPath()
      ctx.moveTo(-iw * 0.034, cy + ih * 0.05)
      ctx.lineTo(0, cy)
      ctx.lineTo(iw * 0.034, cy + ih * 0.05)
      ctx.stroke()
    }
    ctx.restore()
  }
  if (photo.text) {
    const px = Math.max(8, Math.round(iw * 0.055))
    ctx.save()
    ctx.font = `bold ${px}px "Courier New", monospace`
    ctx.textAlign = 'center'
    if (photo.style === 'mirror') {             // a sign caught in reflection
      ctx.translate(iw * 0.24, ih * 0.3); ctx.scale(-1, 1)
      ctx.fillStyle = pg(0.7, 0.85)
      ctx.fillText(photo.text, 0, 0, iw * 0.42)
    } else if (photo.style === 'newsprint') {   // a headline fragment
      ctx.translate(iw * 0.26, ih * 0.74); ctx.rotate(-0.06)
      ctx.fillStyle = pg(0.8, 0.95)
      ctx.fillRect(-iw * 0.22, -px * 1.2, iw * 0.44, px * 1.9)
      ctx.fillStyle = pg(0.08)
      ctx.fillText(photo.text, 0, px * 0.3, iw * 0.4)
    } else {                                    // stencil on a door or panel
      ctx.translate(iw * 0.18, ih * 0.8)
      ctx.fillStyle = pg(0.16)
      ctx.fillRect(-iw * 0.15, -px * 1.4, iw * 0.3, px * 2.2)
      ctx.strokeStyle = pg(0.4, 0.8); ctx.lineWidth = 1
      ctx.strokeRect(-iw * 0.15, -px * 1.4, iw * 0.3, px * 2.2)
      ctx.fillStyle = pg(0.55)
      ctx.fillText(photo.text, 0, 0, iw * 0.26)
    }
    ctx.restore()
  }
  if (photo.spot) {                             // the water damage, over the face
    ctx.strokeStyle = pg(0.6, 0.5); ctx.lineWidth = 1.2
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.ellipse(iw * 0.44, ih * 0.3, iw * (0.05 + i * 0.028), ih * (0.08 + i * 0.05), 0.3, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.fillStyle = pg(0.5, 0.16)
    ctx.beginPath(); ctx.ellipse(iw * 0.44, ih * 0.3, iw * 0.1, ih * 0.16, 0.3, 0, Math.PI * 2); ctx.fill()
  }
}

/** Composite the puzzle print over a painted scene, pre-duotone. The ctx
 *  must already be scaled to the W×H painter space. */
export function compositePhoto(ctx, photo, seed, W = 960, H = 540) {
  if (!photo) return
  const L = photoLayout(photo, seed, W, H)
  const r = photoRand(photoHash(`grain|${photo.id ?? ''}|${seed}`))
  ctx.save()
  ctx.translate(L.x + L.w / 2, L.y + L.h / 2)
  ctx.rotate(L.rot)
  ctx.translate(-L.w / 2, -L.h / 2)
  // the print itself: shadow, paper border, dark emulsion
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(6, 8, L.w, L.h)
  ctx.fillStyle = pg(0.88)
  ctx.fillRect(0, 0, L.w, L.h)
  const bx = L.w * 0.045, by = L.w * 0.045
  const iw = L.w - bx * 2, ih = L.h - by - L.h * 0.16     // caption strip below
  ctx.save()
  ctx.beginPath(); ctx.rect(bx, by, iw, ih); ctx.clip()
  ctx.translate(bx, by)
  ctx.fillStyle = pg(0.07); ctx.fillRect(0, 0, iw, ih)    // night field
  const glow = ctx.createRadialGradient(iw * 0.62, ih * 0.28, 2, iw * 0.62, ih * 0.28, iw * 0.4)
  glow.addColorStop(0, pg(0.85, 0.9)); glow.addColorStop(1, pg(0.85, 0))
  ctx.fillStyle = glow; ctx.fillRect(0, 0, iw, ih)        // the one hard light
  drawPhotoDetail(ctx, photo, iw, ih)
  for (let i = 0; i < 60; i++) {                          // emulsion grain
    ctx.fillStyle = pg(r(), 0.05)
    ctx.fillRect(r() * iw, r() * ih, 1.5, 1.5)
  }
  ctx.restore()
  if (photo.caption) {                                    // typed by code, never a model
    ctx.fillStyle = pg(0.2)
    ctx.font = `${Math.max(9, Math.round(L.w * 0.038))}px "Courier New", monospace`
    ctx.textAlign = 'center'
    ctx.fillText(photo.caption, L.w / 2, L.h - L.h * 0.055, L.w * 0.9)
  }
  ctx.restore()
}
