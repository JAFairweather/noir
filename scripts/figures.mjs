// figures.mjs — renders the eight STACK.md figures (docs/STACK.md §8) as
// self-contained SVGs in docs/figures/. Regenerate after edits:
//   node scripts/figures.mjs
// One palette, one type family, no dependencies — the diagrams are code
// so they stay true when the architecture moves.

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'docs', 'figures')
mkdirSync(OUT, { recursive: true })

const C = {
  ink: '#0d0a07', panel: '#171106', panel2: '#1d1508',
  gold: '#c39a56', dim: '#6b5530', cream: '#f4efe4',
  red: '#d64532', green: '#9fd08a', faint: '#3a2e18',
}
const F = 'Courier New, Courier, monospace'
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const markers = ['gold', 'dim', 'red', 'green', 'cream'].map(k =>
  `<marker id="arr-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
     <path d="M0,0 L10,5 L0,10 z" fill="${C[k]}"/></marker>`).join('\n')

const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${F}">
<defs>${markers}</defs>
<rect width="100%" height="100%" fill="${C.ink}"/>
${body}
</svg>`

const box = (x, y, w, h, { stroke = C.gold, fill = C.panel, dash = '', sw = 1.2 } = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${dash ? `stroke-dasharray="${dash}"` : ''} rx="2"/>`

const txt = (x, y, s, { size = 13, fill = C.cream, anchor = 'start', ls = 0, bold = false } = {}) =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${ls}" ${bold ? 'font-weight="bold"' : ''}>${esc(s)}</text>`

const lines = (x, y, arr, { size = 12, fill = C.gold, lh = 17, anchor = 'start' } = {}) =>
  arr.map((s, i) => txt(x, y + i * lh, s, { size, fill, anchor })).join('\n')

const arrow = (x1, y1, x2, y2, { color = 'gold', dash = '', width = 1.4 } = {}) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C[color]}" stroke-width="${width}" ${dash ? `stroke-dasharray="${dash}"` : ''} marker-end="url(#arr-${color})"/>`

const line = (x1, y1, x2, y2, { color = 'dim', dash = '', width = 1 } = {}) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C[color]}" stroke-width="${width}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`

const vtext = (x, y, s, { size = 13, fill = C.dim, ls = 4 } = {}) =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" letter-spacing="${ls}" transform="rotate(-90 ${x} ${y})" text-anchor="middle">${esc(s)}</text>`

const caption = (w, h, n, title) =>
  txt(24, h - 18, `FIG. ${n} — ${title}`, { size: 11, fill: C.dim, ls: 2 })

// ------------------------------------------------------------------ fig 1
function fig1() {
  const W = 980, H = 660
  const X = 60, BW = 830
  let b = ''
  // layer 0
  b += box(X, 545, BW, 60)
  b += txt(X + 16, 570, 'LAYER 0 — NOSTR', { fill: C.cream, ls: 2 })
  b += txt(X + 16, 592, 'keypair identity · dumb, replaceable relays · signed self-authenticating events', { size: 12, fill: C.gold })
  // layer 1
  b += box(X, 445, BW, 70)
  b += txt(X + 16, 470, 'LAYER 1 — NIP-DA · SCOPED DATA GRANTS', { fill: C.cream, ls: 2 })
  b += lines(X + 16, 492, ['30440 scope (encrypted, addressable) · 440 grant in a 1059 wrap · 10440 self-encrypted index', 'rotation = update AND revocation · the signer interface (NIP-07-shaped)'], { size: 12 })
  // layer 2
  b += box(X, 310, BW, 105)
  b += txt(X + 16, 335, 'LAYER 2 — THE N-FAMILY', { fill: C.cream, ls: 2 })
  const chips = [
    ['NONTACT', 'emergent views'], ['NVELOPE', 'blob scale'], ['NVOY', 'delegation'],
    ['NHERIT', 'succession'], ['NTRIGUE', 'secrets as stakes'], ['NOTEGATE', 'anonymous intake'],
  ]
  chips.forEach(([name, sub], i) => {
    const cx = X + 16 + i * 134
    b += box(cx, 350, 122, 46, { fill: C.panel2 })
    b += txt(cx + 61, 370, name, { size: 11, fill: C.cream, anchor: 'middle', ls: 1 })
    b += txt(cx + 61, 387, sub, { size: 9.5, fill: C.dim, anchor: 'middle' })
  })
  // layer 3 — noir
  b += box(X, 80, BW, 195, { sw: 1.6 })
  b += txt(X + 16, 108, 'LAYER 3 — NOIR · THE SPEAKEASY', { fill: C.cream, ls: 2, bold: true })
  b += txt(X + 16, 128, 'the game about scoped data grants, operated through scoped data grants', { size: 11, fill: C.dim })
  const subs = [
    ['THE ENGINE', ['deterministic skeleton', 'scopes · edges · burns', 'heat · accusation', 'commitment'], C.gold],
    ['THE DIRECTOR', ['generative voice', 'info-starved: context', 'pack only · fails soft', 'a delegated nvoy agent'], C.gold],
    ['THE NOTARY', ['the verifier', 'structure · fairness', 'replay-to-epilogue', 'commitment integrity'], C.green],
  ]
  subs.forEach(([name, ls_, stroke], i) => {
    const cx = X + 16 + i * 272
    b += box(cx, 142, 254, 116, { fill: C.panel2, stroke })
    b += txt(cx + 127, 165, name, { size: 13, fill: C.cream, anchor: 'middle', ls: 2 })
    b += lines(cx + 127, 186, ls_, { size: 11, anchor: 'middle', lh: 16 })
  })
  // rising arrows
  ;[[530, 545, 515], [530, 445, 415], [530, 310, 275]].forEach(([x, y1, y2]) => { b += arrow(x, y1, x, y2, { color: 'dim' }) })
  b += vtext(935, 330, 'physics by commitment · flesh by language', { fill: C.gold })
  b += caption(W, H, 1, 'THE LAYER CAKE')
  return svg(W, H, b)
}

