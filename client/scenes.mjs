// scenes.mjs — procedural duotone backdrops (spec §6 imagery integration).
//
// Scenes are painted in-client: layered grayscale compositions — depth-
// stacked architecture, lamplight, weather — run through the same
// deterministic duotone post-process the FLUX art uses (art.mjs). The
// backdrop sits BEHIND the drum and drifts slowly (Ken Burns), honoring
// prefers-reduced-motion. Scene kind rides inside each scope's encrypted
// payload: the art is intel, same as the text.
//
// Deterministic per (kind, seed): the same dossier always shows the same
// night. When a FLUX-capable Director is present, its still crossfades in
// over the painting — same duotone, same era law.

import { ERAS, duotone } from './art.mjs'
import { buildLineScene, renderDrawOn, planMorph, renderMorph } from './linework.mjs'

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

// ------------------------------------------------------- grayscale helpers
// Luminance only — the duotone pass owns color. 0 = ink, 1 = era accent.

const g = (v) => `rgba(${Math.round(v * 255)},${Math.round(v * 255)},${Math.round(v * 255)},1)`
const ga = (v, a) => `rgba(${Math.round(v * 255)},${Math.round(v * 255)},${Math.round(v * 255)},${a})`

function sky(ctx, rand, top = 0.10, mid = 0.24, horizon = 0.6) {
  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, g(top + rand() * 0.03))
  grad.addColorStop(horizon, g(mid + rand() * 0.05))
  grad.addColorStop(1, g(0.05))
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)
  // thin cloud bands
  for (let i = 0; i < 4; i++) {
    const y = rand() * H * horizon * 0.8
    ctx.fillStyle = ga(mid + 0.1, 0.05 + rand() * 0.05)
    ctx.fillRect(0, y, W, 6 + rand() * 18)
  }
}

function glow(ctx, x, y, r, v = 0.9, a = 0.5) {
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r)
  grad.addColorStop(0, ga(v, a))
  grad.addColorStop(0.5, ga(v, a * 0.35))
  grad.addColorStop(1, ga(v, 0))
  ctx.fillStyle = grad
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
}

/** A city block: silhouette with a proper grid of windows, some lit. */
function building(ctx, rand, x, w, hgt, baseY, tone = 0.03, litChance = 0.16) {
  ctx.fillStyle = g(tone)
  ctx.fillRect(x, baseY - hgt, w, hgt)
  // roofline detail: parapet or chimneys
  if (rand() < 0.6) {
    for (let cx = x + 6; cx < x + w - 8; cx += 24 + rand() * 30)
      if (rand() < 0.4) ctx.fillRect(cx, baseY - hgt - 8 - rand() * 10, 7, 12)
  }
  // window grid
  const cols = Math.max(2, Math.floor(w / 18))
  const rows = Math.max(2, Math.floor(hgt / 26))
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const wx = x + 6 + c * ((w - 12) / cols)
      const wy = baseY - hgt + 8 + r * ((hgt - 16) / rows)
      if (rand() < litChance) {
        ctx.fillStyle = ga(0.75 + rand() * 0.2, 0.55)
        ctx.fillRect(wx, wy, 5, 8)
        if (rand() < 0.3) glow(ctx, wx + 2, wy + 4, 9, 0.85, 0.18)
      } else if (rand() < 0.5) {
        ctx.fillStyle = ga(tone + 0.05, 0.8)
        ctx.fillRect(wx, wy, 5, 8)
      }
      ctx.fillStyle = g(tone)
    }
  }
}

/** A street lamp: pole, arm, head, cone, pavement pool. */
function lampPost(ctx, x, baseY, hgt, spread = 90, v = 0.9) {
  ctx.strokeStyle = ga(0.02, 0.95)
  ctx.lineWidth = 3
  ctx.beginPath(); ctx.moveTo(x, baseY); ctx.lineTo(x, baseY - hgt); ctx.stroke()
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(x, baseY - hgt); ctx.quadraticCurveTo(x + 14, baseY - hgt - 2, x + 18, baseY - hgt + 6); ctx.stroke()
  const lx = x + 18, ly = baseY - hgt + 9
  // cone of light
  ctx.fillStyle = ga(0.7, 0.10)
  ctx.beginPath(); ctx.moveTo(lx, ly)
  ctx.lineTo(lx - spread * 0.7, baseY + 4); ctx.lineTo(lx + spread * 0.7, baseY + 4)
  ctx.closePath(); ctx.fill()
  glow(ctx, lx, ly, 16, v, 0.85)
  glow(ctx, lx, baseY, spread * 0.55, 0.6, 0.14)                  // pavement pool
}

function figure(ctx, x, baseY, h, v = 0.03, brim = true) {
  ctx.fillStyle = g(v)
  if (brim) {                                                      // hat with brim
    ctx.fillRect(x - h * 0.13, baseY - h * 0.97, h * 0.26, h * 0.05)
    ctx.fillRect(x - h * 0.08, baseY - h * 1.06, h * 0.16, h * 0.10)
  } else {
    ctx.beginPath(); ctx.ellipse(x, baseY - h * 0.98, h * 0.08, h * 0.09, 0, 0, Math.PI * 2); ctx.fill()
  }
  ctx.beginPath()                                                  // coat, flared
  ctx.moveTo(x - h * 0.17, baseY)
  ctx.lineTo(x - h * 0.10, baseY - h * 0.55)
  ctx.lineTo(x - h * 0.11, baseY - h * 0.92)
  ctx.lineTo(x + h * 0.11, baseY - h * 0.92)
  ctx.lineTo(x + h * 0.10, baseY - h * 0.55)
  ctx.lineTo(x + h * 0.17, baseY)
  ctx.closePath(); ctx.fill()
}

function rain(ctx, rand, n = 110, v = 0.75) {
  ctx.strokeStyle = ga(v, 0.06)
  ctx.lineWidth = 1
  for (let i = 0; i < n; i++) {
    const x = rand() * W, y = rand() * H, len = 16 + rand() * 30
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4, y + len); ctx.stroke()
  }
}

function wetSheen(ctx, groundY, v = 0.32, a = 0.22) {
  const wet = ctx.createLinearGradient(0, groundY, 0, H)
  wet.addColorStop(0, ga(v, a)); wet.addColorStop(1, ga(0.02, 0))
  ctx.fillStyle = wet; ctx.fillRect(0, groundY, W, H - groundY)
}

/** Vertical streak reflection under a light source on wet ground. */
function reflection(ctx, x, groundY, hgt, v = 0.8, a = 0.12, w = 6) {
  const grad = ctx.createLinearGradient(0, groundY, 0, groundY + hgt)
  grad.addColorStop(0, ga(v, a)); grad.addColorStop(1, ga(v, 0))
  ctx.fillStyle = grad
  ctx.fillRect(x - w / 2, groundY, w, hgt)
}

function smoke(ctx, rand, x, y, n = 5, v = 0.5) {
  for (let i = 0; i < n; i++) {
    const t = i / n
    glow(ctx, x + Math.sin(t * 6 + rand() * 2) * 14 * t * 3, y - t * 90, 8 + t * 22, v, 0.05)
  }
}

// -------------------------------------------------------------- painters

