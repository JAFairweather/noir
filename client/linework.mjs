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

builders.office = function (rand) {
  const s = []
  const deskY = H * 0.68
  s.push(seg(0, deskY, W, deskY, 2, 0.8))                                            // the desk edge
  s.push(box(W * 0.06, H * 0.12, W * 0.17, H * 0.58, 1.8, 0.8))                      // the door
  s.push(box(W * 0.085, H * 0.16, W * 0.11, H * 0.28, 1.6, 0.9))                     // frosted pane
  s.push(seg(W * 0.1, H * 0.3, W * 0.17, H * 0.3, 1.2, 0.6))                         // etched rule
  const lx = W * 0.4, ly = H * 0.5
  s.push(poly([[lx - 34, ly], [lx - 22, ly - 16], [lx + 22, ly - 16], [lx + 34, ly]], 1.8, 0.95))  // lamp shade
  s.push(seg(lx, ly, lx, deskY, 1.8, 0.95))                                          // stem
  s.push(seg(lx - 30, ly + 4, lx - 120, deskY + 4, 1, 0.3))                          // the cone
  s.push(seg(lx + 30, ly + 4, lx + 120, deskY + 4, 1, 0.3))
  s.push(ellipse(lx, deskY + 4, 110, 9, 1, 0.3))                                     // pool
  s.push(box(lx - 90, deskY - 4, 66, 8, 1.4, 0.8))                                   // papers
  s.push(box(lx - 78, deskY - 10, 66, 8, 1.4, 0.6))
  for (let i = 0; i < 3; i++) s.push(seg(lx - 84, deskY - 1 + i * 0, lx - 30, deskY - 1, 0, 0))   // (kept minimal)
  s.push(box(lx + 44, deskY - 26, 74, 24, 1.8, 0.9))                                 // the typewriter
  s.push(box(lx + 54, deskY - 36, 54, 10, 1.6, 0.9))
  for (let i = 0; i < 8; i++) s.push(seg(lx + 50 + i * 8, deskY - 6, lx + 52 + i * 8, deskY - 12, 1, 0.7))
  for (let i = 0; i < 7; i++) {                                                       // blinds, far wall
    s.push(seg(W * 0.62, H * 0.14 + i * 26, W * 0.92, H * 0.15 + i * 26, 1.2, 0.35))
  }
  s.push(box(W * 0.6, H * 0.12, W * 0.34, H * 0.44, 1.6, 0.6))                        // window frame
  for (let i = 0; i < 4; i++) {                                                       // smoke from the ashtray
    const sx = lx + 150 + (rand() - 0.5) * 8, sy = deskY - 12 - i * 24
    s.push(curve([sx - 8, sy], [sx + (i % 2 ? 12 : -12), sy - 12], [sx + 6, sy - 24], 1, 0.25))
  }
  return s
}

builders.yard = function (rand) {
  const s = []
  const ground = H * 0.72
  s.push(seg(0, ground, W, ground, 2, 0.8))
  let x = W * 0.02
  for (let i = 0; i < 3; i++) {                                                       // boxcars
    const w = 190 + rand() * 60, y = ground - 88
    s.push(box(x, y, w, 72, 1.8, 0.85))
    s.push(box(x + w * 0.38, y + 6, w * 0.24, 60, 1.4, 0.7))                          // door
    s.push(seg(x + 16, y + 6, x + 16, y + 66, 1.2, 0.6))                              // ladder
    for (let ry = y + 14; ry < y + 62; ry += 12) s.push(seg(x + 12, ry, x + 20, ry, 1, 0.5))
    s.push(ellipse(x + 34, ground - 7, 9, 9, 1.6, 0.9, 14))
    s.push(ellipse(x + w - 34, ground - 7, 9, 9, 1.6, 0.9, 14))
    x += w + 26
  }
  s.push(seg(0, H, W * 0.42, ground - 2, 1.8, 0.7))                                   // rails
  s.push(seg(W * 0.3, H, W * 0.5, ground - 2, 1.8, 0.7))
  for (let i = 0; i < 6; i++) {                                                       // ties
    const t = i / 6, y = H - t * (H - ground)
    s.push(seg(t * W * 0.42 - 20 * (1 - t), y, W * 0.3 + t * W * 0.2 + 20 * (1 - t), y, 1.2, 0.4))
  }
  s.push(seg(W * 0.62, ground, W * 0.62, H * 0.34, 2, 0.95))                          // signal pole
  s.push(ellipse(W * 0.62, H * 0.36, 7, 7, 1.8, 1, 14))                               // the eye
  s.push(seg(W * 0.86, ground - 8, W * 0.86, H * 0.22, 1.8, 0.7))                     // crane
  s.push(seg(W * 0.86, H * 0.22, W * 0.7, H * 0.27, 1.8, 0.7))
  s.push(seg(W * 0.7, H * 0.27, W * 0.7, H * 0.34, 1, 0.5))
  s.push(...figureStrokes(W * 0.34, ground + 26, 92, 0.7))
  for (let i = 0; i < 3; i++) s.push(ellipse(W * (0.2 + rand() * 0.5), ground - 24 - i * 26, 90, 8, 1, 0.15))
  return s
}