// ------------------------------------------------------------------ fig 2
function fig2() {
  const W = 980, H = 640
  let b = ''
  // publisher
  b += box(40, 50, 300, 60)
  b += txt(190, 75, 'PUBLISHER', { anchor: 'middle', ls: 2 })
  b += txt(190, 95, "master nsec — or a NIP-07 signer", { size: 11, fill: C.gold, anchor: 'middle' })
  b += box(40, 140, 140, 52, { fill: C.panel2 })
  b += lines(110, 162, ['scope key', 'random 32 B'], { size: 11, anchor: 'middle', lh: 15 })
  b += txt(190, 172, '⊕', { size: 18, fill: C.dim, anchor: 'middle' })
  b += box(200, 140, 140, 52, { fill: C.panel2 })
  b += lines(270, 162, ['payload', '(JSON)'], { size: 11, anchor: 'middle', lh: 15 })
  b += arrow(190, 192, 190, 240, { color: 'gold' })
  // 30440
  b += box(40, 240, 300, 118, { sw: 1.6 })
  b += txt(190, 264, 'kind 30440 — SCOPED DATA SET', { size: 12, anchor: 'middle', ls: 1 })
  b += lines(58, 288, ['d  = opaque scope id', 'v  = generation', 'content = NIP-44 v2 ciphertext', '          under the scope key'], { size: 12, lh: 17 })
  b += arrow(340, 300, 430, 300, { color: 'dim' })
  b += txt(385, 290, 'publish', { size: 10, fill: C.dim, anchor: 'middle' })
  // wrap (nested)
  b += box(560, 50, 380, 310, { sw: 1.6 })
  b += txt(750, 74, 'kind 1059 — GIFT WRAP', { size: 12, anchor: 'middle', ls: 1 })
  b += lines(750, 92, ['signed by an EPHEMERAL key · p = grantee', 'created_at fuzzed up to 2 days'], { size: 10, fill: C.dim, anchor: 'middle', lh: 14 })
  b += box(580, 128, 340, 212, { fill: C.panel2, dash: '5 3' })
  b += txt(750, 150, 'kind 13 — SEAL', { size: 12, anchor: 'middle', ls: 1 })
  b += txt(750, 166, 'signed by the PUBLISHER · nip44 to grantee', { size: 10, fill: C.dim, anchor: 'middle' })
  b += box(600, 182, 300, 140, { stroke: C.green })
  b += txt(750, 204, 'kind 440 — GRANT RUMOR (unsigned)', { size: 11, fill: C.cream, anchor: 'middle' })
  b += lines(616, 226, ['scope_key (b64) · scope_name', 'a = 30440:<publisher>:<scope id>', 'v = generation pinned', 'nvoy { purpose, expires_at, … }'], { size: 11, lh: 17 })
  b += arrow(340, 80, 560, 80, { color: 'dim' })
  b += txt(450, 70, 'grant (wrap → relay)', { size: 10, fill: C.dim, anchor: 'middle' })
  // relay band
  b += box(430, 270, 100, 60, { dash: '4 3', stroke: C.dim })
  b += txt(480, 296, 'RELAYS', { size: 11, fill: C.dim, anchor: 'middle', ls: 2 })
  b += txt(480, 312, 'ciphertext', { size: 9, fill: C.dim, anchor: 'middle' })
  b += arrow(750, 360, 750, 410, { color: 'gold' })
  // grantee flow
  b += box(40, 410, 900, 150, { stroke: C.gold })
  b += txt(490, 436, 'GRANTEE', { anchor: 'middle', ls: 3 })
  const steps = [
    ['unwrap', '1059 → 13 → 440', 'gold'],
    ['dereference', 'fetch 30440 by (publisher, d)', 'gold'],
    ['decrypt', 'the CURRENT generation', 'green'],
  ]
  steps.forEach(([t, s, stroke], i) => {
    const cx = 70 + i * 300
    b += box(cx, 456, 250, 74, { fill: C.panel2, stroke: C[stroke] })
    b += txt(cx + 125, 484, t, { size: 13, anchor: 'middle', ls: 1 })
    b += txt(cx + 125, 506, s, { size: 11, fill: C.gold, anchor: 'middle' })
    if (i < 2) b += arrow(cx + 250, 493, cx + 300, 493, { color: 'gold' })
  })
  b += txt(490, 550, 'a newer generation than the grant pins → stale: revoked, or rotated past you', { size: 11, fill: C.dim, anchor: 'middle' })
  b += caption(W, H, 2, 'ANATOMY OF A GRANT')
  return svg(W, H, b)
}