const painters = {
  street(ctx, rand) {
    sky(ctx, rand, 0.08, 0.2, 0.55)
    const ground = H * 0.66
    // far row, dim; near row, dark — depth by tone
    let x = -30
    while (x < W) { const w = 70 + rand() * 120; building(ctx, rand, x, w, 90 + rand() * 140, ground - 26, 0.09, 0.10); x += w + 4 }
    x = -20
    while (x < W) { const w = 90 + rand() * 150; building(ctx, rand, x, w, 150 + rand() * 230, ground, 0.03, 0.16); x += w + 10 + rand() * 26 }
    wetSheen(ctx, ground)
    const l1 = W * (0.2 + rand() * 0.1), l2 = W * (0.66 + rand() * 0.12)
    lampPost(ctx, l1, ground + 30, 150, 110)
    lampPost(ctx, l2, ground + 22, 130, 95)
    reflection(ctx, l1 + 18, ground + 30, 90)
    reflection(ctx, l2 + 18, ground + 22, 80)
    figure(ctx, W * (0.42 + rand() * 0.14), ground + 40, 150)
    if (rand() < 0.5) figure(ctx, W * 0.82, ground + 34, 110, 0.05)
    smoke(ctx, rand, W * 0.12, ground - 240, 5, 0.4)               // a chimney somewhere
    rain(ctx, rand)
  },

  station(ctx, rand) {
    sky(ctx, rand, 0.07, 0.16, 0.5)
    // arched roof: ribs + glazing lattice
    ctx.strokeStyle = ga(0.45, 0.6); ctx.lineWidth = 6
    ctx.beginPath(); ctx.ellipse(W / 2, H * 0.98, W * 0.56, H * 0.88, 0, Math.PI, 2 * Math.PI); ctx.stroke()
    ctx.lineWidth = 1.6
    for (let i = 1; i < 8; i++) {
      ctx.globalAlpha = 0.5
      ctx.beginPath(); ctx.ellipse(W / 2, H * 0.98, W * 0.56 * (i / 8), H * 0.88 * (i / 8), 0, Math.PI, 2 * Math.PI); ctx.stroke()
      ctx.globalAlpha = 1
    }
    for (let a = 0.15; a < Math.PI; a += 0.22) {                    // radial glazing bars
      ctx.globalAlpha = 0.3
      ctx.beginPath(); ctx.moveTo(W / 2, H * 0.98)
      ctx.lineTo(W / 2 + Math.cos(Math.PI + a) * W * 0.56, H * 0.98 + Math.sin(Math.PI + a) * H * 0.88)
      ctx.stroke(); ctx.globalAlpha = 1
    }
    // light shafts from the roof
    for (const sx of [W * 0.35, W * 0.6]) {
      ctx.fillStyle = ga(0.6, 0.05)
      ctx.beginPath(); ctx.moveTo(sx, H * 0.16); ctx.lineTo(sx - 60, H * 0.9); ctx.lineTo(sx + 90, H * 0.9); ctx.closePath(); ctx.fill()
    }
    // platform, tracks with ties, buffer
    ctx.fillStyle = g(0.10); ctx.fillRect(0, H * 0.78, W, H * 0.22)
    ctx.strokeStyle = ga(0.55, 0.5); ctx.lineWidth = 2.5
    for (const off of [-46, -14, 16, 52]) {
      ctx.beginPath(); ctx.moveTo(W / 2 + off * 6, H); ctx.lineTo(W / 2 + off, H * 0.56); ctx.stroke()
    }
    ctx.strokeStyle = ga(0.3, 0.4); ctx.lineWidth = 2
    for (let i = 0; i < 10; i++) {
      const t = i / 10, y = H - t * (H * 0.44), half = (1 - t * 0.82) * 190
      ctx.beginPath(); ctx.moveTo(W / 2 - half, y); ctx.lineTo(W / 2 + half, y); ctx.stroke()
    }
    // hanging clock
    ctx.strokeStyle = ga(0.5, 0.8); ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(W * 0.72, H * 0.1); ctx.lineTo(W * 0.72, H * 0.2); ctx.stroke()
    ctx.fillStyle = g(0.85); ctx.beginPath(); ctx.arc(W * 0.72, H * 0.24, 15, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = g(0.1); ctx.beginPath(); ctx.moveTo(W * 0.72, H * 0.24); ctx.lineTo(W * 0.72, H * 0.215); ctx.moveTo(W * 0.72, H * 0.24); ctx.lineTo(W * 0.735, H * 0.245); ctx.stroke()
    // platform lamps receding + steam
    for (let i = 0; i < 6; i++) {
      const t = i / 6
      glow(ctx, W * (0.3 + t * 0.38), H * (0.52 + t * 0.07), 9 + 16 * (1 - t), 0.95, 0.65)
    }
    smoke(ctx, rand, W * 0.5, H * 0.72, 7, 0.55)
    figure(ctx, W * 0.62, H * 0.84, 100)
    ctx.fillStyle = g(0.02)
    ctx.fillRect(W * 0.615, H * 0.835, 16, 8)                       // the case at his feet
  },

  cafe(ctx, rand) {
    ctx.fillStyle = g(0.03); ctx.fillRect(0, 0, W, H)               // night facade
    // masonry courses
    ctx.strokeStyle = ga(0.08, 0.6); ctx.lineWidth = 1
    for (let y = 12; y < H * 0.7; y += 16) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
    const ground = H * 0.82
    const winTop = H * 0.3
    // two tall windows: warm but held back — the duotone gain does the rest
    for (const [wx, ww] of [[W * 0.12, W * 0.3], [W * 0.55, W * 0.3]]) {
      const warm = ctx.createLinearGradient(wx, winTop, wx, ground - 20)
      warm.addColorStop(0, ga(0.6, 0.9)); warm.addColorStop(1, ga(0.34, 0.85))
      ctx.fillStyle = warm
      ctx.fillRect(wx, winTop, ww, ground - 30 - winTop)
      // hanging pendant lamps inside
      for (const t of [0.28, 0.72]) {
        ctx.fillStyle = g(0.06)
        ctx.fillRect(wx + ww * t - 1, winTop, 2, 26)
        glow(ctx, wx + ww * t, winTop + 32, 15, 0.95, 0.55)
      }
      // seated silhouettes: head + shoulders over a table line
      const tableY = ground - 80
      for (let p = 0; p < 2 + Math.floor(rand() * 2); p++) {
        const px = wx + 24 + rand() * (ww - 48)
        ctx.fillStyle = g(0.05)
        ctx.beginPath(); ctx.arc(px, tableY - 26, 9, 0, Math.PI * 2); ctx.fill()
        ctx.fillRect(px - 13, tableY - 18, 26, 18)
      }
      ctx.fillStyle = g(0.05)
      ctx.fillRect(wx, tableY, ww, 3)                               // table line
      // pane grid: vertical thirds + two rails
      ctx.fillStyle = g(0.03)
      for (const t of [1 / 3, 2 / 3]) ctx.fillRect(wx + ww * t - 3, winTop, 6, ground - 30 - winTop)
      ctx.fillRect(wx, H * 0.45, ww, 5)
      ctx.fillRect(wx, H * 0.62, ww, 4)
      ctx.strokeStyle = ga(0.12, 0.9); ctx.lineWidth = 4
      ctx.strokeRect(wx - 2, winTop - 2, ww + 4, ground - 26 - winTop) // frame
      glow(ctx, wx + ww / 2, ground + 6, ww * 0.42, 0.55, 0.14)     // spill on pavement
      reflection(ctx, wx + ww * 0.3, ground, 70, 0.6, 0.10, 10)
      reflection(ctx, wx + ww * 0.7, ground, 60, 0.6, 0.08, 8)
    }
    // the door between them, lit transom over dark wood
    const dx = W * 0.455, dw = W * 0.06
    ctx.fillStyle = ga(0.5, 0.8); ctx.fillRect(dx, winTop, dw, H * 0.06)
    ctx.fillStyle = g(0.07); ctx.fillRect(dx, winTop + H * 0.065, dw, ground - 30 - winTop - H * 0.065)
    ctx.strokeStyle = ga(0.14, 0.9); ctx.lineWidth = 2
    ctx.strokeRect(dx, winTop, dw, ground - 30 - winTop)
    // striped awnings, fully in frame now
    for (const [wx, ww] of [[W * 0.10, W * 0.34], [W * 0.53, W * 0.34]]) {
      for (let i = 0; i < 9; i++) {
        ctx.fillStyle = i % 2 ? g(0.05) : g(0.18)
        ctx.beginPath()
        ctx.moveTo(wx + (i / 9) * ww, H * 0.19)
        ctx.lineTo(wx + ((i + 1) / 9) * ww, H * 0.19)
        ctx.lineTo(wx + ((i + 1) / 9) * ww - 8, H * 0.295)
        ctx.lineTo(wx + (i / 9) * ww - 8, H * 0.295)
        ctx.closePath(); ctx.fill()
      }
      ctx.fillStyle = g(0.12)
      ctx.fillRect(wx - 8, H * 0.29, ww + 8, 4)                     // awning lip
    }
    // hanging sign over the door, lit from below
    ctx.strokeStyle = ga(0.4, 0.8); ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(W * 0.485, H * 0.10); ctx.lineTo(W * 0.485, H * 0.155); ctx.stroke()
    ctx.fillStyle = g(0.14); ctx.fillRect(W * 0.45, H * 0.155, W * 0.07, H * 0.075)
    ctx.strokeStyle = ga(0.5, 0.7); ctx.strokeRect(W * 0.45, H * 0.155, W * 0.07, H * 0.075)
    glow(ctx, W * 0.485, H * 0.23, 22, 0.8, 0.2)
    wetSheen(ctx, ground, 0.25, 0.2)
    figure(ctx, W * 0.78, ground + 34, 140)                         // someone outside, watching
    rain(ctx, rand, 60)
  },

  office(ctx, rand) {
    ctx.fillStyle = g(0.05); ctx.fillRect(0, 0, W, H)
    // frosted-glass door, left wall — lit from the corridor, a shape behind it
    const dx = W * 0.06, dw = W * 0.15, dy = H * 0.14, dh = H * 0.56
    ctx.fillStyle = g(0.08); ctx.fillRect(dx - 10, dy - 10, dw + 20, dh + 20)  // frame
    const frost = ctx.createLinearGradient(dx, dy, dx, dy + dh * 0.62)
    frost.addColorStop(0, ga(0.5, 0.85)); frost.addColorStop(1, ga(0.36, 0.8))
    ctx.fillStyle = frost; ctx.fillRect(dx, dy, dw, dh * 0.62)       // frosted pane
    ctx.fillStyle = g(0.07); ctx.fillRect(dx, dy + dh * 0.62, dw, dh * 0.38)  // wood below
    ctx.fillStyle = ga(0.06, 0.55)                                    // caller through the glass
    ctx.beginPath(); ctx.ellipse(dx + dw * 0.52, dy + dh * 0.2, dw * 0.11, dh * 0.075, 0, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath()
    ctx.moveTo(dx + dw * 0.24, dy + dh * 0.62)
    ctx.quadraticCurveTo(dx + dw * 0.52, dy + dh * 0.24, dx + dw * 0.8, dy + dh * 0.62)
    ctx.closePath(); ctx.fill()
    ctx.fillStyle = g(0.04)                                           // lettering band on the pane
    ctx.fillRect(dx + dw * 0.14, dy + dh * 0.36, dw * 0.72, 7)
    ctx.fillRect(dx + dw * 0.22, dy + dh * 0.44, dw * 0.56, 5)
    glow(ctx, dx + dw / 2, dy + dh * 0.3, dw * 0.7, 0.5, 0.12)       // light bleeding into the room
    ctx.fillStyle = g(0.09)
    ctx.beginPath(); ctx.arc(dx + dw - 9, dy + dh * 0.72, 4, 0, Math.PI * 2); ctx.fill() // knob
    // window with city glow, cut by blinds
    const wx = W * 0.58, ww = W * 0.34, wy = H * 0.1, wh = H * 0.5
    const city = ctx.createLinearGradient(wx, wy, wx, wy + wh)
    city.addColorStop(0, g(0.14)); city.addColorStop(1, g(0.34))
    ctx.fillStyle = city; ctx.fillRect(wx, wy, ww, wh)
    for (let i = 0; i < 5; i++) {                                    // skyline in the window
      const bx = wx + rand() * (ww - 30)
      ctx.fillStyle = g(0.07)
      ctx.fillRect(bx, wy + wh - 40 - rand() * 60, 20 + rand() * 26, 100)
      if (rand() < 0.7) { ctx.fillStyle = ga(0.6, 0.5); ctx.fillRect(bx + 4 + rand() * 12, wy + wh - 30 - rand() * 50, 3, 4) }
    }
    ctx.fillStyle = g(0.05)
    for (let i = 0; i < 11; i++) ctx.fillRect(wx, wy + i * (wh / 11), ww, wh / 22)   // blinds
    ctx.fillStyle = g(0.08); ctx.fillRect(wx - 8, wy - 8, ww + 16, 8); ctx.fillRect(wx - 8, wy, 8, wh + 8); ctx.fillRect(wx + ww, wy, 8, wh + 8)
    // blind-slat light striping the wall and floor
    ctx.save(); ctx.translate(W * 0.2, 0); ctx.rotate(-0.05)
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = ga(0.5, 0.13 + rand() * 0.05)
      ctx.fillRect(-W * 0.3, H * 0.1 + i * 32, W * 0.75, 11)
    }
    ctx.restore()
    // filing cabinet under the window, half in shadow
    ctx.fillStyle = g(0.09); ctx.fillRect(W * 0.86, H * 0.6, W * 0.09, H * 0.24)
    ctx.strokeStyle = ga(0.2, 0.8); ctx.lineWidth = 1.5
    for (let i = 0; i < 3; i++) ctx.strokeRect(W * 0.87, H * 0.62 + i * H * 0.07, W * 0.07, H * 0.055)
    // desk plane
    ctx.fillStyle = g(0.08); ctx.fillRect(0, H * 0.68, W, H * 0.32)
    ctx.fillStyle = g(0.12); ctx.fillRect(W * 0.14, H * 0.66, W * 0.5, 8)
    // the empty chair, back to us
    ctx.fillStyle = g(0.04)
    ctx.fillRect(W * 0.52, H * 0.5, W * 0.09, H * 0.17)
    ctx.beginPath(); ctx.ellipse(W * 0.565, H * 0.5, W * 0.045, 10, 0, Math.PI, 2 * Math.PI); ctx.fill()
    ctx.fillRect(W * 0.555, H * 0.67, W * 0.02, H * 0.1)
    // banker's lamp: shade, stem, pool of light
    const lx = W * 0.3, ly = H * 0.52
    ctx.fillStyle = g(0.04)
    ctx.beginPath(); ctx.moveTo(lx - 34, ly); ctx.lineTo(lx + 34, ly); ctx.lineTo(lx + 22, ly - 16); ctx.lineTo(lx - 22, ly - 16); ctx.closePath(); ctx.fill()
    ctx.fillRect(lx - 3, ly, 6, H * 0.66 - ly)
    glow(ctx, lx, ly + 8, 26, 0.95, 0.7)
    ctx.fillStyle = ga(0.85, 0.13)
    ctx.beginPath(); ctx.moveTo(lx, ly + 4); ctx.lineTo(lx - 130, H * 0.74); ctx.lineTo(lx + 130, H * 0.74); ctx.closePath(); ctx.fill()
    glow(ctx, lx, H * 0.7, 130, 0.8, 0.22)
    // typewriter in the pool: dark body, lamplit top edges
    const tx = lx + 60, ty = H * 0.615
    ctx.fillStyle = g(0.02)
    ctx.fillRect(tx, ty, 74, 28)
    ctx.fillRect(tx + 10, ty - 12, 54, 14)
    ctx.strokeStyle = ga(0.55, 0.7); ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + 74, ty); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(tx + 10, ty - 12); ctx.lineTo(tx + 64, ty - 12); ctx.stroke()
    ctx.fillStyle = ga(0.7, 0.5)                                      // the page in the platen
    ctx.fillRect(tx + 26, ty - 28, 24, 17)
    // papers in the pool
    ctx.fillStyle = ga(0.8, 0.55)
    ctx.save(); ctx.translate(lx - 40, H * 0.685); ctx.rotate(-0.07)
    ctx.fillRect(0, 0, 74, 50); ctx.rotate(0.12); ctx.fillRect(30, -4, 74, 50)
    ctx.restore()
    ctx.strokeStyle = ga(0.2, 0.7); ctx.lineWidth = 1
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(lx - 32, H * 0.7 + i * 8); ctx.lineTo(lx + 20, H * 0.7 + i * 8); ctx.stroke() }
    smoke(ctx, rand, lx + 165, H * 0.6, 6, 0.45)                     // ashtray wisp
  },

  yard(ctx, rand) {
    sky(ctx, rand, 0.09, 0.2, 0.55)
    const ground = H * 0.72
    // distant gasworks / crane
    ctx.strokeStyle = ga(0.12, 0.9); ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(W * 0.86, ground - 10); ctx.lineTo(W * 0.86, H * 0.2); ctx.lineTo(W * 0.7, H * 0.26); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(W * 0.7, H * 0.26); ctx.lineTo(W * 0.7, H * 0.33); ctx.stroke()
    // far siding first — a dimmer rank of cars behind the near one
    let fx = -50
    while (fx < W) {
      const w = 130 + rand() * 50
      ctx.fillStyle = g(0.075); ctx.fillRect(fx, ground - 132, w, 46)
      fx += w + 12
    }
    // boxcars: doors, ladders, wheels
    let x = -30
    while (x < W * 0.9) {
      const w = 170 + rand() * 70, y = ground - 92
      const body = 0.045 + rand() * 0.02
      ctx.fillStyle = g(body); ctx.fillRect(x, y, w, 74)
      ctx.strokeStyle = ga(0.3, 0.5); ctx.lineWidth = 2               // moonlit roof edge
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.stroke()
      ctx.fillStyle = g(0.03); ctx.fillRect(x + w * 0.38, y + 6, w * 0.24, 62)      // door
      ctx.strokeStyle = ga(0.14, 0.9); ctx.lineWidth = 2
      ctx.strokeRect(x + 6, y + 6, w - 12, 62)
      ctx.beginPath(); ctx.moveTo(x + 14, y + 6); ctx.lineTo(x + 14, y + 68); ctx.stroke() // ladder
      for (let ry = y + 14; ry < y + 66; ry += 10) { ctx.beginPath(); ctx.moveTo(x + 10, ry); ctx.lineTo(x + 18, ry); ctx.stroke() }
      for (const wxx of [x + 30, x + 48, x + w - 48, x + w - 30]) {                 // wheels
        ctx.fillStyle = g(0.02); ctx.beginPath(); ctx.arc(wxx, ground - 8, 9, 0, Math.PI * 2); ctx.fill()
      }
      x += w + 22
    }
    // rails with ties, converging
    ctx.strokeStyle = ga(0.5, 0.55); ctx.lineWidth = 2.5
    ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(W * 0.42, ground - 4); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(W * 0.3, H); ctx.lineTo(W * 0.5, ground - 4); ctx.stroke()
    ctx.strokeStyle = ga(0.22, 0.6); ctx.lineWidth = 3
    for (let i = 0; i < 9; i++) {
      const t = i / 9, y = H - t * (H - ground + 4)
      const x1 = t * W * 0.42, x2 = W * 0.3 + t * (W * 0.2)
      ctx.beginPath(); ctx.moveTo(x1 - 14 * (1 - t), y); ctx.lineTo(x2 + 14 * (1 - t), y); ctx.stroke()
    }
    // signal lamp on a pole, one bright eye
    ctx.strokeStyle = ga(0.15, 1); ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(W * 0.62, ground); ctx.lineTo(W * 0.62, H * 0.34); ctx.stroke()
    glow(ctx, W * 0.62, H * 0.36, 12, 0.98, 0.9)
    // mist bands + walker
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = ga(0.3, 0.06 + rand() * 0.05)
      ctx.fillRect(0, ground - 20 - i * 26, W, 16 + rand() * 10)
    }
    figure(ctx, W * 0.34, ground + 30, 90, 0.02)
    wetSheen(ctx, ground + 10, 0.2, 0.12)
  },

  epilogue(ctx, rand) {
    // first light — the one scene allowed brightness
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, g(0.14)); grad.addColorStop(0.55, g(0.5)); grad.addColorStop(0.75, g(0.68)); grad.addColorStop(1, g(0.2))
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H)
    glow(ctx, W * 0.5, H * 0.66, 220, 0.98, 0.5)
    // horizontal light bands
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = ga(0.85, 0.07)
      ctx.fillRect(0, H * (0.5 + i * 0.045), W, 4 + i * 2)
    }
    // rooftop line with chimneys and wires
    const ground = H * 0.72
    let x = -20
    while (x < W) {
      const w = 70 + rand() * 110, hgt = 60 + rand() * 120
      ctx.fillStyle = g(0.04); ctx.fillRect(x, ground - hgt, w, hgt)
      if (rand() < 0.6) ctx.fillRect(x + 10 + rand() * (w - 26), ground - hgt - 14, 9, 16)
      if (rand() < 0.3) {                                            // aerial
        ctx.strokeStyle = ga(0.1, 1); ctx.lineWidth = 1.5
        const ax = x + 16 + rand() * (w - 30)
        ctx.beginPath(); ctx.moveTo(ax, ground - hgt); ctx.lineTo(ax, ground - hgt - 26); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(ax - 8, ground - hgt - 20); ctx.lineTo(ax + 8, ground - hgt - 20); ctx.stroke()
      }
      x += w + 8
    }
    ctx.fillStyle = g(0.06); ctx.fillRect(0, ground, W, H - ground)
    // birds, few, far
    ctx.strokeStyle = ga(0.15, 0.9); ctx.lineWidth = 1.5
    for (let i = 0; i < 4; i++) {
      const bx = W * (0.3 + rand() * 0.5), by = H * (0.16 + rand() * 0.2)
      ctx.beginPath(); ctx.moveTo(bx - 5, by); ctx.quadraticCurveTo(bx, by - 4, bx + 0.5, by)
      ctx.quadraticCurveTo(bx + 1, by - 4, bx + 6, by); ctx.stroke()
    }
    figure(ctx, W * 0.5, ground + 26, 130, 0.03)
    ctx.strokeStyle = ga(0.08, 1); ctx.lineWidth = 2                  // the railing he leans on
    ctx.beginPath(); ctx.moveTo(W * 0.3, ground + 26); ctx.lineTo(W * 0.7, ground + 26); ctx.stroke()
  },
}

