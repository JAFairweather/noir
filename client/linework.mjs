// linework.mjs — the procedural line-draw engine (spike; DECISIONS §2).
//
// The long-term imagery architecture: scenes as STROKES — ordered vector
// polylines, a pen — instead of raster. Two things fall out that raster
// can never give us:
//
//   draw-on   — the scene draws itself in, stroke by stroke, in step with
//               the typewriter: renderDrawOn(scene, t) with t in [0,1].
//   bridging  — one scene redraws itself into the next: strokes are
//               matched (greedy nearest-centroid), resampled to a common
//               point count, and interpolated: renderMorph(a, b, t).
//               Unmatched strokes ease out/in through their centroids.
//
// Same law as everything else: deterministic per (kind, seed); the pen is
// ours, the aesthetic is ours. FLUX stills become a second stroke SOURCE
// later (edge extraction → vectorization), feeding this same renderer —
// the model stays out of the render loop.

const W = 960, H = 540

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

// ------------------------------------------------------------ stroke kit
// A stroke: { pts: [[x,y],...], w: lineWidth, a: alpha }. Author order is
// pen order: architecture first, furniture, figures, weather last.

const seg = (x1, y1, x2, y2, w = 1.6, a = 0.75) => ({ pts: [[x1, y1], [x2, y2]], w, a })
const poly = (pts, w = 1.6, a = 0.75) => ({ pts, w, a })
const box = (x, y, bw, bh, w = 1.6, a = 0.75) =>
  poly([[x, y], [x + bw, y], [x + bw, y + bh], [x, y + bh], [x, y]], w, a)
const ellipse = (cx, cy, rx, ry, w = 1.6, a = 0.75, n = 26, from = 0, to = Math.PI * 2) => {
  const pts = []
  for (let i = 0; i <= n; i++) {
    const t = from + (i / n) * (to - from)
    pts.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry])
  }
  return poly(pts, w, a)
}
const curve = (p0, p1, p2, w = 1.6, a = 0.75, n = 16) => {   // quadratic
  const pts = []
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t
    pts.push([
      u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
      u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
    ])
  }
  return poly(pts, w, a)
}

/** A figure in a coat and hat, six strokes of pen. */
function figureStrokes(x, y, h, a = 0.9) {
  const s = []
  s.push(seg(x - h * 0.14, y - h * 0.97, x + h * 0.14, y - h * 0.97, 2, a))          // brim
  s.push(box(x - h * 0.07, y - h * 1.07, h * 0.14, h * 0.1, 1.6, a))                 // crown
  s.push(poly([[x - h * 0.11, y - h * 0.92], [x - h * 0.1, y - h * 0.55], [x - h * 0.17, y]], 1.8, a))
  s.push(poly([[x + h * 0.11, y - h * 0.92], [x + h * 0.1, y - h * 0.55], [x + h * 0.17, y]], 1.8, a))
  s.push(seg(x - h * 0.11, y - h * 0.92, x + h * 0.11, y - h * 0.92, 1.8, a))        // shoulders
  s.push(seg(x - h * 0.02, y - h * 0.55, x - h * 0.04, y, 1.4, a * 0.8))             // coat split
  return s
}

// -------------------------------------------------------- scene builders
// Line-art scenes: same vocabulary as the duotone painters, drawn by pen.