// ------------------------------------------------------------------ fig 3
function fig3() {
  const W = 980, H = 520
  let b = ''
  b += arrow(60, 80, 920, 80, { color: 'dim' })
  b += txt(910, 66, 'time', { size: 11, fill: C.dim, anchor: 'end', ls: 2 })
  // gen 1
  b += box(90, 120, 300, 110)
  b += txt(240, 146, 'SCOPE — generation 1', { anchor: 'middle', ls: 1 })
  b += lines(240, 170, ['encrypted under key K1', 'granted → A, B'], { size: 12, anchor: 'middle', lh: 18 })
  // rotation
  b += line(480, 100, 480, 360, { color: 'gold', dash: '6 4', width: 1.4 })
  b += lines(480, 116, ['rotateScope'], { size: 12, fill: C.cream, anchor: 'middle' })
  b += lines(480, 378, ['new key K2 · republish · re-grant survivors: [A]'], { size: 11, anchor: 'middle' })
  // gen 2
  b += box(570, 130, 300, 110)
  b += txt(720, 156, 'SCOPE — generation 2', { anchor: 'middle', ls: 1 })
  b += lines(720, 180, ['encrypted under key K2', 'granted → A'], { size: 12, anchor: 'middle', lh: 18 })
  // gen 1 (moved to match)
  // A
  b += box(120, 300, 140, 46, { stroke: C.green })
  b += txt(190, 328, 'A — survivor', { size: 12, fill: C.green, anchor: 'middle' })
  b += arrow(200, 300, 230, 242, { color: 'green' })
  b += arrow(260, 314, 650, 244, { color: 'green' })
  // B
  b += box(720, 300, 150, 46, { stroke: C.red })
  b += txt(795, 328, 'B — revoked', { size: 12, fill: C.red, anchor: 'middle' })
  b += arrow(730, 300, 320, 244, { color: 'green', dash: '5 3' })
  b += arrow(810, 300, 800, 244, { color: 'red' })
  b += txt(190, 372, 'K1 still opens generation 1 —', { size: 11, fill: C.dim, anchor: 'middle' })
  b += txt(190, 388, 'B keeps exactly what was already read', { size: 11, fill: C.dim, anchor: 'middle' })
  b += txt(795, 372, 'K1 fails the MAC on gen 2', { size: 11, fill: C.red, anchor: 'middle' })
  b += txt(795, 388, '→ NVOY_GRANT_REVOKED', { size: 11, fill: C.red, anchor: 'middle' })
  b += txt(490, 436, 'No ACL. No policy server. No token to expire.', { size: 14, fill: C.cream, anchor: 'middle', ls: 1 })
  b += txt(490, 460, 'Access is whether your key opens the current ciphertext.', { size: 13, fill: C.gold, anchor: 'middle' })
  b += caption(W, H, 3, 'REVOCATION AS ROTATION')
  return svg(W, H, b)
}