/** Render a scene to a canvas (exported for the dev gallery + tests). */
// ------------------------------------------------- era-specific painters
//
// The generic set above is the Berlin grammar — trainshed, Kaffeehaus,
// bureau, Güterbahnhof. Each era overrides the kinds where its city
// diverges: New Orleans is galleries and iron lace, the wharf and the
// streetcar, a PI's door with the trade etched backwards on the glass.
// Lookup: eraPainters[era][kind], falling back to the generic painter.

/** Wrought-iron gallery railing: rails, balusters, scroll arcs. */
function ironLace(ctx, x, y, w, h = 24, v = 0.14, a = 0.9) {
  ctx.strokeStyle = ga(v, a); ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x + w, y + h); ctx.stroke()
  ctx.lineWidth = 1.2
  for (let bx = x; bx <= x + w; bx += 9) {
    ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(bx, y + h); ctx.stroke()
  }
  for (let bx = x; bx + 18 <= x + w; bx += 18) {                    // scrollwork
    ctx.beginPath(); ctx.arc(bx + 9, y + h * 0.45, 5.5, 0, Math.PI, false); ctx.stroke()
    ctx.beginPath(); ctx.arc(bx + 9, y + h * 0.6, 5.5, Math.PI, 2 * Math.PI, false); ctx.stroke()
  }
}

