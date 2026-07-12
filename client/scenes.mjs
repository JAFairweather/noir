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
export function renderSceneCanvas(kind, eraId, seed = '') {
  const paint = painters[kind] ?? painters.street
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

/** Crossfade the backdrop to a scene. Deterministic per (kind, seed). */
export function setScene(kind, eraId, seed = '') {
  if (currentKind === kind + seed) return
  currentKind = kind + seed

  swapIn(renderSceneCanvas(kind, eraId, seed))

  // FLUX upgrade (DECISIONS §2): procedural paints instantly; the model
  // still replaces it when it lands — duotoned by the same pass, so the
  // era look is identical either way. Never blocks, never errors the game.
  if (directorScenes) {
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
        swapIn(duotone(img, eraId, { grain: 0.04, vignette: 0.45 }))
      }
      img.src = image
    }).catch(() => {})
  }
}

function swapIn(canvas) {
  canvas.className = 'backdrop-canvas'
  const holder = document.getElementById('backdrop')
  const old = [...holder.querySelectorAll('.backdrop-canvas')]
  holder.appendChild(canvas)
  requestAnimationFrame(() => requestAnimationFrame(() => canvas.classList.add('active')))
  setTimeout(() => old.forEach(el => el.remove()), 2800)
}