// ------------------------------------------------------------------ fig 4
function fig4() {
  const W = 980, H = 700
  let b = ''
  const cols = [[190, 'MASTER', 'nvoy console · NIP-07'], [500, 'RELAYS', 'damus · nos.lol · primal'], [810, 'DIRECTOR', 'the desk · own npub']]
  cols.forEach(([x, t, s]) => {
    b += box(x - 110, 40, 220, 54)
    b += txt(x, 62, t, { anchor: 'middle', ls: 3 })
    b += txt(x, 82, s, { size: 10, fill: C.dim, anchor: 'middle' })
    b += line(x, 94, x, 640, { color: 'faint', width: 2 })
  })
  const msg = (y, x1, x2, s, color = 'gold') => {
    const a = arrow(x1, y, x2, y, { color })
    const label = txt((x1 + x2) / 2, y - 8, s, { size: 11, fill: color === 'gold' ? C.cream : C[color], anchor: 'middle' })
    return a + label
  }
  b += msg(140, 190, 500, 'kind 30440 — the house, encrypted under its scope key')
  b += msg(190, 190, 500, 'kind 1059 — grant to the Director · nvoy terms { purpose, expires_at }')
  b += msg(250, 810, 500, 'poll — receiveGrants · fetchScope (every 120 s)', 'dim')
  b += msg(300, 500, 810, 'the house + terms + the master’s npub', 'green')
  b += box(650, 330, 320, 56, { fill: C.panel2, stroke: C.green })
  b += lines(810, 352, ['desk: “house held by grant from npub1gqg…', 'mandate · till: mirrored from M’s kind-0”'], { size: 10, fill: C.green, anchor: 'middle', lh: 14 })
  b += msg(440, 190, 500, 'revokeHouse — rotate past it · gen+1 · no survivors')
  b += msg(500, 810, 500, 'poll', 'dim')
  b += msg(545, 500, 810, 'newer generation · key fails', 'red')
  b += box(650, 570, 320, 52, { fill: C.panel2, stroke: C.red })
  b += lines(810, 590, ['NVOY_GRANT_REVOKED', 'the table stands unmarked tonight'], { size: 10, fill: C.red, anchor: 'middle', lh: 14 })
  b += vtext(50, 370, "the master's nsec never leaves this column", { fill: C.gold })
  b += line(85, 100, 85, 640, { color: 'gold', dash: '2 5' })
  b += caption(W, H, 4, 'THE HOUSE HANDSHAKE — HIRE AND FIRE BY GRANT')
  return svg(W, H, b)
}

// ------------------------------------------------------------------ fig 5
function fig5() {
  const W = 980, H = 620
  let b = ''
  const mid = 380
  const rows = [
    [mid - 230, 70, 460, 'MASTER KEY', ['wallet / NIP-07 extension — never a server', 'signs the house · the notes · every rotation', 'owns the public kind-0 the till mirrors'], C.cream],
    [mid - 290, 250, 580, 'TABLE ROOT — THE DIRECTOR’S NPUB', ['its standing is only the grants it received', 'certifies per-case keys in the hosted era', 'fired by rotation, never by login'], C.gold],
    [mid - 350, 430, 700, 'PER-CASE BURNER KEYS', ['publish worlds · grant scopes to players', 'rotate on burns · disposable by design'], C.dim],
  ]
  rows.forEach(([x, y, w, t, ls_, fill]) => {
    b += box(x, y, w, 104, { sw: 1.4 })
    b += txt(mid, y + 26, t, { anchor: 'middle', ls: 2, fill })
    b += lines(mid, y + 48, ls_, { size: 11, anchor: 'middle', lh: 16 })
  })
  b += arrow(330, 174, 330, 250, { color: 'gold' })
  b += txt(342, 216, 'grants the house (nvoy terms)', { size: 11, fill: C.gold })
  b += arrow(300, 354, 300, 430, { color: 'gold' })
  b += txt(312, 396, 'certifies', { size: 11, fill: C.gold })
  // the "never" up arrows
  b += arrow(560, 250, 560, 174, { color: 'red', dash: '4 3' })
  b += txt(572, 216, 'no nsec ever crosses up', { size: 11, fill: C.red })
  b += arrow(540, 430, 540, 354, { color: 'red', dash: '4 3' })
  // side rail: the till
  b += box(760, 250, 190, 90, { dash: '4 3' })
  b += lines(855, 276, ['master’s kind-0', '{ lud16: … }', 'public — no grant'], { size: 11, anchor: 'middle', lh: 16 })
  b += arrow(760, 295, 676, 295, { color: 'green' })
  b += txt(712, 283, 'till mirror', { size: 10, fill: C.green, anchor: 'middle' })
  b += txt(490, 560, 'Compromise at any layer is answered by the layer above.', { size: 13, fill: C.cream, anchor: 'middle' })
  b += caption(W, H, 5, 'THE THREE KEYS OF THE TABLE')
  return svg(W, H, b)
}