/** Spanish moss: slow ragged strands off a branch point. */
function moss(ctx, rand, x, y, n = 5, len = 40, v = 0.12) {
  ctx.strokeStyle = ga(v, 0.8); ctx.lineWidth = 1.4
  for (let i = 0; i < n; i++) {
    const sx = x + (rand() - 0.5) * 26, sl = len * (0.5 + rand() * 0.8)
    ctx.beginPath(); ctx.moveTo(sx, y)
    ctx.quadraticCurveTo(sx + (rand() - 0.5) * 10, y + sl * 0.5, sx + (rand() - 0.5) * 8, y + sl)
    ctx.stroke()
  }
}

const eraPainters = {

  'berlin-1938': {
    // the Ku'damm: grand facades, tram wires, a Litfaßsäule with its posters
    street(ctx, rand) {
      sky(ctx, rand, 0.08, 0.2, 0.55)
      const ground = H * 0.66
      let x = -30
      while (x < W) { const w = 80 + rand() * 110; building(ctx, rand, x, w, 100 + rand() * 130, ground - 26, 0.09, 0.08); x += w + 4 }
      x = -20
      while (x < W) {                                                // grand facades
        const w = 150 + rand() * 130, hgt = 200 + rand() * 180
        building(ctx, rand, x, w, hgt, ground, 0.04, 0.14)
        ctx.strokeStyle = ga(0.12, 0.8); ctx.lineWidth = 1.5         // cornice lines
        for (const fy of [0.3, 0.55, 0.8]) {
          ctx.beginPath(); ctx.moveTo(x, ground - hgt * fy); ctx.lineTo(x + w, ground - hgt * fy); ctx.stroke()
        }
        ctx.fillStyle = ga(0.5, 0.35)                                 // lit shopfront band
        ctx.fillRect(x + 8, ground - 34, w - 16, 26)
        ctx.fillStyle = g(0.03)
        for (let sx = x + 8; sx < x + w - 16; sx += 34) ctx.fillRect(sx + 26, ground - 34, 8, 26)
        x += w + 12 + rand() * 20
      }
      // catenary wires + hanging lamps over the roadway
      ctx.strokeStyle = ga(0.2, 0.7); ctx.lineWidth = 1
      for (const t of [0.3, 0.55, 0.8]) {
        ctx.beginPath(); ctx.moveTo(0, H * (0.34 + t * 0.06)); ctx.lineTo(W, H * (0.3 + t * 0.08)); ctx.stroke()
        glow(ctx, W * t, H * (0.33 + t * 0.07), 10, 0.9, 0.5)
      }
      // tram rails, wet
      wetSheen(ctx, ground)
      ctx.strokeStyle = ga(0.5, 0.5); ctx.lineWidth = 2.5
      for (const off of [0, 26, 90, 116]) {
        ctx.beginPath(); ctx.moveTo(0, ground + 70 + off); ctx.lineTo(W, ground + 40 + off * 0.7); ctx.stroke()
      }
      // the Litfaßsäule: advertising column, dome cap, layered posters
      const cx = W * 0.2, ch = 155, cw = 46
      ctx.fillStyle = g(0.06); ctx.fillRect(cx - cw / 2, ground + 26 - ch, cw, ch)
      ctx.beginPath(); ctx.ellipse(cx, ground + 26 - ch, cw / 2, 12, 0, Math.PI, 2 * Math.PI); ctx.fill()
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = ga(0.45 + rand() * 0.2, 0.5)
        ctx.fillRect(cx - cw / 2 + 5 + rand() * 8, ground + 26 - ch + 18 + i * 32, 22 + rand() * 10, 22)
      }
      // a tram down the avenue, windows lit
      const tx = W * 0.76, ty = ground - 16
      ctx.fillStyle = g(0.05); ctx.fillRect(tx, ty - 44, 128, 46)
      ctx.fillStyle = ga(0.7, 0.6)
      for (let i = 0; i < 6; i++) ctx.fillRect(tx + 8 + i * 20, ty - 36, 13, 18)
      ctx.strokeStyle = ga(0.2, 0.9); ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(tx + 64, ty - 44); ctx.lineTo(tx + 80, ty - 70); ctx.stroke()
      glow(ctx, tx - 4, ty - 20, 10, 0.95, 0.5)                       // headlamp
      lampPost(ctx, W * 0.42, ground + 30, 150, 110)
      reflection(ctx, W * 0.42 + 18, ground + 30, 90)
      figure(ctx, W * 0.55, ground + 40, 150)
      figure(ctx, W * 0.61, ground + 40, 140, 0.05)
      rain(ctx, rand)
    },

    // dawn with the Funkturm on the skyline
    epilogue(ctx, rand) {
      painters.epilogue(ctx, rand)
      const bx = W * 0.8, top = H * 0.14, base = H * 0.72
      ctx.strokeStyle = ga(0.1, 0.95); ctx.lineWidth = 2.5
      ctx.beginPath(); ctx.moveTo(bx - 34, base); ctx.lineTo(bx - 4, top + 20); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(bx + 34, base); ctx.lineTo(bx + 4, top + 20); ctx.stroke()
      ctx.lineWidth = 1.3
      for (let i = 0; i < 7; i++) {                                   // lattice
        const t = i / 7, half = 34 * (1 - t * 0.85), y = base - t * (base - top - 20)
        ctx.beginPath(); ctx.moveTo(bx - half, y); ctx.lineTo(bx + half * 0.6, y - 22); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(bx + half, y); ctx.lineTo(bx - half * 0.6, y - 22); ctx.stroke()
      }
      ctx.fillStyle = g(0.08)
      ctx.fillRect(bx - 17, H * 0.42, 34, 10)                         // restaurant deck
      ctx.fillRect(bx - 9, top + 12, 18, 9)                           // observation deck
      ctx.strokeStyle = ga(0.1, 0.95); ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(bx, top + 12); ctx.lineTo(bx, top - 14); ctx.stroke()
    },
  },

  'neworleans-1968': {
    // the Quarter: galleries on posts, iron lace, gas lamps, a neon spill
    street(ctx, rand) {
      sky(ctx, rand, 0.1, 0.22, 0.5)
      const ground = H * 0.7
      // far neon glow down the street
      glow(ctx, W * 0.92, ground - 60, 130, 0.8, 0.2)
      ctx.fillStyle = ga(0.85, 0.7); ctx.fillRect(W * 0.9, ground - 150, 10, 74) // the sign itself
      glow(ctx, W * 0.905, ground - 112, 30, 0.95, 0.5)
      // row of two-story Creole facades
      let x = -20
      while (x < W * 0.88) {
        const w = 120 + rand() * 110, hgt = H * (0.36 + rand() * 0.08)
        ctx.fillStyle = g(0.045 + rand() * 0.015); ctx.fillRect(x, ground - hgt, w, hgt)
        // tall French windows upstairs, shutters beside; a few glow
        for (let wx2 = x + 14; wx2 + 26 < x + w; wx2 += 44) {
          const lit = rand() < 0.5
          ctx.fillStyle = lit ? ga(0.72, 0.8) : g(0.03)
          ctx.fillRect(wx2 + 7, ground - hgt + 22, 14, 40)
          ctx.fillStyle = g(0.07)
          ctx.fillRect(wx2, ground - hgt + 22, 6, 40)                 // shutters
          ctx.fillRect(wx2 + 22, ground - hgt + 22, 6, 40)
        }
        x += w
      }
      // the gallery: balcony deck on posts, iron lace, hanging ferns
      const balY = ground - H * 0.19
      ctx.fillStyle = g(0.05); ctx.fillRect(0, balY, W * 0.88, 8)
      ctx.strokeStyle = ga(0.3, 0.6); ctx.lineWidth = 1.5              // lamplit deck edge
      ctx.beginPath(); ctx.moveTo(0, balY + 8); ctx.lineTo(W * 0.88, balY + 8); ctx.stroke()
      ironLace(ctx, 0, balY - 24, W * 0.88, 24, 0.26)
      ctx.strokeStyle = ga(0.08, 1); ctx.lineWidth = 4
      for (let px = 24; px < W * 0.88; px += 78) {
        ctx.beginPath(); ctx.moveTo(px, balY + 8); ctx.lineTo(px, ground + 18); ctx.stroke()
      }
      for (let fx = 60; fx < W * 0.86; fx += 150 + rand() * 60) {     // ferns off the rail
        ctx.fillStyle = ga(0.09, 0.9)
        ctx.beginPath(); ctx.ellipse(fx, balY - 20, 14, 9, 0, 0, Math.PI * 2); ctx.fill()
        moss(ctx, rand, fx, balY - 14, 4, 22, 0.09)
      }
      // ground floor under the gallery: lit doorways
      for (let dx2 = 40; dx2 < W * 0.84; dx2 += 160 + rand() * 60) {
        ctx.fillStyle = ga(0.62, 0.75)
        ctx.fillRect(dx2, ground - 62, 26, 62)
        glow(ctx, dx2 + 13, ground - 30, 40, 0.7, 0.3)
        glow(ctx, dx2 + 13, ground - 4, 44, 0.6, 0.2)
      }
      wetSheen(ctx, ground)
      // gas lamps on brackets
      for (const lx of [W * 0.3, W * 0.68]) {
        ctx.strokeStyle = ga(0.1, 1); ctx.lineWidth = 2.5
        ctx.beginPath(); ctx.moveTo(lx, balY + 26); ctx.lineTo(lx, balY + 44); ctx.stroke()
        ctx.fillStyle = g(0.08); ctx.fillRect(lx - 5, balY + 44, 10, 14)
        glow(ctx, lx, balY + 51, 22, 0.98, 0.85)
        glow(ctx, lx, ground, 80, 0.65, 0.18)
        reflection(ctx, lx, ground, 70, 0.7, 0.1)
      }
      // cobble hint
      ctx.strokeStyle = ga(0.18, 0.4); ctx.lineWidth = 1
      for (let i = 0; i < 26; i++) {
        const cy2 = ground + 14 + rand() * (H - ground - 20), cx2 = rand() * W
        ctx.beginPath(); ctx.arc(cx2, cy2, 5 + rand() * 4, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke()
      }
      figure(ctx, W * 0.48, ground + 36, 145)
      if (rand() < 0.6) figure(ctx, W * 0.55, ground + 36, 135, 0.05)
      rain(ctx, rand, 50)
    },

    // the coffee stand under the awning — columns, round tables, steam
    cafe(ctx, rand) {
      ctx.fillStyle = g(0.03); ctx.fillRect(0, 0, W, H)
      const ground = H * 0.8
      // warm interior wash behind the colonnade
      const wash = ctx.createLinearGradient(0, H * 0.3, 0, ground)
      wash.addColorStop(0, ga(0.5, 0.85)); wash.addColorStop(1, ga(0.28, 0.8))
      ctx.fillStyle = wash; ctx.fillRect(W * 0.04, H * 0.3, W * 0.92, ground - H * 0.3)
      // globe lights down the arcade
      for (let i = 0; i < 5; i++) {
        const gx = W * (0.14 + i * 0.18)
        ctx.strokeStyle = ga(0.1, 0.9); ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.moveTo(gx, H * 0.3); ctx.lineTo(gx, H * 0.37); ctx.stroke()
        glow(ctx, gx, H * 0.395, 13, 0.98, 0.7)
      }
      // round marble tables, chairs, customers, cups, steam
      for (const [tx, tw2] of [[W * 0.2, 54], [W * 0.44, 60], [W * 0.7, 54]]) {
        const ty = ground - 58
        if (rand() < 0.85) {                                          // someone seated
          const px = tx - 16 - rand() * 8
          ctx.fillStyle = g(0.05)
          ctx.beginPath(); ctx.arc(px, ty - 40, 10, 0, Math.PI * 2); ctx.fill()
          ctx.fillRect(px - 14, ty - 31, 28, 31)
        }
        if (rand() < 0.5) {
          const px = tx + 18 + rand() * 8
          ctx.fillStyle = g(0.05)
          ctx.beginPath(); ctx.arc(px, ty - 38, 9, 0, Math.PI * 2); ctx.fill()
          ctx.fillRect(px - 12, ty - 30, 24, 30)
        }
        ctx.fillStyle = ga(0.78, 0.9)                                 // marble top
        ctx.beginPath(); ctx.ellipse(tx, ty, tw2 / 2, 8, 0, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = g(0.06); ctx.fillRect(tx - 3, ty + 6, 6, 52)  // pedestal
        ctx.fillStyle = ga(0.9, 0.9)                                  // cups
        ctx.fillRect(tx - 12, ty - 6, 8, 5); ctx.fillRect(tx + 6, ty - 6, 8, 5)
        smoke(ctx, rand, tx, ty - 8, 3, 0.5)                          // coffee steam
      }
      // square columns holding the awning
      for (let px = W * 0.08; px < W * 0.98; px += W * 0.18) {
        ctx.fillStyle = g(0.1); ctx.fillRect(px - 9, H * 0.28, 18, ground - H * 0.28)
        ctx.fillStyle = g(0.05); ctx.fillRect(px + 3, H * 0.28, 6, ground - H * 0.28)
      }
      // the striped awning, scalloped edge
      for (let i = 0; i < 16; i++) {
        ctx.fillStyle = i % 2 ? g(0.06) : g(0.22)
        const ax = W * 0.03 + (i / 16) * W * 0.94
        ctx.beginPath()
        ctx.moveTo(ax, H * 0.1); ctx.lineTo(ax + W * 0.94 / 16, H * 0.1)
        ctx.lineTo(ax + W * 0.94 / 16 - 5, H * 0.28); ctx.lineTo(ax - 5, H * 0.28)
        ctx.closePath(); ctx.fill()
      }
      for (let i = 0; i < 16; i++) {                                  // scallops
        ctx.fillStyle = i % 2 ? g(0.06) : g(0.22)
        const ax = W * 0.03 + (i + 0.5) * W * 0.94 / 16 - 5
        ctx.beginPath(); ctx.arc(ax, H * 0.28, W * 0.94 / 32, 0, Math.PI); ctx.fill()
      }
      wetSheen(ctx, ground, 0.25, 0.2)
      glow(ctx, W * 0.5, ground + 10, W * 0.3, 0.5, 0.12)             // light spilling out
      figure(ctx, W * 0.9, ground + 34, 140)                          // watcher at the edge
      rain(ctx, rand, 40)
    },

    // the PI office: the trade etched backwards on the glass, fan turning
    office(ctx, rand) {
      ctx.fillStyle = g(0.045); ctx.fillRect(0, 0, W, H)
      // floorboards
      ctx.strokeStyle = ga(0.1, 0.6); ctx.lineWidth = 1
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(0, H * 0.72 + i * 22); ctx.lineTo(W, H * 0.74 + i * 22); ctx.stroke() }
      // water stain in the ceiling corner
      for (let i = 0; i < 5; i++) glow(ctx, W * (0.4 + rand() * 0.1), H * 0.05 + rand() * 20, 24 + rand() * 22, 0.14, 0.16)
      // ceiling fan, mid-turn — a wash of light behind it so it silhouettes
      const fx = W * 0.46, fy = H * 0.13
      glow(ctx, fx, fy, 120, 0.35, 0.3)
      ctx.strokeStyle = ga(0.02, 1); ctx.lineWidth = 3
      ctx.beginPath(); ctx.moveTo(fx, 0); ctx.lineTo(fx, fy); ctx.stroke()
      ctx.fillStyle = g(0.02)
      ctx.beginPath(); ctx.ellipse(fx, fy, 9, 6, 0, 0, Math.PI * 2); ctx.fill()
      for (const ang of [0.1, 1.1, 2.2, 4.2, 5.3]) {
        ctx.save(); ctx.translate(fx, fy); ctx.rotate(ang)
        ctx.beginPath(); ctx.ellipse(52, 0, 46, 7, 0, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = ga(0.3, 0.5); ctx.lineWidth = 1.2
        ctx.beginPath(); ctx.ellipse(52, 0, 46, 7, 0, Math.PI, 2 * Math.PI); ctx.stroke()
        ctx.restore()
      }
      // the door: frosted pane, PRIVATE INVESTIGATOR etched, read from inside
      const dx = W * 0.05, dw = W * 0.17, dy = H * 0.12, dh = H * 0.6
      ctx.fillStyle = g(0.075); ctx.fillRect(dx - 10, dy - 10, dw + 20, dh + 20)
      const frost = ctx.createLinearGradient(dx, dy, dx, dy + dh * 0.66)
      frost.addColorStop(0, ga(0.46, 0.85)); frost.addColorStop(1, ga(0.32, 0.8))
      ctx.fillStyle = frost; ctx.fillRect(dx, dy, dw, dh * 0.66)
      ctx.fillStyle = g(0.06); ctx.fillRect(dx, dy + dh * 0.66, dw, dh * 0.34)
      ctx.save()                                                      // mirrored lettering
      ctx.translate(dx + dw / 2, dy + dh * 0.24)
      ctx.scale(-1, 1)
      ctx.fillStyle = ga(0.07, 0.95)
      ctx.font = `bold ${Math.round(dw * 0.155)}px Georgia, serif`
      ctx.textAlign = 'center'
      ctx.fillText('PRIVATE', 0, 0)
      ctx.font = `bold ${Math.round(dw * 0.11)}px Georgia, serif`
      ctx.fillText('INVESTIGATOR', 0, dh * 0.09)
      ctx.restore()
      ctx.strokeStyle = ga(0.07, 0.9); ctx.lineWidth = 1.5            // etched rule
      ctx.beginPath(); ctx.moveTo(dx + dw * 0.2, dy + dh * 0.37); ctx.lineTo(dx + dw * 0.8, dy + dh * 0.37); ctx.stroke()
      glow(ctx, dx + dw / 2, dy + dh * 0.3, dw * 0.7, 0.46, 0.11)
      ctx.fillStyle = g(0.09)
      ctx.beginPath(); ctx.arc(dx + dw - 9, dy + dh * 0.74, 4, 0, Math.PI * 2); ctx.fill()
      // blinds window: neon blotch from the street below
      const wx = W * 0.62, ww = W * 0.3, wy = H * 0.14, wh = H * 0.44
      const nite = ctx.createLinearGradient(wx, wy, wx, wy + wh)
      nite.addColorStop(0, g(0.12)); nite.addColorStop(1, g(0.26))
      ctx.fillStyle = nite; ctx.fillRect(wx, wy, ww, wh)
      glow(ctx, wx + ww * 0.3, wy + wh * 0.75, 46, 0.85, 0.4)          // neon below
      ctx.fillStyle = g(0.06)                                          // balcony rail across
      ironLace(ctx, wx, wy + wh * 0.58, ww, 18, 0.05, 0.9)
      ctx.fillStyle = g(0.05)
      for (let i = 0; i < 9; i++) ctx.fillRect(wx, wy + i * (wh / 9), ww, wh / 18)
      ctx.fillStyle = g(0.075); ctx.fillRect(wx - 8, wy - 8, ww + 16, 8); ctx.fillRect(wx - 8, wy, 8, wh + 8); ctx.fillRect(wx + ww, wy, 8, wh + 8)
      // slat light across the room
      ctx.save(); ctx.translate(W * 0.24, 0); ctx.rotate(-0.06)
      for (let i = 0; i < 9; i++) {
        ctx.fillStyle = ga(0.5, 0.12 + rand() * 0.04)
        ctx.fillRect(-W * 0.28, H * 0.16 + i * 34, W * 0.7, 10)
      }
      ctx.restore()
      // desk: lamp pool, photographs fanned out, the bottle, the phone
      ctx.fillStyle = g(0.075); ctx.fillRect(0, H * 0.7, W, H * 0.3)
      ctx.fillStyle = g(0.11); ctx.fillRect(W * 0.24, H * 0.68, W * 0.46, 8)
      const lx = W * 0.36, ly = H * 0.55
      ctx.fillStyle = g(0.04)
      ctx.beginPath(); ctx.moveTo(lx - 32, ly); ctx.lineTo(lx + 32, ly); ctx.lineTo(lx + 20, ly - 15); ctx.lineTo(lx - 20, ly - 15); ctx.closePath(); ctx.fill()
      ctx.fillRect(lx - 3, ly, 6, H * 0.68 - ly)
      glow(ctx, lx, ly + 8, 24, 0.95, 0.7)
      ctx.fillStyle = ga(0.85, 0.13)
      ctx.beginPath(); ctx.moveTo(lx, ly + 4); ctx.lineTo(lx - 120, H * 0.76); ctx.lineTo(lx + 120, H * 0.76); ctx.closePath(); ctx.fill()
      glow(ctx, lx, H * 0.72, 120, 0.8, 0.2)
      for (let i = 0; i < 4; i++) {                                    // the photographs
        ctx.save(); ctx.translate(lx - 30 + i * 26, H * 0.705 + (i % 2) * 8); ctx.rotate(-0.24 + i * 0.13)
        ctx.fillStyle = ga(0.78, 0.7); ctx.fillRect(0, 0, 34, 26)
        ctx.fillStyle = ga(0.2, 0.7); ctx.fillRect(4, 4, 26, 14)
        ctx.restore()
      }
      ctx.fillStyle = g(0.02)                                          // bottle + glass
      ctx.fillRect(lx + 96, H * 0.6, 15, 46); ctx.fillRect(lx + 100, H * 0.575, 7, 26)
      ctx.fillRect(lx + 120, H * 0.635, 13, 13)
      ctx.strokeStyle = ga(0.5, 0.5); ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(lx + 96, H * 0.6); ctx.lineTo(lx + 111, H * 0.6); ctx.stroke()
      ctx.fillStyle = g(0.02)                                          // the telephone
      ctx.fillRect(W * 0.6, H * 0.635, 44, 22)
      ctx.beginPath(); ctx.ellipse(W * 0.6 + 22, H * 0.632, 24, 7, 0, Math.PI, 2 * Math.PI); ctx.fill()
      smoke(ctx, rand, lx + 130, H * 0.58, 6, 0.4)
    },

    // the wharf: the river, a freighter, crates and bollards in the mist
    yard(ctx, rand) {
      sky(ctx, rand, 0.08, 0.18, 0.42)
      const moonX = W * 0.72, moonY = H * 0.2
      glow(ctx, moonX, moonY, 60, 0.95, 0.5)
      ctx.fillStyle = ga(0.9, 0.9)
      ctx.beginPath(); ctx.arc(moonX, moonY, 15, 0, Math.PI * 2); ctx.fill()
      // far bank, low lights
      ctx.fillStyle = g(0.06); ctx.fillRect(0, H * 0.42, W, 12)
      for (let i = 0; i < 8; i++) { ctx.fillStyle = ga(0.7, 0.5); ctx.fillRect(rand() * W, H * 0.425 + rand() * 6, 2, 2) }
      // the river
      const river = ctx.createLinearGradient(0, H * 0.45, 0, H * 0.64)
      river.addColorStop(0, g(0.13)); river.addColorStop(1, g(0.08))
      ctx.fillStyle = river; ctx.fillRect(0, H * 0.45, W, H * 0.19)
      ctx.strokeStyle = ga(0.6, 0.25); ctx.lineWidth = 1.5              // moon track
      for (let i = 0; i < 14; i++) {
        const my = H * 0.46 + (i / 14) * H * 0.17, mw2 = 6 + rand() * 26
        ctx.beginPath(); ctx.moveTo(moonX - mw2 / 2 + (rand() - 0.5) * 30, my); ctx.lineTo(moonX + mw2 / 2, my); ctx.stroke()
      }
      // freighter, twin stacks, portholes
      const sx = W * 0.16, sy = H * 0.52
      ctx.fillStyle = g(0.04)
      ctx.beginPath(); ctx.moveTo(sx - 20, sy); ctx.lineTo(sx + 190, sy); ctx.lineTo(sx + 176, sy - 26); ctx.lineTo(sx - 6, sy - 26); ctx.closePath(); ctx.fill()
      ctx.fillRect(sx + 40, sy - 48, 80, 24)
      ctx.fillRect(sx + 58, sy - 64, 12, 18); ctx.fillRect(sx + 86, sy - 64, 12, 18)
      smoke(ctx, rand, sx + 64, sy - 66, 5, 0.35)
      ctx.strokeStyle = ga(0.15, 0.9); ctx.lineWidth = 1                // masts + rigging
      ctx.beginPath(); ctx.moveTo(sx + 8, sy - 26); ctx.lineTo(sx + 8, sy - 70); ctx.lineTo(sx + 60, sy - 48); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(sx + 160, sy - 26); ctx.lineTo(sx + 160, sy - 62); ctx.lineTo(sx + 118, sy - 48); ctx.stroke()
      ctx.strokeStyle = ga(0.3, 0.6); ctx.lineWidth = 1.5               // deck line catches the moon
      ctx.beginPath(); ctx.moveTo(sx - 6, sy - 26); ctx.lineTo(sx + 176, sy - 26); ctx.stroke()
      ctx.fillStyle = ga(0.9, 0.85)
      for (let i = 0; i < 7; i++) ctx.fillRect(sx + 8 + i * 24, sy - 18, 4, 4)
      // wharf deck, planks converging
      const deck = H * 0.64
      ctx.fillStyle = g(0.115); ctx.fillRect(0, deck, W, H - deck)
      ctx.strokeStyle = ga(0.03, 0.8); ctx.lineWidth = 2
      for (let i = 0; i < 9; i++) {
        const t = i / 9
        ctx.beginPath(); ctx.moveTo(0, deck + 8 + t * (H - deck)); ctx.lineTo(W, deck + 2 + t * (H - deck) * 0.9); ctx.stroke()
      }
      // bollards + rope
      for (const bx of [W * 0.14, W * 0.44, W * 0.74]) {
        ctx.fillStyle = g(0.03)
        ctx.fillRect(bx - 8, deck - 4, 16, 22)
        ctx.beginPath(); ctx.ellipse(bx, deck - 5, 11, 5, 0, 0, Math.PI * 2); ctx.fill()
      }
      ctx.strokeStyle = ga(0.14, 0.9); ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(W * 0.14, deck + 2)
      ctx.quadraticCurveTo(W * 0.29, deck + 26, W * 0.44, deck + 2)
      ctx.quadraticCurveTo(W * 0.59, deck + 26, W * 0.74, deck + 2)
      ctx.stroke()
      // crate stacks, stenciled; barrels
      let cx2 = W * 0.78
      for (let i = 0; i < 3; i++) {
        const cw2 = 54 + rand() * 30, chh = 44 + rand() * 22, cy2 = deck + 30 - i * 2
        ctx.fillStyle = g(0.075 + rand() * 0.025); ctx.fillRect(cx2, cy2 - chh, cw2, chh)
        ctx.strokeStyle = ga(0.28, 0.9); ctx.lineWidth = 1.5
        ctx.strokeRect(cx2 + 3, cy2 - chh + 3, cw2 - 6, chh - 6)
        ctx.beginPath(); ctx.moveTo(cx2 + 3, cy2 - chh + 3); ctx.lineTo(cx2 + cw2 - 3, cy2 - 3); ctx.stroke()
        ctx.fillStyle = ga(0.3, 0.5); ctx.fillRect(cx2 + 8, cy2 - chh / 2 - 3, cw2 * 0.5, 6)
        cx2 += cw2 * 0.4; if (i === 1) cx2 -= cw2 * 0.9
      }
      for (const [bx2, br] of [[W * 0.66, 15], [W * 0.7, 13]]) {
        ctx.fillStyle = g(0.05); ctx.fillRect(bx2 - br, deck + 26, br * 2, 34)
        ctx.strokeStyle = ga(0.16, 0.9); ctx.lineWidth = 1.2
        ctx.beginPath(); ctx.moveTo(bx2 - br, deck + 36); ctx.lineTo(bx2 + br, deck + 36); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(bx2 - br, deck + 50); ctx.lineTo(bx2 + br, deck + 50); ctx.stroke()
      }
      // dock crane over the water + lantern + figure + mist
      ctx.strokeStyle = ga(0.1, 0.95); ctx.lineWidth = 3
      ctx.beginPath(); ctx.moveTo(W * 0.55, deck); ctx.lineTo(W * 0.55, H * 0.28); ctx.lineTo(W * 0.38, H * 0.34); ctx.stroke()
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(W * 0.38, H * 0.34); ctx.lineTo(W * 0.38, H * 0.46); ctx.stroke()
      ctx.strokeStyle = ga(0.1, 1); ctx.lineWidth = 2.5                 // lantern post
      ctx.beginPath(); ctx.moveTo(W * 0.31, deck + 4); ctx.lineTo(W * 0.31, deck - 60); ctx.stroke()
      glow(ctx, W * 0.31, deck - 66, 12, 0.95, 0.8)
      glow(ctx, W * 0.31, deck + 6, 54, 0.6, 0.14)
      figure(ctx, W * 0.5, deck + 44, 100, 0.02)
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = ga(0.3, 0.05 + rand() * 0.05)
        ctx.fillRect(0, deck - 30 - i * 30, W, 18 + rand() * 10)
      }
    },

    // the streetcar at its stop, oaks and moss overhead
    station(ctx, rand) {
      sky(ctx, rand, 0.09, 0.2, 0.5)
      const ground = H * 0.72
      // oak limbs in from the corners, moss hanging
      ctx.strokeStyle = ga(0.03, 1); ctx.lineWidth = 9
      ctx.beginPath(); ctx.moveTo(-10, H * 0.06); ctx.quadraticCurveTo(W * 0.2, H * 0.12, W * 0.4, H * 0.06); ctx.stroke()
      ctx.lineWidth = 5
      ctx.beginPath(); ctx.moveTo(W * 0.24, H * 0.095); ctx.quadraticCurveTo(W * 0.32, H * 0.16, W * 0.44, H * 0.16); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(W + 10, H * 0.1); ctx.quadraticCurveTo(W * 0.8, H * 0.18, W * 0.62, H * 0.13); ctx.stroke()
      for (const mx of [W * 0.12, W * 0.3, W * 0.42, W * 0.7, W * 0.86]) moss(ctx, rand, mx, H * 0.1 + rand() * 30, 6, 55, 0.1)
      // catenary wire + far houses
      ctx.strokeStyle = ga(0.22, 0.7); ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(0, H * 0.24); ctx.lineTo(W, H * 0.28); ctx.stroke()
      let hx = -10
      while (hx < W) { const w2 = 90 + rand() * 80; building(ctx, rand, hx, w2, 50 + rand() * 40, ground - 60, 0.07, 0.1); hx += w2 + 8 }
      // the streetcar
      const tx = W * 0.28, ty = ground - 10, tw2 = W * 0.44, th = H * 0.26
      ctx.fillStyle = g(0.055)
      ctx.beginPath()
      ctx.moveTo(tx, ty); ctx.lineTo(tx, ty - th * 0.8)
      ctx.quadraticCurveTo(tx, ty - th, tx + 30, ty - th)
      ctx.lineTo(tx + tw2 - 30, ty - th)
      ctx.quadraticCurveTo(tx + tw2, ty - th, tx + tw2, ty - th * 0.8)
      ctx.lineTo(tx + tw2, ty); ctx.closePath(); ctx.fill()
      ctx.fillStyle = ga(0.68, 0.75)                                    // lit windows
      for (let i = 0; i < 8; i++) ctx.fillRect(tx + 26 + i * (tw2 - 60) / 8, ty - th * 0.82, (tw2 - 60) / 8 - 8, th * 0.34)
      ctx.fillStyle = ga(0.9, 0.85); ctx.fillRect(tx + tw2 * 0.42, ty - th - 14, 40, 10)  // route board
      ctx.strokeStyle = ga(0.14, 1); ctx.lineWidth = 2                  // trolley pole
      ctx.beginPath(); ctx.moveTo(tx + tw2 * 0.62, ty - th); ctx.lineTo(tx + tw2 * 0.78, H * 0.26); ctx.stroke()
      glow(ctx, tx + 8, ty - th * 0.45, 11, 0.95, 0.6)                  // headlamp
      ctx.fillStyle = g(0.03)                                           // skirt + fenders
      ctx.fillRect(tx + 4, ty - 8, tw2 - 8, 10)
      wetSheen(ctx, ground)
      ctx.strokeStyle = ga(0.5, 0.5); ctx.lineWidth = 2.5               // rails
      ctx.beginPath(); ctx.moveTo(0, ground + 34); ctx.lineTo(W, ground + 24); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, ground + 58); ctx.lineTo(W, ground + 44); ctx.stroke()
      reflection(ctx, tx + 8, ground + 10, 60, 0.7, 0.12)
      // the stop: sign post + waiting figure
      ctx.strokeStyle = ga(0.12, 1); ctx.lineWidth = 2.5
      ctx.beginPath(); ctx.moveTo(W * 0.82, ground + 20); ctx.lineTo(W * 0.82, ground - 90); ctx.stroke()
      ctx.fillStyle = ga(0.6, 0.8); ctx.fillRect(W * 0.8, ground - 104, 40, 14)
      figure(ctx, W * 0.87, ground + 24, 120)
      rain(ctx, rand, 40)
    },

    // dawn over the square: the cathedral's three spires
    epilogue(ctx, rand) {
      const grad = ctx.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, g(0.13)); grad.addColorStop(0.5, g(0.46)); grad.addColorStop(0.72, g(0.66)); grad.addColorStop(1, g(0.2))
      ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H)
      glow(ctx, W * 0.5, H * 0.6, 210, 0.98, 0.5)
      const ground = H * 0.74
      // flanking rooflines (the Cabildo side)
      ctx.fillStyle = g(0.05)
      ctx.fillRect(0, ground - 70, W * 0.3, 70)
      ctx.fillRect(W * 0.7, ground - 70, W * 0.3, 70)
      ctx.beginPath(); ctx.moveTo(0, ground - 70); ctx.lineTo(W * 0.15, ground - 96); ctx.lineTo(W * 0.3, ground - 70); ctx.fill()
      ctx.beginPath(); ctx.moveTo(W * 0.7, ground - 70); ctx.lineTo(W * 0.85, ground - 96); ctx.lineTo(W, ground - 70); ctx.fill()
      // the cathedral: broad facade, three spires, the center one tall
      const cx = W * 0.5
      ctx.fillStyle = g(0.045)
      ctx.fillRect(cx - 120, ground - 120, 240, 120)
      for (const [ox, sh, bw] of [[-88, 60, 30], [88, 60, 30], [0, 120, 38]]) {
        ctx.fillRect(cx + ox - bw / 2, ground - 130 - sh * 0.3, bw, 130 + sh * 0.3)
        ctx.beginPath()
        ctx.moveTo(cx + ox - bw / 2 - 6, ground - 130 - sh * 0.3)
        ctx.lineTo(cx + ox, ground - 150 - sh)
        ctx.lineTo(cx + ox + bw / 2 + 6, ground - 130 - sh * 0.3)
        ctx.closePath(); ctx.fill()
        ctx.strokeStyle = ga(0.05, 1); ctx.lineWidth = 2                // cross
        ctx.beginPath(); ctx.moveTo(cx + ox, ground - 150 - sh); ctx.lineTo(cx + ox, ground - 162 - sh); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(cx + ox - 5, ground - 157 - sh); ctx.lineTo(cx + ox + 5, ground - 157 - sh); ctx.stroke()
      }
      ctx.fillStyle = ga(0.75, 0.7)                                     // clock face
      ctx.beginPath(); ctx.arc(cx, ground - 96, 10, 0, Math.PI * 2); ctx.fill()
      // the square: fence pickets, gate, lamps still lit at dawn
      ctx.fillStyle = g(0.06); ctx.fillRect(0, ground, W, H - ground)
      const spill = ctx.createLinearGradient(0, ground, 0, ground + 48) // dawn on the flagstones
      spill.addColorStop(0, ga(0.45, 0.3)); spill.addColorStop(1, ga(0.45, 0))
      ctx.fillStyle = spill; ctx.fillRect(0, ground, W, 48)
      ctx.strokeStyle = ga(0.07, 1); ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(0, ground + 30); ctx.lineTo(W, ground + 30); ctx.stroke()
      ctx.lineWidth = 1.4
      for (let px = 8; px < W; px += 13) {
        if (px > W * 0.46 && px < W * 0.54) continue                    // the gate
        ctx.beginPath(); ctx.moveTo(px, ground + 8); ctx.lineTo(px, ground + 30); ctx.stroke()
      }
      for (const lx of [W * 0.42, W * 0.58]) {
        ctx.strokeStyle = ga(0.07, 1); ctx.lineWidth = 2.5
        ctx.beginPath(); ctx.moveTo(lx, ground + 30); ctx.lineTo(lx, ground - 26); ctx.stroke()
        glow(ctx, lx, ground - 32, 10, 0.9, 0.55)
      }
      // banana fronds in the corners
      ctx.strokeStyle = ga(0.05, 1); ctx.lineWidth = 4
      for (const [bx2, dir] of [[10, 1], [W - 10, -1]]) {
        for (let i = 0; i < 4; i++) {
          ctx.beginPath(); ctx.moveTo(bx2, H)
          ctx.quadraticCurveTo(bx2 + dir * (30 + i * 26), H - 120 - i * 18, bx2 + dir * (80 + i * 42), H - 90 - i * 30)
          ctx.stroke()
        }
      }
      // birds, far
      ctx.strokeStyle = ga(0.15, 0.9); ctx.lineWidth = 1.5
      for (let i = 0; i < 4; i++) {
        const bx3 = W * (0.3 + rand() * 0.4), by = H * (0.14 + rand() * 0.18)
        ctx.beginPath(); ctx.moveTo(bx3 - 5, by); ctx.quadraticCurveTo(bx3, by - 4, bx3 + 0.5, by)
        ctx.quadraticCurveTo(bx3 + 1, by - 4, bx3 + 6, by); ctx.stroke()
      }
      figure(ctx, W * 0.5, ground + 62, 120, 0.03)
    },
  },
}

