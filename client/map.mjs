// map.mjs — the city, wireframed (notebook panel).
//
// A stylized noir wireframe per era — Berlin's grid and canal, Paris's
// radials and river, New Orleans's crescent, the Meridian's one road and
// rail line — drawn in the era accent over ink. Markers ride the same
// data as the notebook: a filled point is a place you've been (a dossier
// you hold); a hollow point is a place you've only heard about (an open
// lead). Deterministic per case: the same case always maps the same city.

const W = 240, H = 190

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

const line = (ctx, x1, y1, x2, y2, alpha = 0.5, width = 1) => {
  ctx.globalAlpha = alpha
  ctx.lineWidth = width
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
  ctx.globalAlpha = 1
}

const wireframes = {
  'berlin-1938'(ctx, rand) {
    // grid quarters + a diagonal boulevard + the river's slow S
    for (let x = 18; x < W; x += 24 + rand() * 10) line(ctx, x, 12, x + rand() * 8 - 4, H - 12, 0.28)
    for (let y = 20; y < H; y += 26 + rand() * 8) line(ctx, 10, y, W - 10, y + rand() * 6 - 3, 0.28)
    line(ctx, 8, H * 0.72, W * 0.55, H * 0.30, 0.6, 1.5)              // boulevard
    line(ctx, W * 0.55, H * 0.30, W - 8, H * 0.18, 0.6, 1.5)
    ctx.globalAlpha = 0.7; ctx.lineWidth = 2.5
    ctx.beginPath(); ctx.moveTo(6, H * 0.42)
    ctx.bezierCurveTo(W * 0.3, H * 0.55, W * 0.55, H * 0.28, W - 6, H * 0.45)
    ctx.stroke(); ctx.globalAlpha = 1                                  // the Spree
  },
  'paris-1954'(ctx, rand) {
    const cx = W * 0.46, cy = H * 0.44
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rand() * 0.2
      line(ctx, cx, cy, cx + Math.cos(a) * W * 0.6, cy + Math.sin(a) * H * 0.7, 0.35)
    }
    for (const r of [0.18, 0.34, 0.52]) {
      ctx.globalAlpha = 0.3
      ctx.beginPath(); ctx.ellipse(cx, cy, W * r, H * r, 0, 0, Math.PI * 2); ctx.stroke()
      ctx.globalAlpha = 1
    }
    ctx.globalAlpha = 0.7; ctx.lineWidth = 2.5
    ctx.beginPath(); ctx.moveTo(4, H * 0.62)
    ctx.bezierCurveTo(W * 0.35, H * 0.5, W * 0.6, H * 0.75, W - 4, H * 0.58)
    ctx.stroke(); ctx.globalAlpha = 1                                  // the Seine
  },
  'neworleans-1968'(ctx, rand) {
    // the crescent: streets bent along the river's arc
    ctx.globalAlpha = 0.75; ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(4, H * 0.9)
    ctx.bezierCurveTo(W * 0.3, H * 0.55, W * 0.7, H * 0.55, W - 4, H * 0.92)
    ctx.stroke(); ctx.globalAlpha = 1                                  // the river
    for (let i = 1; i <= 5; i++) {
      const t = i / 6
      ctx.globalAlpha = 0.3
      ctx.beginPath(); ctx.moveTo(8, H * 0.9 - t * H * 0.62)
      ctx.bezierCurveTo(W * 0.3, H * 0.55 - t * H * 0.42, W * 0.7, H * 0.55 - t * H * 0.42, W - 8, H * 0.92 - t * H * 0.64)
      ctx.stroke(); ctx.globalAlpha = 1
    }
    for (let i = 0; i < 8; i++) {
      const x = 20 + (i / 7) * (W - 40) + rand() * 6
      line(ctx, x, H * 0.16, x + rand() * 10 - 5, H * 0.86, 0.25)
    }
  },
  'meridian-1849'(ctx, rand) {
    line(ctx, 4, H * 0.62, W - 4, H * 0.5, 0.6, 1.5)                  // the road
    ctx.setLineDash([5, 4])
    line(ctx, 4, H * 0.7, W - 4, H * 0.6, 0.45, 1)                    // the rail survey
    ctx.setLineDash([])
    for (let i = 0; i < 14; i++) {                                     // terrain
      const x = 12 + rand() * (W - 24), y = 14 + rand() * (H * 0.4)
      line(ctx, x, y, x + 6 + rand() * 8, y - 3 - rand() * 4, 0.3)
    }
    ctx.globalAlpha = 0.35
    ctx.beginPath(); ctx.moveTo(W * 0.7, 8)
    ctx.bezierCurveTo(W * 0.62, H * 0.3, W * 0.8, H * 0.5, W * 0.72, H - 8)
    ctx.stroke(); ctx.globalAlpha = 1                                  // dry river
  },
}

/** Draw the case map: base wireframe + one marker per known place. */
export function drawMap(canvas, era, caseId, spots) {
  const dpr = 2
  canvas.width = W * dpr; canvas.height = H * dpr
  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#c39a56'
  ctx.clearRect(0, 0, W, H)
  ctx.strokeStyle = accent
  ;(wireframes[era] ?? wireframes['berlin-1938'])(ctx, mulberry32(hash(era + '|' + caseId)))

  for (const spot of spots) {
    const h = hash(caseId + '|' + spot.id)
    const x = 22 + (h % 1000) / 1000 * (W - 44)
    const y = 26 + ((h >> 10) % 1000) / 1000 * (H - 52)
    ctx.fillStyle = accent
    ctx.strokeStyle = accent
    if (spot.visited) {
      ctx.globalAlpha = 0.9
      ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill()
      const glow = ctx.createRadialGradient(x, y, 0, x, y, 9)
      glow.addColorStop(0, accent + '55'); glow.addColorStop(1, accent + '00')
      ctx.fillStyle = glow; ctx.fillRect(x - 9, y - 9, 18, 18)
    } else {
      ctx.globalAlpha = 0.6
      ctx.lineWidth = 1.2
      ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.stroke()
    }
    ctx.globalAlpha = spot.visited ? 0.85 : 0.45
    ctx.fillStyle = accent
    ctx.font = '8px monospace'
    const label = spot.name.length > 22 ? spot.name.slice(0, 21) + '…' : spot.name
    ctx.fillText(label, Math.min(x + 6, W - label.length * 4.6), y + 3)
    ctx.globalAlpha = 1
  }
}
