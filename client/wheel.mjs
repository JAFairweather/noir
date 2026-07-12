// wheel.mjs — the Wheel (spec §6): the reading surface, not decoration.
//
// The transcript lives on a virtual drum, axis horizontal, rotated through a
// fixed viewing window. Lines pass transparent → dim → full white at the
// focal line → dim → transparent, with slight scale/blur following the
// curvature. The whole session history stays on the drum; rotating far back
// is how you re-read.
//
// GM text is TYPED onto the drum — character by character, a block cursor at
// the head, the drum easing down to follow the typing line. The case file is
// a typewriter reel being struck in front of you. Player echoes are instant
// (the player already typed them), and flat mode renders everything
// immediately — the typewriter is flavor, never a gate.
//
// Flat mode renders the identical transcript as plain scrollable text and is
// the default under prefers-reduced-motion. Same data, same order, always.

const RADIUS = 1800             // px — shoulder curvature beyond the flat band
const LINE_PX = 27              // arc length per line at the focal band
const STEP_DEG = LINE_PX / (RADIUS * Math.PI / 180)   // ≈0.86° between lines
const VISIBLE_DEG = 14          // cull beyond this
const FLAT_LINES = 4            // lines each side of focal rendered perfectly flat
const FLAT_DEG = STEP_DEG * FLAT_LINES
const PX_PER_DEG = LINE_PX / STEP_DEG
const RAD = Math.PI / 180
const FRICTION = 0.955
const DETENT_PULL = 0.12        // gentle snap toward paragraph boundaries
const CURSOR = '▌'

// Re-wrap a source line to the measured column. Case text is hand-wrapped
// for ~70 columns; on narrow screens each long line must become several
// drum lines (one slot each) or slots visually overlap. Explicit newlines
// (tables, acrostics, timeline cards) are preserved — only overlong lines
// split, with continuations lightly indented.
function wrapText(raw, max) {
  if (raw.length <= max) return [raw]
  const lead = raw.match(/^\s*/)[0]
  const words = raw.trim().split(/\s+/)
  const out = []
  let cur = lead
  for (let w of words) {
    while (w.length > max) { out.push((cur.trim() ? cur + ' ' : cur) + w.slice(0, max - cur.length - 1)); w = w.slice(max - cur.length - 1); cur = lead + '  ' }
    if (cur.trim() === '' ) cur += w
    else if ((cur + ' ' + w).length <= max) cur += ' ' + w
    else { out.push(cur); cur = lead + '  ' + w }
  }
  if (cur.trim().length || !out.length) out.push(cur)
  return out
}

export class Wheel {
  constructor(drumEl, flatEl) {
    this.drum = drumEl
    // Phones get a pure-2D drum: translateY + opacity only. iOS WebKit
    // (Safari AND Chrome on iOS) is unreliable with large translateZ under
    // preserve-3d + masked ancestors — text projects at the wrong scale.
    // On a phone the flat band fills the screen, so nothing is lost.
    this._mq = window.matchMedia('(max-width: 720px), (pointer: coarse) and (max-width: 1024px)')
    this._mode2d = this._mq.matches
    this._applyDrumTransform()
    this._mq.addEventListener?.('change', () => {
      this._mode2d = this._mq.matches
      this._applyDrumTransform()
      this._renderAll()
    })
    this.flat = flatEl
    this.lines = []               // { full, cls, el, flatEl, para, idx, shown }
    this.rotation = 0             // degrees; line i sits at i * STEP_DEG
    this.velocity = 0
    this.paraStarts = [0]
    this.flatMode = false
    this._queue = []              // lines waiting to be typed
    this._typing = false
    this._typeTimer = null
    this._follow = true           // drum follows the typing head while at tail
    this._raf = null
    this._bindInput()
    this._tick = this._tick.bind(this)
    requestAnimationFrame(this._tick)
  }

  /** Characters that fit one drum line at the current viewport. */
  _maxChars() {
    const vw = window.innerWidth
    if (this._mc && this._mcW === vw) return this._mc
    const stage = this.drum.parentElement
    const probe = document.createElement('div')
    probe.className = 'drum-line'
    probe.style.cssText += ';visibility:hidden;transform:none;white-space:pre'
    probe.textContent = 'abcdefghijklm nopqrstuvwxyz '.repeat(3)
    stage.appendChild(probe)
    const rect = probe.getBoundingClientRect()
    const charPx = probe.scrollWidth / probe.textContent.length
    probe.remove()
    this._mcW = vw
    this._mc = Math.max(24, Math.floor(rect.width / charPx) - 1)
    return this._mc
  }