export function renderSceneCanvas(kind, eraId, seed = '') {
  const paint = eraPainters[eraId]?.[kind] ?? painters[kind] ?? painters.street
  const canvas = document.createElement('canvas')
  canvas.width = W * DPR; canvas.height = H * DPR
  const ctx = canvas.getContext('2d')
  ctx.scale(DPR, DPR)
  paint(ctx, mulberry32(hash(kind + '|' + seed)))
  return duotone(canvas, eraId, { grain: 0.035, gain: 1.45, lift: 0.07, vignette: 0.38 })
}

// ------------------------------------------------------------ the backdrop

let currentKind = null
let directorScenes = null   // { url } once a FLUX-capable Director is detected

/** Upgrade backdrops to Director FLUX stills when the local service has them. */
export function enableDirectorScenes(url) { directorScenes = { url } }

/** Ask the Director for a FLUX still; hand back a duotoned canvas. */
function fetchStill(kind, eraId, seed, onReady) {
  if (!directorScenes) return
  const wanted = currentKind
  fetch(`${directorScenes.url}/scene`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ era: eraId, kind, seed }),
  }).then(r => r.json()).then(({ image }) => {
    if (!image || currentKind !== wanted) return
    const img = new Image()
    img.onload = () => {
      if (currentKind !== wanted) return
      onReady(duotone(img, eraId, { grain: 0.04, vignette: 0.45 }))
    }
    img.src = image
  }).catch(() => {})
}