builders.epilogue = function (rand) {
  const s = []
  const ground = H * 0.72
  s.push(ellipse(W * 0.5, ground, 120, 60, 1.6, 0.5, 24, Math.PI, Math.PI * 2))       // first light
  for (let i = 0; i < 3; i++) s.push(seg(W * 0.2 - i * 30, H * (0.52 + i * 0.05), W * 0.8 + i * 30, H * (0.52 + i * 0.05), 1, 0.25))
  let x = -10
  while (x < W) {                                                                     // rooftops
    const w = 90 + rand() * 120, hgt = 60 + rand() * 110
    s.push(poly([[x, ground], [x, ground - hgt], [x + w, ground - hgt], [x + w, ground]], 1.6, 0.7))
    if (rand() < 0.5) s.push(box(x + 12 + rand() * (w - 30), ground - hgt - 14, 9, 14, 1.2, 0.6))
    if (rand() < 0.35) {
      const ax = x + 20 + rand() * (w - 40)
      s.push(seg(ax, ground - hgt, ax, ground - hgt - 26, 1.2, 0.7))
      s.push(seg(ax - 8, ground - hgt - 20, ax + 8, ground - hgt - 20, 1.2, 0.7))
    }
    x += w + 10
  }
  s.push(seg(0, ground, W, ground, 2, 0.8))
  s.push(seg(W * 0.3, ground + 26, W * 0.7, ground + 26, 1.6, 0.8))                    // the railing
  s.push(...figureStrokes(W * 0.5, ground + 26, 125))
  for (let i = 0; i < 4; i++) {                                                        // birds
    const bx = W * (0.3 + rand() * 0.4), by = H * (0.14 + rand() * 0.2)
    s.push(curve([bx - 6, by], [bx - 2, by - 5], [bx, by], 1.2, 0.7, 6))
    s.push(curve([bx, by], [bx + 2, by - 5], [bx + 6, by], 1.2, 0.7, 6))
  }
  return s
}

