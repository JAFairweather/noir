// map.mjs — the city as a board (DECISIONS §8, map-as-board v2).
//
// The map is a street GRAPH, not a picture: nodes and edges per era, and
// everything on the board lives on the streets. The red dot is you — on
// every move it walks the actual streets (BFS shortest path) while the
// dispatch types, like a car on a track. Markers carry the case's state:
//
//   red dot          — the player, traveling or arrived
//   white dot        — a venue that has emerged as important (held dossier)
//   accent dot       — a person: sources and actors, in the era's color
//   hollow circle    — a lead: a place you've only heard about
//   faint ring       — an iconic city spot, pre-marked, part of the town
//
// Deterministic per (era, caseId): the same case maps the same city, and
// the same dossier always lands on the same corner.

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

// ------------------------------------------------------- street lattices
// Each builder returns { nodes: [[x,y]], edges: [[a,b]], streets: [idx[]],
// mains: [idx[]], deco(ctx), iconic: [{name, node}] }. Streets are
// node-index polylines and edges follow them, so a path through the
// graph is a path along drawn ink.

function lattice(cols, rows, pos) {
  const nodes = [], id = (i, j) => j * cols + i
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) nodes.push(pos(i, j))
  const edges = [], streets = []
  for (let j = 0; j < rows; j++) {                       // rows as streets
    const line = []
    for (let i = 0; i < cols; i++) {
      line.push(id(i, j))
      if (i) edges.push([id(i - 1, j), id(i, j)])
    }
    streets.push(line)
  }
  for (let i = 0; i < cols; i++) {                       // columns as streets
    const line = []
    for (let j = 0; j < rows; j++) {
      line.push(id(i, j))
      if (j) edges.push([id(i, j - 1), id(i, j)])
    }
    streets.push(line)
  }
  return { nodes, edges, streets, id }
}

const graphs = {
  'berlin-1938'(rand) {
    const cols = 6, rows = 5
    const g = lattice(cols, rows, (i, j) => [
      20 + i * ((W - 40) / (cols - 1)) + (rand() - 0.5) * 8,
      20 + j * ((H - 44) / (rows - 1)) + (rand() - 0.5) * 7,
    ])
    const main = []                                       // the boulevard, diagonal
    for (let k = 0; k < Math.min(cols, rows); k++) main.push(g.id(k, rows - 1 - k))
    for (let k = 1; k < main.length; k++) g.edges.push([main[k - 1], main[k]])
    return {
      ...g, mains: [main],
      deco(ctx) {                                         // the Spree
        ctx.globalAlpha = 0.55; ctx.lineWidth = 2.5
        ctx.beginPath(); ctx.moveTo(6, H * 0.42)
        ctx.bezierCurveTo(W * 0.3, H * 0.55, W * 0.55, H * 0.28, W - 6, H * 0.45)
        ctx.stroke(); ctx.globalAlpha = 1
      },
      iconic: [
        { name: 'BAHNHOF ZOO', node: g.id(1, 1) },
        { name: 'TIERGARTEN', node: g.id(3, 2) },
        { name: 'ALEXANDERPL.', node: g.id(cols - 1, 0) },
      ],
    }
  },

  'neworleans-1968'(rand) {
    const cols = 7, rows = 4
    const bend = (x) => Math.sin((x / W) * Math.PI) * H * 0.16
    const g = lattice(cols, rows, (i, j) => {
      const x = 16 + i * ((W - 32) / (cols - 1)) + (rand() - 0.5) * 6
      return [x, H * 0.78 - bend(x) - j * H * 0.155 + (rand() - 0.5) * 5]
    })
    return {
      ...g, mains: [g.streets[0]],                        // the riverfront street
      deco(ctx) {                                         // the river
        ctx.globalAlpha = 0.6; ctx.lineWidth = 3
        ctx.beginPath(); ctx.moveTo(4, H * 0.94)
        ctx.bezierCurveTo(W * 0.3, H * 0.62, W * 0.7, H * 0.62, W - 4, H * 0.96)
        ctx.stroke(); ctx.globalAlpha = 1
      },
      iconic: [
        { name: 'JACKSON SQ', node: g.id(3, 0) },
        { name: 'CANAL ST', node: g.id(0, 2) },
        { name: 'ESPLANADE', node: g.id(cols - 1, 2) },
      ],
    }
  },

  'paris-1954'(rand) {
    const spokes = 8, rings = 3
    const cx = W * 0.48, cy = H * 0.46
    const nodes = [[cx, cy]], edges = [], streets = []
    const id = (k, r) => 1 + r * spokes + k
    for (let r = 0; r < rings; r++) {
      for (let k = 0; k < spokes; k++) {
        const a = (k / spokes) * Math.PI * 2 + 0.12 + (rand() - 0.5) * 0.06
        const rad = (r + 1) / rings
        nodes.push([cx + Math.cos(a) * W * 0.42 * rad, cy + Math.sin(a) * H * 0.44 * rad])
      }
    }
    for (let k = 0; k < spokes; k++) {                    // radials
      const line = [0]
      for (let r = 0; r < rings; r++) {
        line.push(id(k, r))
        edges.push([r ? id(k, r - 1) : 0, id(k, r)])
      }
      streets.push(line)
    }
    for (let r = 0; r < rings; r++) {                     // rings
      const line = []
      for (let k = 0; k <= spokes; k++) {
        line.push(id(k % spokes, r))
        if (k) edges.push([id((k - 1) % spokes, r), id(k % spokes, r)])
      }
      streets.push(line)
    }
    return {
      nodes, edges, streets, mains: [streets[spokes]],
      deco(ctx) {                                         // the Seine
        ctx.globalAlpha = 0.6; ctx.lineWidth = 2.5
        ctx.beginPath(); ctx.moveTo(4, H * 0.64)
        ctx.bezierCurveTo(W * 0.35, H * 0.5, W * 0.6, H * 0.76, W - 4, H * 0.6)
        ctx.stroke(); ctx.globalAlpha = 1
      },
      iconic: [
        { name: 'ÉTOILE', node: 0 },
        { name: 'LES HALLES', node: id(1, 1) },
        { name: 'RIVE GAUCHE', node: id(4, 2) },
      ],
    }
  },

  'meridian-1849'(rand) {
    const n = 8
    const nodes = [], edges = [], road = []
    for (let i = 0; i < n; i++) {
      nodes.push([10 + i * ((W - 20) / (n - 1)), H * 0.62 - i * 2 + (rand() - 0.5) * 8])
      road.push(i)
      if (i) edges.push([i - 1, i])
    }
    const spurs = []
    for (const [at, dx, dy] of [[2, -6, -H * 0.28], [5, 10, H * 0.24]]) {
      const a = nodes.length
      nodes.push([nodes[at][0] + dx, nodes[at][1] + dy])
      edges.push([at, a]); spurs.push([at, a])
    }
    return {
      nodes, edges, streets: [road, ...spurs], mains: [road],
      deco(ctx) {                                         // rail survey + dry river
        ctx.setLineDash([5, 4]); ctx.globalAlpha = 0.45
        ctx.beginPath(); ctx.moveTo(4, H * 0.72); ctx.lineTo(W - 4, H * 0.62); ctx.stroke()
        ctx.setLineDash([]); ctx.globalAlpha = 0.35
        ctx.beginPath(); ctx.moveTo(W * 0.7, 8)
        ctx.bezierCurveTo(W * 0.62, H * 0.3, W * 0.8, H * 0.5, W * 0.72, H - 8)
        ctx.stroke(); ctx.globalAlpha = 1
      },
      iconic: [
        { name: 'THE WELLS', node: 2 },
        { name: 'SURVEY CAMP', node: n - 1 },
      ],
    }
  },
}