  _applyDrumTransform() {
    this.drum.style.transform = this._mode2d ? 'none' : `translateZ(${-RADIUS}px)`
  }

  get tail() { return Math.max(0, this.lines.length - 1) * STEP_DEG }
  atTail() { return this.rotation > this.tail - STEP_DEG * 3.5 }

  setFlatMode(on) {
    this.flatMode = on
    if (on) this.flush()                    // accessibility: no typing gate
    this.drum.parentElement.classList.toggle('hidden', on)
    this.flat.classList.toggle('hidden', !on)
    if (on) this.flat.scrollTop = this.flat.scrollHeight
    else this._renderAll()
  }

  /** Append a block of text. Each block is one paragraph detent.
   *  GM/document text types out; player echoes and titles land instantly. */
  append(text, cls = '', { instant: forceInstant = false } = {}) {
    const instant = forceInstant || this.flatMode || /player|title-line/.test(cls)
    if (/player/.test(cls)) this.flush()    // new command: finish pending type
    const wasAtTail = this.atTail() || this.lines.length === 0
    this.paraStarts.push(this.lines.length)
    const max = this._maxChars()
    for (const raw of String(text).split('\n').flatMap(l => wrapText(l, max))) {
      const line = {
        full: raw || ' ', cls, para: this.paraStarts.length - 1,
        idx: this.lines.length, shown: instant ? (raw || ' ').length : 0,
      }
      line.el = document.createElement('div')
      line.el.className = `drum-line ${cls}`
      line.flatEl = document.createElement('div')
      line.flatEl.className = `flat-line ${cls}`
      const initial = instant ? line.full : ''
      line.el.textContent = initial
      line.flatEl.textContent = initial
      this.drum.appendChild(line.el)
      this.flat.appendChild(line.flatEl)
      this.lines.push(line)
      if (!instant) this._queue.push(line)
    }
    if (wasAtTail) this._follow = true
    if (this.flatMode) {
      this.flat.scrollTop = this.flat.scrollHeight
    } else if (instant && this._follow) {
      this._target = this.tail
    }
    this._pump()
    this._renderAll()
  }

  /** Complete all pending typing instantly. */
  flush() {
    clearTimeout(this._typeTimer)
    for (const line of this._queue) {
      line.shown = line.full.length
      line.el.textContent = line.full
      line.flatEl.textContent = line.full
    }
    this._queue = []
    this._typing = false
    if (this.flatMode) this.flat.scrollTop = this.flat.scrollHeight
  }

  _pump() {
    if (this._typing || !this._queue.length) return
    this._typing = true
    const line = this._queue[0]
    // the reel follows the typing head while the reader is at the tail
    if (this._follow && !this.flatMode) this._target = line.idx * STEP_DEG
    const strike = () => {
      if (this._queue[0] !== line) return   // flushed out from under us
      line.shown = Math.min(line.full.length, line.shown + 1 + Math.floor(Math.random() * 3))
      const done = line.shown >= line.full.length
      const text = line.full.slice(0, line.shown)
      line.el.textContent = done ? line.full : text + CURSOR
      line.flatEl.textContent = text
      if (this.flatMode) this.flat.scrollTop = this.flat.scrollHeight
      if (done) {
        this._queue.shift()
        this._typing = false
        this._typeTimer = setTimeout(() => this._pump(), line.full.trim() ? 90 : 30)  // carriage breath
      } else {
        this._typeTimer = setTimeout(strike, 14 + Math.random() * 22)
      }
    }
    strike()
  }

  /** Space bar: advance one beat (next paragraph boundary). */
  advanceBeat() {
    if (this.flatMode) { this.flat.scrollTop += this.flat.clientHeight * 0.7; return }
    const cur = this.rotation / STEP_DEG
    const next = this.paraStarts.find(p => p > cur + 0.01)
    this._target = (next ?? this.lines.length - 1) * STEP_DEG
  }