const builders = {
  street(rand) {
    const s = []
    const ground = H * 0.66
    s.push(seg(0, ground, W, ground, 2, 0.8))                                        // the street line
    let x = -10
    while (x < W) {                                                                  // facades
      const w = 110 + rand() * 130, hgt = 140 + rand() * 220
      s.push(poly([[x, ground], [x, ground - hgt], [x + w, ground - hgt], [x + w, ground]], 1.8, 0.7))
      if (rand() < 0.5) s.push(box(x + 10 + rand() * (w - 40), ground - hgt - 14, 10, 14, 1.4, 0.6))
      const rows = Math.max(2, Math.floor(hgt / 60))
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < Math.floor(w / 46); c++) {
          if (rand() < 0.55) continue
          s.push(box(x + 12 + c * 44, ground - hgt + 18 + r * 54, 14, 22, 1.2, rand() < 0.25 ? 1 : 0.45))
        }
      }
      x += w + 14
    }
    const lx = W * 0.3                                                                // lamp
    s.push(seg(lx, ground, lx, ground - 150, 2.2, 0.95))
    s.push(curve([lx, ground - 150], [lx + 12, ground - 154], [lx + 18, ground - 142], 1.8, 0.95))
    s.push(ellipse(lx + 18, ground - 138, 5, 6, 1.6, 1))
    s.push(seg(lx + 18, ground - 132, lx - 40, ground + 2, 1, 0.3))                   // the cone, two pen lines
    s.push(seg(lx + 18, ground - 132, lx + 76, ground + 2, 1, 0.3))
    s.push(ellipse(lx + 18, ground + 2, 56, 7, 1, 0.3))                               // light pool
    s.push(...figureStrokes(W * 0.55, ground + 26, 140))
    s.push(...figureStrokes(W * 0.63, ground + 22, 110, 0.55))
    for (let i = 0; i < 14; i++) {                                                    // rain, last
      const rx = rand() * W, ry = rand() * H * 0.7
      s.push(seg(rx, ry, rx - 5, ry + 26, 0.8, 0.18))
    }
    return s
  },

  cafe(rand) {
    const s = []
    const ground = H * 0.8
    s.push(seg(0, ground, W, ground, 2, 0.8))
    s.push(box(W * 0.06, H * 0.14, W * 0.88, ground - H * 0.14, 1.8, 0.7))            // the facade
    for (const wx of [W * 0.12, W * 0.55]) {                                          // two tall windows
      s.push(box(wx, H * 0.24, W * 0.3, ground - 40 - H * 0.24, 1.8, 0.9))
      s.push(seg(wx + W * 0.15, H * 0.24, wx + W * 0.15, ground - 40, 1.4, 0.7))      // mullion
      s.push(seg(wx, H * 0.47, wx + W * 0.3, H * 0.47, 1.4, 0.7))
      const tableY = ground - 82
      s.push(seg(wx + 20, tableY, wx + W * 0.3 - 20, tableY, 1.6, 0.8))               // table line
      for (let p = 0; p < 2; p++) {
        const px = wx + 60 + p * (W * 0.3 - 120) + rand() * 20
        s.push(ellipse(px, tableY - 26, 9, 10, 1.6, 0.9))                             // a head
        s.push(curve([px - 14, tableY], [px, tableY - 20], [px + 14, tableY], 1.6, 0.9))
      }
    }
    for (let i = 0; i < 10; i++) {                                                    // awning scallops
      const ax = W * 0.08 + i * (W * 0.84 / 10)
      s.push(ellipse(ax + W * 0.042, H * 0.2, W * 0.042, 12, 1.6, 0.85, 12, 0, Math.PI))
    }
    s.push(seg(W * 0.08, H * 0.14, W * 0.92, H * 0.14, 1.8, 0.85))
    s.push(seg(W * 0.475, H * 0.14, W * 0.475, H * 0.2, 1.4, 0.8))                     // sign chain
    s.push(box(W * 0.44, H * 0.2, W * 0.07, H * 0.07, 1.6, 0.9))
    s.push(ellipse(W * 0.28, ground + 4, 70, 8, 1, 0.3))                               // spill
    s.push(ellipse(W * 0.71, ground + 4, 70, 8, 1, 0.3))
    s.push(...figureStrokes(W * 0.485, ground + 30, 135))
    return s
  },

  station(rand) {
    const s = []
    for (const r of [1, 0.82, 0.64]) {                                                 // the shed arch
      s.push(ellipse(W / 2, H * 0.98, W * 0.55 * r, H * 0.86 * r, r === 1 ? 2.2 : 1.4, r === 1 ? 0.95 : 0.5, 40, Math.PI, Math.PI * 2))
    }
    for (let a = 0.35; a < Math.PI; a += 0.45) {                                       // glazing radials
      s.push(seg(W / 2, H * 0.98,
        W / 2 + Math.cos(Math.PI + a) * W * 0.55, H * 0.98 + Math.sin(Math.PI + a) * H * 0.86, 1, 0.35))
    }
    s.push(seg(0, H * 0.78, W, H * 0.78, 2, 0.8))                                      // platform edge
    for (const off of [-40, -12, 14, 44]) {                                            // rails
      s.push(seg(W / 2 + off * 6, H, W / 2 + off, H * 0.56, 1.8, 0.7))
    }
    for (let i = 0; i < 7; i++) {                                                      // ties
      const t = i / 7, y = H - t * (H * 0.42), half = (1 - t * 0.8) * 170
      s.push(seg(W / 2 - half, y, W / 2 + half, y, 1.2, 0.4))
    }
    s.push(seg(W * 0.72, H * 0.08, W * 0.72, H * 0.19, 1.6, 0.9))                      // the clock
    s.push(ellipse(W * 0.72, H * 0.23, 15, 15, 1.8, 1))
    s.push(seg(W * 0.72, H * 0.23, W * 0.72, H * 0.205, 1.4, 1))
    s.push(seg(W * 0.72, H * 0.23, W * 0.735, H * 0.238, 1.4, 1))
    for (let i = 0; i < 5; i++) {                                                      // platform lamps
      const t = i / 5
      s.push(ellipse(W * (0.32 + t * 0.36), H * (0.52 + t * 0.065), 4 + (1 - t) * 3, 4 + (1 - t) * 3, 1.4, 0.9, 12))
    }
    s.push(...figureStrokes(W * 0.6, H * 0.84, 105))
    s.push(box(W * 0.605, H * 0.825, 17, 9, 1.6, 0.9))                                 // the case
    for (let i = 0; i < 5; i++) {                                                      // steam curls
      const sx = W * 0.5 + (rand() - 0.5) * 30, sy = H * 0.7 - i * 26
      s.push(curve([sx - 10, sy], [sx + (i % 2 ? 14 : -14), sy - 12], [sx + 8, sy - 24], 1, 0.25))
    }
    return s
  },
}