/** Crossfade the backdrop to a scene. Deterministic per (kind, seed). */
export function setScene(kind, eraId, seed = '') {
  if (currentKind === kind + seed) return
  currentKind = kind + seed

  if (penEnabled) {
    pen.show(kind, eraId, seed)
    // The stills-as-keyframes stepping stone (DECISIONS §2): the
    // Director's still slides in UNDER the ink as a dim duotoned plate —
    // the drawing stays the voice; the photograph becomes the memory
    // it is drawn from. The real stroke-extraction spike comes later.
    fetchStill(kind, eraId, seed, (plate) => pen.setPlate(plate))
    return
  }

  swapIn(renderSceneCanvas(kind, eraId, seed), kind, seed)

  // FLUX upgrade: procedural paints instantly; the model still replaces
  // it when it lands — duotoned by the same pass, so the era look is
  // identical either way. Never blocks, never errors the game.
  fetchStill(kind, eraId, seed, (canvas) => swapIn(canvas, kind, seed))
}

// ------------------------------------------------------------ the pen
//
// Backdrop v2 (DECISIONS §2, proven by the linedraw spike): the scene is
// drawn by a pen, in the era's accent, in step with the typewriter — the
// wheel dispatches 'noir-type' as it strikes, and each strike advances
// the ink. On a scene change the drawing BRIDGES: strokes walk from the
// old scene into the new one. prefers-reduced-motion gets finished ink.
// Default on; the notebook toggle falls back to the duotone paintings.