// ------------------------------------------------------------------ fig 6
function fig6() {
  const W = 980, H = 600
  let b = ''
  b += box(40, 90, 240, 130)
  b += txt(160, 118, 'CASE MODULE', { anchor: 'middle', ls: 2 })
  b += lines(160, 142, ['any author:', 'hand-written · era pack', 'template · language model', '(free to be wrong)'], { size: 11, anchor: 'middle', lh: 16 })
  b += arrow(280, 155, 360, 155, { color: 'gold' })
  b += box(360, 60, 280, 220, { stroke: C.green, sw: 1.8 })
  b += txt(500, 90, 'THE NOTARY', { anchor: 'middle', ls: 3, bold: true })
  b += txt(500, 108, 'shared/verify.mjs — before any deal', { size: 10, fill: C.dim, anchor: 'middle' })
  b += lines(386, 136, ['1  structure — no dangling edges', '2  fairness — all lists · all cleared', '   · no early naming', '3  solvability — walkthrough REPLAYED', '   through the real engine, heat 0', '4  commitment — salted, binds culprit'], { size: 11, lh: 18 })
  // sealed branch
  b += arrow(640, 130, 720, 130, { color: 'green' })
  b += txt(680, 118, 'SEALED', { size: 11, fill: C.green, anchor: 'middle', ls: 1 })
  b += box(712, 90, 240, 84, { stroke: C.green })
  b += lines(830, 114, ['kind-0 commitment', 'salted SHA-256 of the solution', 'published BEFORE the first grant'], { size: 10, anchor: 'middle', lh: 15 })
  b += arrow(830, 174, 830, 230, { color: 'green' })
  b += box(712, 230, 240, 66, { stroke: C.gold })
  b += lines(830, 256, ['briefing granted', '— notarized … solution sealed a3f8… —'], { size: 10, anchor: 'middle', lh: 15 })
  // refused branch
  b += arrow(640, 240, 700, 330, { color: 'red' })
  b += txt(658, 300, 'REFUSED', { size: 11, fill: C.red, anchor: 'middle', ls: 1 })
  b += box(600, 330, 260, 80, { stroke: C.red, dash: '5 3' })
  b += lines(730, 356, ['no deal — failures listed', 'sabotage cases (truncated walkthrough,', 'forged culprit) die here · CI-proven'], { size: 10, fill: C.red, anchor: 'middle', lh: 15 })
  b += txt(490, 480, 'Generate freely. Ratify mechanically.', { size: 14, fill: C.cream, anchor: 'middle', ls: 1 })
  b += txt(490, 504, 'The author can be wrong; the deal cannot.', { size: 12, fill: C.gold, anchor: 'middle' })
  b += caption(W, H, 6, 'ONE DEAL, NOTARIZED')
  return svg(W, H, b)
}