/** Build a line scene: ordered strokes, deterministic per (kind, seed). */
export function buildLineScene(kind, seed = '') {
  const make = builders[kind] ?? builders.street
  return make(mulberry32(hash(kind + '|' + seed + '|line')))
}

// --------------------------------------------------------------- drawing

function strokeLen(s) {
  let L = 0
  for (let i = 1; i < s.pts.length; i++) {
    L += Math.hypot(s.pts[i][0] - s.pts[i - 1][0], s.pts[i][1] - s.pts[i - 1][1])
  }
  return L
}

function drawStroke(ctx, s, upto = 1) {
  if (upto <= 0 || s.pts.length < 2) return
  ctx.globalAlpha = s.a
  ctx.lineWidth = s.w
  ctx.beginPath()
  ctx.moveTo(s.pts[0][0], s.pts[0][1])
  if (upto >= 1) {
    for (let i = 1; i < s.pts.length; i++) ctx.lineTo(s.pts[i][0], s.pts[i][1])
  } else {
    const total = strokeLen(s)
    let budget = total * upto
    for (let i = 1; i < s.pts.length && budget > 0; i++) {
      const d = Math.hypot(s.pts[i][0] - s.pts[i - 1][0], s.pts[i][1] - s.pts[i - 1][1])
      if (d <= budget) { ctx.lineTo(s.pts[i][0], s.pts[i][1]); budget -= d }
      else {
        const f = budget / d
        ctx.lineTo(s.pts[i - 1][0] + (s.pts[i][0] - s.pts[i - 1][0]) * f,
                   s.pts[i - 1][1] + (s.pts[i][1] - s.pts[i - 1][1]) * f)
        budget = 0
      }
    }
  }
  ctx.stroke()
  ctx.globalAlpha = 1
}