  _bindInput() {
    const stage = this.drum.parentElement
    stage.addEventListener('wheel', (e) => {
      if (this.flatMode) return
      e.preventDefault()
      this._target = null
      this._follow = false
      this.velocity += e.deltaY * 0.0017
    }, { passive: false })

    let touchY = null
    stage.addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY }, { passive: true })
    stage.addEventListener('touchmove', (e) => {
      if (touchY == null || this.flatMode) return
      this._target = null
      this._follow = false
      this.velocity += (touchY - e.touches[0].clientY) * 0.0046
      touchY = e.touches[0].clientY
    }, { passive: true })
    stage.addEventListener('touchend', () => { touchY = null })

    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' && !['ArrowUp', 'ArrowDown'].includes(e.key)) return
      if (e.key === 'ArrowUp') { this._target = null; this._follow = false; this.velocity -= 0.23 }
      if (e.key === 'ArrowDown') { this._target = null; this._follow = false; this.velocity += 0.23 }
    })
  }

  _tick() {
    if (!this.flatMode && this.lines.length) {
      if (this._target != null) {
        // Eased travel toward a requested position (typing head, Space beat).
        const d = this._target - this.rotation
        if (Math.abs(d) < 0.05) { this.rotation = this._target; this._target = null }
        else this.rotation += d * 0.065
        this._renderAll()
      } else if (Math.abs(this.velocity) > 0.002) {
        this.rotation += this.velocity
        this.velocity *= FRICTION
        // Gentle detent at paragraph boundaries once momentum is nearly spent.
        if (Math.abs(this.velocity) < 0.055) {
          const nearest = Math.round(this.rotation / STEP_DEG) * STEP_DEG
          this.rotation += (nearest - this.rotation) * DETENT_PULL
        }
        this.rotation = Math.max(0, Math.min(this.tail + STEP_DEG, this.rotation))
        this._renderAll()
        // drifting back to the tail re-arms follow
        if (this.atTail()) this._follow = true
      }
    }
    this._raf = requestAnimationFrame(this._tick)
  }

  _renderAll() {
    // The drum face: a FLAT reading band (±FLAT_LINES around focal, every
    // line identical width) with cylindrical shoulders curving away beyond
    // it. Fade/blur apply only on the shoulders.
    for (let i = 0; i < this.lines.length; i++) {
      const delta = i * STEP_DEG - this.rotation      // angular distance from focal line
      const el = this.lines[i].el
      const ad = Math.abs(delta)
      if (ad > VISIBLE_DEG) {
        if (el.style.display !== 'none') el.style.display = 'none'
        continue
      }
      el.style.display = ''
      if (this._mode2d) {
        // 2D mode: no z, no rotation, no blur — nothing WebKit can flatten
        el.style.transform = `translateY(${delta * PX_PER_DEG}px)`
        if (ad <= FLAT_DEG) {
          el.style.opacity = 1
        } else {
          const t = (ad - FLAT_DEG) / (VISIBLE_DEG - FLAT_DEG)
          el.style.opacity = Math.max(0, (1 - t ** 1.4)) ** 1.1
        }
        el.style.filter = ''
        el.classList.toggle('focal', ad < STEP_DEG * 0.55)
        continue
      }
      if (ad <= FLAT_DEG) {
        // flat band: pure vertical placement, zero rotation, zero depth
        el.style.transform = `translateZ(${RADIUS}px) translateY(${delta * PX_PER_DEG}px)`
        el.style.opacity = 1
        el.style.filter = ''
      } else {
        // shoulder: cylinder tangent to the flat band's edge
        const sgn = Math.sign(delta)
        const ex = ad - FLAT_DEG                       // degrees into the curve
        const y = sgn * (FLAT_DEG * PX_PER_DEG + RADIUS * Math.sin(ex * RAD))
        const zoff = RADIUS * (1 - Math.cos(ex * RAD))
        const t = ex / (VISIBLE_DEG - FLAT_DEG)        // 0 at band edge → 1 at cull
        el.style.transform =
          `translateZ(${RADIUS - zoff}px) translateY(${y}px) rotateX(${-sgn * ex}deg) scale(${1 - t * 0.02})`
        el.style.opacity = Math.max(0, (1 - t ** 1.4)) ** 1.1
        el.style.filter = t > 0.55 ? `blur(${(t - 0.55) * 2.4}px)` : ''
      }
      el.classList.toggle('focal', ad < STEP_DEG * 0.55)
    }
  }
}