// ------------------------------------------------------------------ fig 7
function fig7() {
  const W = 980, H = 660
  let b = ''
  const cx = 400, cy = 330, R = 215
  const nodes = [
    ['PLAY', ['the case as dealt'], -90],
    ['PIN NOTES', ['margin notes anchor', 'to the text on screen'], -30],
    ['SIGN — NIP-07', ['the master’s real key', 'nsec stays in the extension'], 30],
    ['GRANT TO THE HOUSE', ['house-notes scope 30440', '+ 1059 to the agent npub'], 90],
    ['RESOLVE', ['master-only filter:', 'strangers are ignored'], 150],
    ['VOICE TIGHTENS', ['notes fold into tuning', 'within one poll'], 210],
  ]
  const pos = (deg) => [cx + R * Math.cos(deg * Math.PI / 180), cy + R * Math.sin(deg * Math.PI / 180)]
  nodes.forEach(([t, sub, deg], i) => {
    const [x, y] = pos(deg)
    b += box(x - 95, y - 34, 190, 68, { fill: C.panel2, stroke: i === 4 ? C.green : C.gold })
    b += txt(x, y - 12, t, { size: 11, anchor: 'middle', ls: 1 })
    b += lines(x, y + 6, sub, { size: 9.5, anchor: 'middle', lh: 13 })
    const a1 = deg + 18, a2 = deg + 42
    const [sx, sy] = [cx + (R + 6) * Math.cos(a1 * Math.PI / 180), cy + (R + 6) * Math.sin(a1 * Math.PI / 180)]
    const [ex, ey] = [cx + (R + 6) * Math.cos(a2 * Math.PI / 180), cy + (R + 6) * Math.sin(a2 * Math.PI / 180)]
    b += `<path d="M ${sx} ${sy} A ${R + 6} ${R + 6} 0 0 1 ${ex} ${ey}" fill="none" stroke="${C.gold}" stroke-width="1.4" marker-end="url(#arr-gold)"/>`
  })
  b += lines(cx, cy - 10, ['THE WORKSHOP LOOP', 'the game is edited', 'by playing it'], { size: 12, fill: C.cream, anchor: 'middle', lh: 18 })
  // ledger tap
  b += box(730, 470, 220, 96, { dash: '4 3' })
  b += lines(840, 494, ['THE MASTER’S LEDGER', 'kind 10440 + nvoy console', 'list · rotate · revoke', 'every note-grant, later'], { size: 10, anchor: 'middle', lh: 15 })
  const [gx, gy] = pos(90)
  b += arrow(gx + 95, gy + 10, 730, 500, { color: 'dim', dash: '4 3' })
  b += caption(W, H, 7, 'FEEDBACK AS DELEGATION')
  return svg(W, H, b)
}

// ------------------------------------------------------------------ fig 8
function fig8() {
  const W = 980, H = 580
  let b = ''
  const rungs = [
    [60, 'RUNG 1 — ERA PACKS AS DATA', ['a Lisbon published under the master’s key,', 'granted to the Director via nvoy —', 'new world, no new code'], C.gold, ''],
    [220, 'RUNG 2 — NEW ARCHETYPES', ['accusation-as-chain · the alibi web —', 'each brings its own fairness clauses', 'to the Notary'], C.gold, ''],
    [380, 'RUNG 3 — THE DIRECTOR AUTHORS', ['the model proposes skeleton and flesh;', 'the Notary replays, refuses, or seals', '(direction)'], C.dim, '5 3'],
  ]
  rungs.forEach(([y, t, sub, stroke, dash]) => {
    b += box(50, y, 330, 100, { stroke, dash })
    b += txt(215, y + 26, t, { size: 12, anchor: 'middle', ls: 1 })
    b += lines(215, y + 48, sub, { size: 10.5, anchor: 'middle', lh: 15 })
    b += arrow(380, y + 50, 470, 290, { color: 'gold' })
  })
  // the doorway
  b += box(470, 130, 26, 330, { fill: C.gold, stroke: C.gold })   // left jamb
  b += box(640, 130, 26, 330, { fill: C.gold, stroke: C.gold })   // right jamb
  b += box(470, 96, 196, 34, { fill: C.gold, stroke: C.gold })    // lintel
  b += txt(568, 118, 'kind-0 COMMITMENT', { size: 11, fill: C.ink, anchor: 'middle', ls: 1, bold: true })
  b += lines(568, 220, ['THE', 'NOTARY'], { size: 16, fill: C.cream, anchor: 'middle', lh: 24 })
  b += lines(568, 300, ['structure', 'fairness', 'replay', 'commitment'], { size: 11, anchor: 'middle', lh: 18 })
  b += arrow(666, 295, 750, 295, { color: 'green' })
  b += box(750, 240, 200, 110, { stroke: C.green })
  b += lines(850, 272, ['THE DEAL', 'a table · a player', 'a provably fair game'], { size: 12, anchor: 'middle', lh: 19 })
  b += txt(500, 520, 'Every rung passes through the same door.', { size: 13, fill: C.cream, anchor: 'middle' })
  b += caption(W, H, 8, 'THE WORLD-BUILDER LADDER')
  return svg(W, H, b)
}

const figs = {
  'fig1-layer-cake.svg': fig1(), 'fig2-anatomy-of-a-grant.svg': fig2(),
  'fig3-revocation-as-rotation.svg': fig3(), 'fig4-house-handshake.svg': fig4(),
  'fig5-three-keys.svg': fig5(), 'fig6-notarized-deal.svg': fig6(),
  'fig7-workshop-loop.svg': fig7(), 'fig8-world-builder-ladder.svg': fig8(),
}
for (const [name, body] of Object.entries(figs)) {
  writeFileSync(join(OUT, name), body)
  console.log('wrote docs/figures/' + name)
}