let penEnabled = (localStorage.getItem('noir.pen') ?? '1') !== '0'
export const getPenMode = () => penEnabled
export function setPenMode(on) {
  penEnabled = on
  localStorage.setItem('noir.pen', on ? '1' : '0')
  if (on) {
    if (pen.last) pen.show(pen.last.kind, pen.last.era, pen.last.seed, true)
  } else {
    pen.hide()
    if (pen.last) swapIn(renderSceneCanvas(pen.last.kind, pen.last.era, pen.last.seed), pen.last.kind, pen.last.seed)
  }
}

const pen = {
  canvas: null, ctx: null, strokes: null, next: null, plan: null,
  phase: 'idle', t: 0, raf: 0, last: null, accent: '#c39a56', plate: null,

  /** The Director's still, laid under the ink like the memory it is drawn from. */
  setPlate(canvas) {
    this.plate?.remove()
    canvas.className = 'backdrop-canvas plate'
    const holder = document.getElementById('backdrop')
    holder.insertBefore(canvas, this.canvas?.isConnected ? this.canvas : null)
    requestAnimationFrame(() => canvas.classList.add('active'))
    this.plate = canvas
  },

  clearPlate() { this.plate?.remove(); this.plate = null },

  ensure() {
    if (this.canvas?.isConnected) return
    const c = document.createElement('canvas')
    c.className = 'backdrop-canvas pen'
    c.width = W * DPR; c.height = H * DPR
    document.getElementById('backdrop').appendChild(c)
    requestAnimationFrame(() => c.classList.add('active'))
    this.canvas = c
    this.ctx = c.getContext('2d')
  },

  show(kind, era, seed, restart = false) {
    this.ensure()
    this.clearPlate()
    this.last = { kind, era, seed }
    this.accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#c39a56'
    const target = buildLineScene(kind, era, seed)
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    this.canvas.getAnimations().forEach(a => a.cancel())
    kenBurns(this.canvas, kind, seed)
    if (reduce) {
      this.strokes = target; this.phase = 'idle'; this.t = 1
      this.paint(() => renderDrawOn(this.ctx, this.strokes, 1), true)
      return
    }
    if (!this.strokes || restart) {
      this.strokes = target; this.phase = 'draw'; this.t = 0
    } else {
      this.plan = planMorph(this.strokes, target)
      this.next = target; this.phase = 'morph'; this.t = 0
    }
    this.loop()
  },

  hide() {
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0; this.phase = 'idle'; this.strokes = null
    this.canvas?.remove(); this.canvas = null
    this.clearPlate()
  },

  /** The typewriter feeds the pen: each strike is a little more ink. */
  boost(chars = 1) {
    if (this.phase === 'draw') { this.t = Math.min(1, this.t + chars / 1100); this.loop() }
  },

  paint(fn, glow = false) {
    const ctx = this.ctx
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
    ctx.clearRect(0, 0, W, H)
    ctx.lineJoin = ctx.lineCap = 'round'
    ctx.strokeStyle = this.accent
    if (glow) { ctx.shadowColor = this.accent; ctx.shadowBlur = 5 }
    fn()
    ctx.shadowBlur = 0
  },

  loop() { if (!this.raf) this.raf = requestAnimationFrame(() => this.step()) },

  step() {
    this.raf = 0
    if (!this.canvas) return
    if (this.phase === 'draw') {
      this.t = Math.min(1, this.t + 0.0016)               // ~10s alone; typing hurries it
      this.paint(() => renderDrawOn(this.ctx, this.strokes, this.t))
      if (this.t >= 1) {
        this.phase = 'idle'
        this.paint(() => renderDrawOn(this.ctx, this.strokes, 1), true)
        return
      }
    } else if (this.phase === 'morph') {
      this.t = Math.min(1, this.t + 1 / (60 * 2.8))       // ~2.8s bridge
      this.paint(() => renderMorph(this.ctx, this.plan, this.t))
      if (this.t >= 1) {
        this.strokes = this.next; this.plan = null; this.phase = 'idle'
        this.paint(() => renderDrawOn(this.ctx, this.strokes, 1), true)
        return
      }
    } else return
    this.loop()
  },
}