// New Orleans stroke vocabulary — the pen keeps the era distinction.
const eraBuilders = {
  'neworleans-1968': {
    office(rand) {
      const s = []
      const deskY = H * 0.7
      const fx = W * 0.46, fy = H * 0.13
      s.push(seg(fx, 0, fx, fy - 6, 1.6, 0.8))                                       // the fan
      s.push(ellipse(fx, fy, 9, 6, 1.6, 0.9))
      for (const ang of [0.15, 1.2, 2.3, 4.1, 5.2]) {
        const bx = fx + Math.cos(ang) * 52, by = fy + Math.sin(ang) * 18
        s.push(ellipse(bx, by, 42, 7, 1.4, 0.7, 14))
      }
      s.push(box(W * 0.05, H * 0.12, W * 0.17, H * 0.6, 1.8, 0.85))                  // the door
      s.push(box(W * 0.07, H * 0.16, W * 0.13, H * 0.26, 1.6, 0.95))                 // frosted pane
      s.push(seg(W * 0.085, H * 0.24, W * 0.185, H * 0.24, 1.2, 0.7))                // PRIVATE
      s.push(seg(W * 0.095, H * 0.28, W * 0.175, H * 0.28, 1, 0.6))                  // INVESTIGATOR
      s.push(seg(W * 0.1, H * 0.31, W * 0.17, H * 0.31, 1, 0.4))                     // the etched rule
      s.push(ellipse(W * 0.205, H * 0.56, 4, 4, 1.4, 0.9, 10))                       // knob
      s.push(box(W * 0.62, H * 0.14, W * 0.3, H * 0.44, 1.6, 0.7))                   // the window
      for (let i = 0; i < 8; i++) s.push(seg(W * 0.62, H * 0.16 + i * 27, W * 0.92, H * 0.17 + i * 27, 1, 0.35))
      for (let bx = W * 0.62; bx + 18 < W * 0.92; bx += 18) {                        // balcony lace beyond
        s.push(ellipse(bx + 9, H * 0.4, 5, 5, 0.9, 0.4, 8, 0, Math.PI))
      }
      s.push(seg(0, deskY, W, deskY, 2, 0.8))                                        // the desk
      const lx = W * 0.38, ly = H * 0.55
      s.push(poly([[lx - 30, ly], [lx - 19, ly - 14], [lx + 19, ly - 14], [lx + 30, ly]], 1.8, 0.95))
      s.push(seg(lx, ly, lx, deskY, 1.6, 0.9))
      s.push(seg(lx - 26, ly + 4, lx - 110, deskY + 4, 1, 0.3))                      // cone
      s.push(seg(lx + 26, ly + 4, lx + 110, deskY + 4, 1, 0.3))
      s.push(ellipse(lx, deskY + 4, 100, 9, 1, 0.3))
      for (let i = 0; i < 4; i++) {                                                  // the photographs, fanned
        const px = lx - 34 + i * 27, py = deskY - 8 + (i % 2) * 5
        s.push(poly([[px, py], [px + 32, py - 6], [px + 36, py + 16], [px + 4, py + 22], [px, py]], 1.3, 0.85))
      }
      s.push(box(lx + 94, deskY - 44, 15, 44, 1.6, 0.9))                             // the bottle
      s.push(box(lx + 98, deskY - 66, 7, 22, 1.4, 0.9))
      s.push(box(lx + 118, deskY - 13, 13, 13, 1.4, 0.8))                            // the glass
      s.push(box(W * 0.6, deskY - 22, 44, 22, 1.6, 0.85))                            // the telephone
      s.push(ellipse(W * 0.6 + 22, deskY - 24, 24, 7, 1.4, 0.85, 16, Math.PI, Math.PI * 2))
      for (let i = 0; i < 4; i++) s.push(seg(0, deskY + 18 + i * 26, W, deskY + 22 + i * 26, 1, 0.25))
      for (let i = 0; i < 4; i++) {                                                  // smoke
        const sx = lx + 140, sy = deskY - 20 - i * 24
        s.push(curve([sx - 8, sy], [sx + (i % 2 ? 12 : -12), sy - 12], [sx + 6, sy - 24], 1, 0.25))
      }
      return s
    },
    station(rand) {
      const s = []
      const ground = H * 0.72
      s.push(curve([-10, H * 0.06], [W * 0.2, H * 0.13], [W * 0.42, H * 0.07], 3, 0.7))   // oak limbs
      s.push(curve([W + 10, H * 0.1], [W * 0.78, H * 0.19], [W * 0.6, H * 0.13], 2.4, 0.6))
      for (const mx of [W * 0.14, W * 0.3, W * 0.44, W * 0.72, W * 0.87]) {               // the moss
        for (let i = 0; i < 3; i++) {
          const sx = mx + (rand() - 0.5) * 22, sy = H * 0.1 + rand() * 24, len = 30 + rand() * 34
          s.push(curve([sx, sy], [sx + (rand() - 0.5) * 10, sy + len * 0.6], [sx + (rand() - 0.5) * 8, sy + len], 0.9, 0.5))
        }
      }
      s.push(seg(0, H * 0.24, W, H * 0.28, 1, 0.4))                                       // the wire
      s.push(seg(0, ground, W, ground, 2, 0.8))
      const tx = W * 0.28, ty = ground - 10, tw = W * 0.44, th = H * 0.26                  // the streetcar
      s.push(poly([[tx, ty], [tx, ty - th * 0.8], [tx + 26, ty - th], [tx + tw - 26, ty - th], [tx + tw, ty - th * 0.8], [tx + tw, ty], [tx, ty]], 1.8, 0.9))
      for (let i = 0; i < 8; i++) {                                                        // lit windows
        s.push(box(tx + 26 + i * (tw - 60) / 8, ty - th * 0.82, (tw - 60) / 8 - 8, th * 0.34, 1.3, 0.85))
      }
      s.push(box(tx + tw * 0.42, ty - th - 14, 40, 10, 1.4, 0.95))                         // route board
      s.push(seg(tx + tw * 0.62, ty - th, tx + tw * 0.78, H * 0.26, 1.4, 0.8))             // trolley pole
      s.push(ellipse(tx + 6, ty - th * 0.45, 6, 6, 1.4, 1, 10))                            // headlamp
      s.push(seg(tx + 4, ty - 6, tx + tw - 4, ty - 6, 1.4, 0.7))                           // skirt
      s.push(seg(0, ground + 30, W, ground + 22, 1.6, 0.6))                                // rails
      s.push(seg(0, ground + 52, W, ground + 40, 1.6, 0.6))
      s.push(seg(W * 0.82, ground + 18, W * 0.82, ground - 88, 1.8, 0.9))                  // the stop
      s.push(box(W * 0.8, ground - 102, 42, 14, 1.6, 0.95))
      s.push(...figureStrokes(W * 0.88, ground + 22, 118))
      return s
    },
    street(rand) {
      const s = []
      const ground = H * 0.7, balY = ground - H * 0.19
      s.push(seg(0, ground, W, ground, 2, 0.8))
      let x = -10
      while (x < W * 0.9) {                                                            // Creole facades
        const w = 150 + rand() * 120, hgt = H * 0.4
        s.push(poly([[x, ground], [x, ground - hgt], [x + w, ground - hgt], [x + w, ground]], 1.6, 0.7))
        for (let wx = x + 20; wx + 30 < x + w; wx += 52) {                             // shuttered French windows
          s.push(box(wx + 8, ground - hgt + 22, 14, 40, 1.4, rand() < 0.4 ? 1 : 0.6))
          s.push(box(wx, ground - hgt + 22, 6, 40, 1, 0.45))
          s.push(box(wx + 24, ground - hgt + 22, 6, 40, 1, 0.45))
        }
        x += w
      }
      s.push(seg(0, balY, W * 0.88, balY, 1.8, 0.9))                                   // gallery deck
      s.push(seg(0, balY - 24, W * 0.88, balY - 24, 1.4, 0.8))                         // top rail
      for (let bx = 0; bx < W * 0.88; bx += 11) s.push(seg(bx, balY - 24, bx, balY, 0.9, 0.5))
      for (let bx = 9; bx + 18 < W * 0.88; bx += 18) {                                 // the lace
        s.push(ellipse(bx + 9, balY - 13, 5.5, 5.5, 0.9, 0.6, 10, 0, Math.PI))
      }
      for (let px = 26; px < W * 0.88; px += 80) s.push(seg(px, balY, px, ground + 16, 1.8, 0.85))
      for (const lx of [W * 0.3, W * 0.68]) {                                          // gas lamps
        s.push(seg(lx, balY + 26, lx, balY + 44, 1.6, 0.95))
        s.push(box(lx - 5, balY + 44, 10, 14, 1.6, 1))
        s.push(ellipse(lx, ground, 54, 7, 1, 0.3))
      }
      for (let fx = 70; fx < W * 0.86; fx += 170) {                                    // ferns off the rail
        s.push(curve([fx, balY - 22], [fx - 12, balY - 4], [fx - 16, balY + 10], 1, 0.5))
        s.push(curve([fx, balY - 22], [fx + 10, balY - 2], [fx + 13, balY + 12], 1, 0.5))
      }
      s.push(...figureStrokes(W * 0.48, ground + 32, 140))
      for (let i = 0; i < 10; i++) {
        const rx = rand() * W, ry = rand() * H * 0.6
        s.push(seg(rx, ry, rx - 4, ry + 22, 0.8, 0.15))
      }
      return s
    },
    cafe(rand) {
      const s = []
      const ground = H * 0.8
      s.push(seg(0, ground, W, ground, 2, 0.8))
      s.push(seg(W * 0.03, H * 0.1, W * 0.97, H * 0.1, 1.8, 0.85))                     // awning top
      for (let i = 0; i < 14; i++) {                                                   // stripes falling
        const ax = W * 0.03 + (i / 14) * W * 0.94
        s.push(seg(ax, H * 0.1, ax - 5, H * 0.28, 1.2, i % 2 ? 0.35 : 0.7))
      }
      for (let i = 0; i < 14; i++) {                                                   // scallops
        const ax = W * 0.03 + (i + 0.5) * W * 0.94 / 14 - 5
        s.push(ellipse(ax, H * 0.28, W * 0.94 / 28, 10, 1.4, 0.8, 10, 0, Math.PI))
      }
      for (let px = W * 0.08; px < W * 0.98; px += W * 0.18) {                          // columns
        s.push(seg(px - 8, H * 0.28, px - 8, ground, 1.8, 0.85))
        s.push(seg(px + 8, H * 0.28, px + 8, ground, 1.4, 0.5))
      }
      for (let i = 0; i < 5; i++) {                                                     // globe lights
        const gx = W * (0.14 + i * 0.18)
        s.push(seg(gx, H * 0.3, gx, H * 0.37, 1.2, 0.7))
        s.push(ellipse(gx, H * 0.4, 6, 6, 1.4, 1, 12))
      }
      for (const tx of [W * 0.2, W * 0.44, W * 0.7]) {                                  // marble tables
        const ty = ground - 56
        s.push(ellipse(tx, ty, 30, 8, 1.6, 0.95))
        s.push(seg(tx, ty + 8, tx, ground - 6, 1.4, 0.8))
        s.push(ellipse(tx - 22, ty - 38, 9, 10, 1.4, 0.85))                             // company
        s.push(curve([tx - 36, ty - 2], [tx - 22, ty - 22], [tx - 8, ty - 2], 1.4, 0.85))
        s.push(box(tx - 12, ty - 7, 8, 5, 1.2, 0.9))                                    // the cups
        s.push(box(tx + 5, ty - 7, 8, 5, 1.2, 0.9))
        s.push(curve([tx, ty - 10], [tx + 6, ty - 22], [tx - 2, ty - 34], 0.9, 0.3))    // steam
      }
      s.push(...figureStrokes(W * 0.9, ground + 30, 135, 0.8))
      return s
    },
    yard(rand) {
      const s = []
      const deck = H * 0.64
      s.push(ellipse(W * 0.72, H * 0.2, 14, 14, 1.6, 0.95, 18))                          // the moon
      s.push(seg(0, H * 0.45, W, H * 0.45, 1.4, 0.5))                                    // far bank
      s.push(seg(0, deck, W, deck, 2, 0.85))                                             // wharf edge
      for (let i = 0; i < 8; i++) {                                                      // moon track
        const my = H * 0.47 + i * H * 0.02
        s.push(seg(W * 0.72 - 8 - rand() * 16, my, W * 0.72 + 8 + rand() * 12, my, 1, 0.3))
      }
      const sx = W * 0.16, sy = H * 0.52                                                 // the freighter
      s.push(poly([[sx - 18, sy], [sx + 188, sy], [sx + 174, sy - 26], [sx - 4, sy - 26], [sx - 18, sy]], 1.8, 0.85))
      s.push(box(sx + 42, sy - 48, 78, 22, 1.6, 0.8))
      s.push(box(sx + 58, sy - 62, 11, 15, 1.4, 0.8))
      s.push(box(sx + 86, sy - 62, 11, 15, 1.4, 0.8))
      s.push(seg(sx + 8, sy - 26, sx + 8, sy - 70, 1.2, 0.7))                            // masts + rigging
      s.push(seg(sx + 8, sy - 70, sx + 58, sy - 48, 1, 0.5))
      s.push(seg(sx + 158, sy - 26, sx + 158, sy - 60, 1.2, 0.7))
      for (let i = 0; i < 6; i++) {                                                      // plank lines
        s.push(seg(0, deck + 14 + i * 14, W, deck + 8 + i * 14, 1, 0.3))
      }
      for (const bx of [W * 0.14, W * 0.44, W * 0.74]) {                                 // bollards + rope
        s.push(box(bx - 8, deck - 4, 16, 20, 1.6, 0.9))
        s.push(ellipse(bx, deck - 5, 11, 5, 1.4, 0.9))
      }
      s.push(curve([W * 0.14, deck + 2], [W * 0.29, deck + 26], [W * 0.44, deck + 2], 1.4, 0.7))
      s.push(curve([W * 0.44, deck + 2], [W * 0.59, deck + 26], [W * 0.74, deck + 2], 1.4, 0.7))
      let cx = W * 0.78                                                                  // crates
      for (let i = 0; i < 2; i++) {
        const cw = 60 + rand() * 26, ch = 46 + rand() * 20
        s.push(box(cx, deck + 30 - ch, cw, ch, 1.6, 0.85))
        s.push(seg(cx + 4, deck + 34 - ch, cx + cw - 4, deck + 26, 1, 0.5))
        cx += cw * 0.5
      }
      s.push(seg(W * 0.55, deck, W * 0.55, H * 0.28, 1.8, 0.8))                          // crane
      s.push(seg(W * 0.55, H * 0.28, W * 0.38, H * 0.34, 1.8, 0.8))
      s.push(seg(W * 0.38, H * 0.34, W * 0.38, H * 0.46, 1, 0.5))
      s.push(seg(W * 0.31, deck + 2, W * 0.31, deck - 58, 1.8, 0.9))                     // lantern post
      s.push(ellipse(W * 0.31, deck - 64, 6, 7, 1.6, 1, 12))
      s.push(...figureStrokes(W * 0.5, deck + 42, 96, 0.75))
      return s
    },
    epilogue(rand) {
      const s = []
      const ground = H * 0.74, cx = W * 0.5
      s.push(ellipse(cx, ground - 60, 130, 60, 1.4, 0.4, 24, Math.PI, Math.PI * 2))      // dawn glow
      s.push(seg(0, ground, W, ground, 2, 0.8))
      s.push(box(cx - 120, ground - 120, 240, 120, 1.8, 0.8))                            // the cathedral
      for (const [ox, sh, bw] of [[-88, 60, 30], [88, 60, 30], [0, 120, 38]]) {          // three spires
        s.push(box(cx + ox - bw / 2, ground - 130 - sh * 0.3, bw, 130 + sh * 0.3, 1.6, 0.8))
        s.push(poly([[cx + ox - bw / 2 - 6, ground - 130 - sh * 0.3], [cx + ox, ground - 150 - sh],
                     [cx + ox + bw / 2 + 6, ground - 130 - sh * 0.3]], 1.6, 0.9))
        s.push(seg(cx + ox, ground - 150 - sh, cx + ox, ground - 162 - sh, 1.4, 0.95))   // the cross
        s.push(seg(cx + ox - 5, ground - 157 - sh, cx + ox + 5, ground - 157 - sh, 1.4, 0.95))
      }
      s.push(ellipse(cx, ground - 96, 10, 10, 1.6, 0.95, 14))                            // clock
      s.push(poly([[0, ground - 70], [W * 0.15, ground - 96], [W * 0.3, ground - 70]], 1.4, 0.6))
      s.push(poly([[W * 0.7, ground - 70], [W * 0.85, ground - 96], [W, ground - 70]], 1.4, 0.6))
      s.push(seg(0, ground - 70, W * 0.3, ground - 70, 1.4, 0.6))
      s.push(seg(W * 0.7, ground - 70, W, ground - 70, 1.4, 0.6))
      s.push(seg(0, ground + 30, W, ground + 30, 1.6, 0.8))                              // the fence
      for (let px = 8; px < W; px += 14) {
        if (px > W * 0.46 && px < W * 0.54) continue
        s.push(seg(px, ground + 10, px, ground + 30, 0.9, 0.5))
      }
      for (const lx of [W * 0.42, W * 0.58]) {                                           // gate lamps
        s.push(seg(lx, ground + 30, lx, ground - 24, 1.6, 0.85))
        s.push(ellipse(lx, ground - 30, 6, 7, 1.4, 1, 12))
      }
      for (const [bx, dir] of [[14, 1], [W - 14, -1]]) {                                 // banana fronds
        for (let i = 0; i < 3; i++) {
          s.push(curve([bx, H], [bx + dir * (40 + i * 30), H - 130 - i * 20], [bx + dir * (90 + i * 46), H - 90 - i * 34], 1.8, 0.6))
        }
      }
      s.push(...figureStrokes(cx, ground + 62, 118, 0.85))
      return s
    },
  },
}

/** Build a line scene: ordered strokes, deterministic per (kind, era, seed). */
export function buildLineScene(kind, era = 'berlin-1938', seed = '') {
  const make = eraBuilders[era]?.[kind] ?? builders[kind] ?? builders.street
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