// --------------------------------------------------------------- the board

export class CityMap {
  constructor(canvas) {
    this.canvas = canvas
    this.spots = []
    this.playerNode = null
    this.path = null            // [nodeIdx...] while traveling
    this.pathT = 0
    this.raf = 0
  }

  setCase(era, caseId) {
    this.era = era
    this.caseId = caseId
    const make = graphs[era] ?? graphs['berlin-1938']
    this.g = make(mulberry32(hash(era + '|' + caseId)))
    this.playerNode = null
    this.path = null
    this.draw()
  }

  nodeFor(id) {
    return hash(this.caseId + '|' + id) % this.g.nodes.length
  }

  /** spots: [{ id, name, type: 'venue'|'person'|'lead' }] */
  setSpots(spots) {
    this.spots = spots
    this.draw()
  }

  /** The red dot walks the streets to a spot. Instant on restore. */
  travelTo(id, { instant = false } = {}) {
    if (!this.g) return
    const target = this.nodeFor(id)
    if (this.playerNode == null || instant ||
        matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.playerNode = target
      this.path = null
      this.draw()
      return
    }
    if (target === this.playerNode && !this.path) return
    const path = this._route(this.path ? this.path[this.path.length - 1] : this.playerNode, target)
    this.playerNode = target                     // logical position is the destination
    if (!path || path.length < 2) { this.path = null; this.draw(); return }
    this.path = path
    this.pathT = 0
    this._animate()
  }

  _route(from, to) {
    const adj = new Map()
    for (const [a, b] of this.g.edges) {
      if (!adj.has(a)) adj.set(a, [])
      if (!adj.has(b)) adj.set(b, [])
      adj.get(a).push(b); adj.get(b).push(a)
    }
    const prev = new Map([[from, null]])
    const q = [from]
    while (q.length) {
      const n = q.shift()
      if (n === to) break
      for (const m of adj.get(n) ?? []) {
        if (!prev.has(m)) { prev.set(m, n); q.push(m) }
      }
    }
    if (!prev.has(to)) return null
    const path = []
    for (let n = to; n != null; n = prev.get(n)) path.push(n)
    return path.reverse()
  }