if (typeof window !== 'undefined') {
  window.addEventListener('noir-type', (e) => pen.boost(e.detail?.chars ?? 1))
}

function swapIn(canvas, kind = 'street', seed = '') {
  canvas.className = 'backdrop-canvas'
  const holder = document.getElementById('backdrop')
  const old = [...holder.querySelectorAll('.backdrop-canvas')]
  holder.appendChild(canvas)
  requestAnimationFrame(() => requestAnimationFrame(() => {
    canvas.classList.add('active')
    kenBurns(canvas, kind, seed)
  }))
  setTimeout(() => old.forEach(el => el.remove()), 2800)
}

// ------------------------------------------------------- Ken Burns (M3)
//
// Deterministic camera work per scene, spec §6 / DECISIONS §2: the same
// dossier always gets the same shot. A small vocabulary of moves —
// interiors get a slow push toward the light, exteriors a lateral drift,
// the epilogue a pull-back reveal — parameterized by the scene's own
// hash, eased into rest (the settle), then a barely-perceptible breathing
// loop so the room never quite dies. FLUX stills ride the same camera:
// swapIn is the one seam. prefers-reduced-motion gets the still.

const KB_MOVE = { office: 'push', cafe: 'push', epilogue: 'pull', street: 'drift', station: 'drift', yard: 'drift' }

function kenBurns(canvas, kind, seed) {
  if (!canvas.animate) return
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const r = mulberry32(hash(kind + '|' + seed + '|camera'))
  const dir = r() < 0.5 ? -1 : 1
  const dx = (1.0 + r() * 1.6) * dir           // lateral travel, %
  const dy = (r() - 0.5) * 1.4                 // vertical travel, %
  const dur = 42000 + r() * 26000              // 42–68s to settle
  const t = (s, x, y) => `scale(${s.toFixed(4)}) translate(${x.toFixed(2)}%, ${y.toFixed(2)}%)`

  let from, to
  const move = KB_MOVE[kind] ?? (r() < 0.5 ? 'push' : 'drift')
  if (move === 'push') {                        // in, toward the lamp
    from = [1.0, 0, 0]; to = [1.09 + r() * 0.05, dx * 0.6, dy]
  } else if (move === 'pull') {                 // the reveal, ending at rest
    from = [1.12 + r() * 0.05, dx * 0.8, dy]; to = [1.01, 0, 0]
  } else {                                      // drift, a walk past
    from = [1.05, dx, dy]; to = [1.08 + r() * 0.03, -dx, -dy]
  }

  const settle = canvas.animate(
    [{ transform: t(...from) }, { transform: t(...to) }],
    { duration: dur, easing: 'cubic-bezier(0.25, 0.1, 0.15, 1)', fill: 'forwards' },
  )
  settle.onfinish = () => {
    if (!canvas.isConnected) return
    canvas.animate(
      [{ transform: t(...to) }, { transform: t(to[0] + 0.008, to[1] * 0.85, to[2] + 0.3) }],
      { duration: 38000, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' },
    )
  }
}