/** Draw-on: the pen has covered fraction t of the scene's total ink. */
export function renderDrawOn(ctx, strokes, t) {
  const total = strokes.reduce((L, s) => L + strokeLen(s), 0)
  let budget = total * Math.max(0, Math.min(1, t))
  for (const s of strokes) {
    const L = strokeLen(s)
    if (L <= budget) { drawStroke(ctx, s); budget -= L }
    else { drawStroke(ctx, s, budget / L); break }
  }
}

// -------------------------------------------------------------- morphing

function centroid(s) {
  let x = 0, y = 0
  for (const p of s.pts) { x += p[0]; y += p[1] }
  return [x / s.pts.length, y / s.pts.length]
}

function resample(s, n = 24) {
  const total = strokeLen(s) || 1
  const out = [s.pts[0]]
  let need = total / (n - 1), acc = 0
  for (let i = 1; i < s.pts.length && out.length < n; i++) {
    let [ax, ay] = s.pts[i - 1]
    const [bx, by] = s.pts[i]
    let d = Math.hypot(bx - ax, by - ay)
    while (acc + d >= need && out.length < n) {
      const f = (need - acc) / d
      const nx = ax + (bx - ax) * f, ny = ay + (by - ay) * f
      out.push([nx, ny])
      d -= (need - acc); ax = nx; ay = ny; acc = 0
    }
    acc += d
  }
  while (out.length < n) out.push(s.pts[s.pts.length - 1])
  return out
}

/** Pair strokes between scenes: greedy nearest centroid, weighted by size. */
export function planMorph(a, b) {
  const A = a.map(s => ({ s, c: centroid(s), L: strokeLen(s) }))
  const B = b.map(s => ({ s, c: centroid(s), L: strokeLen(s), used: false }))
  const pairs = [], outs = [], ins = []
  for (const ea of A) {
    let best = null, bestCost = Infinity
    for (const eb of B) {
      if (eb.used) continue
      const cost = Math.hypot(ea.c[0] - eb.c[0], ea.c[1] - eb.c[1]) +
                   Math.abs(ea.L - eb.L) * 0.25
      if (cost < bestCost) { bestCost = cost; best = eb }
    }
    if (best && bestCost < 320) {
      best.used = true
      pairs.push({ from: resample(ea.s), to: resample(best.s), w: [ea.s.w, best.s.w], a: [ea.s.a, best.s.a] })
    } else {
      outs.push({ pts: resample(ea.s), c: ea.c, w: ea.s.w, a: ea.s.a })
    }
  }
  for (const eb of B) if (!eb.used) ins.push({ pts: resample(eb.s), c: eb.c, w: eb.s.w, a: eb.s.a })
  return { pairs, outs, ins }
}

const easeInOut = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2

/** Render the bridge at t in [0,1]: A's ink walks into B's. */
export function renderMorph(ctx, plan, t) {
  const e = easeInOut(Math.max(0, Math.min(1, t)))
  for (const p of plan.pairs) {
    const pts = p.from.map((q, i) => [
      q[0] + (p.to[i][0] - q[0]) * e,
      q[1] + (p.to[i][1] - q[1]) * e,
    ])
    drawStroke(ctx, { pts, w: p.w[0] + (p.w[1] - p.w[0]) * e, a: p.a[0] + (p.a[1] - p.a[0]) * e })
  }
  for (const o of plan.outs) {                                   // unmatched: fold into the pen point
    if (e >= 0.5) continue
    const k = e / 0.5
    const pts = o.pts.map(q => [q[0] + (o.c[0] - q[0]) * k, q[1] + (o.c[1] - q[1]) * k])
    drawStroke(ctx, { pts, w: o.w, a: o.a * (1 - k) })
  }
  for (const n of plan.ins) {                                    // arriving: unfold from centroid
    if (e < 0.5) continue
    const k = (e - 0.5) / 0.5
    const pts = n.pts.map(q => [n.c[0] + (q[0] - n.c[0]) * k, n.c[1] + (q[1] - n.c[1]) * k])
    drawStroke(ctx, { pts, w: n.w, a: n.a * k })
  }
}