  _animate() {
    if (this.raf) cancelAnimationFrame(this.raf)
    const hops = this.path.length - 1
    const dur = Math.min(9000, 1400 + hops * 900)          // longer trips take longer
    const t0 = performance.now()
    const step = (now) => {
      this.pathT = Math.max(0, Math.min(1, (now - t0) / dur))   // rAF timestamps can predate t0
      this.draw()
      if (this.pathT < 1) this.raf = requestAnimationFrame(step)
      else { this.path = null; this.raf = 0; this.draw() }
    }
    this.raf = requestAnimationFrame(step)
  }

  _playerXY() {
    if (!this.path) return this.g.nodes[this.playerNode]
    const hops = this.path.length - 1
    const at = this.pathT * hops
    const i = Math.min(hops - 1, Math.floor(at))
    const f = at - i
    const [ax, ay] = this.g.nodes[this.path[i]]
    const [bx, by] = this.g.nodes[this.path[i + 1]]
    return [ax + (bx - ax) * f, ay + (by - ay) * f]
  }

  draw() {
    const canvas = this.canvas
    if (!canvas || !this.g) return
    const dpr = 2
    canvas.width = W * dpr; canvas.height = H * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#c39a56'
    ctx.clearRect(0, 0, W, H)

    // the streets
    ctx.strokeStyle = accent
    ctx.lineCap = 'round'
    for (const street of this.g.streets) {
      ctx.globalAlpha = 0.26; ctx.lineWidth = 1
      ctx.beginPath()
      street.forEach((n, i) => {
        const [x, y] = this.g.nodes[n]
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
      })
      ctx.stroke()
    }
    for (const main of this.g.mains ?? []) {               // the boulevard reads heavier
      ctx.globalAlpha = 0.5; ctx.lineWidth = 1.8
      ctx.beginPath()
      main.forEach((n, i) => {
        const [x, y] = this.g.nodes[n]
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
      })
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    this.g.deco?.(ctx)

    // iconic city spots: part of the town, not the case
    ctx.font = '7px monospace'
    for (const spot of this.g.iconic ?? []) {
      const [x, y] = this.g.nodes[spot.node]
      ctx.strokeStyle = accent; ctx.globalAlpha = 0.4; ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.stroke()
      ctx.fillStyle = accent; ctx.globalAlpha = 0.35
      ctx.fillText(spot.name, Math.min(x + 6, W - spot.name.length * 4.2), y - 4)
      ctx.globalAlpha = 1
    }

    // case markers: white venues, accent people, hollow leads
    ctx.font = '8px monospace'
    for (const spot of this.spots) {
      const [x, y] = this.g.nodes[this.nodeFor(spot.id)]
      if (spot.type === 'lead') {
        ctx.strokeStyle = accent; ctx.globalAlpha = 0.6; ctx.lineWidth = 1.2
        ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.stroke()
      } else if (spot.type === 'person') {
        ctx.fillStyle = accent; ctx.globalAlpha = 0.95
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill()
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 9)
        glow.addColorStop(0, accent + '66'); glow.addColorStop(1, accent + '00')
        ctx.fillStyle = glow; ctx.fillRect(x - 9, y - 9, 18, 18)
      } else {                                             // venue: clear white
        ctx.fillStyle = '#efe9dc'; ctx.globalAlpha = 0.95
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill()
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 9)
        glow.addColorStop(0, 'rgba(239,233,220,0.4)'); glow.addColorStop(1, 'rgba(239,233,220,0)')
        ctx.fillStyle = glow; ctx.fillRect(x - 9, y - 9, 18, 18)
      }
      ctx.globalAlpha = spot.type === 'lead' ? 0.45 : 0.8
      ctx.fillStyle = spot.type === 'venue' ? '#efe9dc' : accent
      const label = spot.name.length > 20 ? spot.name.slice(0, 19) + '…' : spot.name
      ctx.fillText(label, Math.min(x + 6, W - label.length * 4.6), y + 3)
      ctx.globalAlpha = 1
    }

    // the red dot: you
    if (this.playerNode != null) {
      const [x, y] = this._playerXY()
      const glow = ctx.createRadialGradient(x, y, 0, x, y, 11)
      glow.addColorStop(0, 'rgba(214,69,50,0.55)'); glow.addColorStop(1, 'rgba(214,69,50,0)')
      ctx.fillStyle = glow; ctx.fillRect(x - 11, y - 11, 22, 22)
      ctx.fillStyle = '#d64532'
      ctx.beginPath(); ctx.arc(x, y, 3.4, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = 'rgba(214,69,50,0.7)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(x, y, 5.6, 0, Math.PI * 2); ctx.stroke()
    }
  }
}
