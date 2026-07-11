// audio.mjs — the Noir score: original music in 19-tone equal temperament.
//
// Why 19-TET: familiar shapes, wrong shadows — the tuning does for the ear
// what duotone does for the eye. Every pitch is ref × 2^(step/19), so the
// whole score is synthesized in-client from oscillators: no samples, no
// assets, no build step. (The sax voice is ported from the 19TeamT project,
// where this game was accidentally born.)
//
// Design law (docs/DECISIONS.md §6): long slow tones, era-keyed instruments —
// Berlin viola · Meridian guitar · New Orleans brass dirge · Paris sax.
// All composition is generative and ORIGINAL: idiom and instrumentation may
// evoke a period; no melody is ever quoted. Deterministic per case seed.
//
// The score is furniture: it sits far under the reading surface, ducks for
// nothing, and its one dramatic right is silence — a burn stops the theme
// mid-phrase.

const STEPS = 19
export const freq19 = (step, ref = 220) => ref * Math.pow(2, step / STEPS)

// 19-TET modes, chosen by ear for long-tone work (degrees in 0..18):
// a dark quasi-minor for Berlin/NOLA, an open quasi-mixolydian for Meridian,
// a cool quasi-dorian for Paris. Enough steps apart to sound *almost* tonal.
const MODES = {
  dark: [0, 3, 5, 8, 11, 13, 16],
  open: [0, 3, 6, 8, 11, 14, 16],
  cool: [0, 3, 5, 8, 11, 14, 16],
}

const ERA_SCORES = {
  'berlin-1938': { instrument: 'viola', mode: 'dark', ref: 110, tempo: 11, register: [0, 26] },
  'paris-1954': { instrument: 'sax', mode: 'cool', ref: 146.83, tempo: 8, register: [0, 24] },
  'neworleans-1968': { instrument: 'brass', mode: 'dark', ref: 87.31, tempo: 13, register: [0, 22] },
  'meridian-1849': { instrument: 'guitar', mode: 'open', ref: 98, tempo: 12, register: [0, 30] },
}

// Deterministic PRNG so two players on one seed share themes, never takes.
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class Score {
  constructor(seed = 19) {
    this.rand = mulberry32(seed)
    this.era = ERA_SCORES['berlin-1938']
    this.heat = 0
    this.ctx = null
    this.master = null
    this._timer = null
    this._playing = false
  }

  setEra(eraId) { this.era = ERA_SCORES[eraId] ?? this.era }
  setHeat(h) { this.heat = Math.max(0, Math.min(100, h)) }

  /** Must be called from a user gesture (autoplay policy). */
  start() {
    if (this._playing) return
    this.ctx = this.ctx ?? new (window.AudioContext || window.webkitAudioContext)()
    if (!this.master) {
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.22
      this.master.connect(this.ctx.destination)
    }
    this.ctx.resume()
    this._playing = true
    this._loop()
  }

  stop() {
    this._playing = false
    clearTimeout(this._timer)
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.4)
      setTimeout(() => { if (!this._playing && this.master) this.master.gain.value = 0.22 }, 1500)
    }
    if (this.ctx) setTimeout(() => { if (!this._playing) this.ctx.suspend() }, 1600)
  }

  /** A burn is heard as an interruption: the theme stops mid-phrase, hard. */
  burn() {
    if (!this._playing || !this.ctx) return
    clearTimeout(this._timer)
    this.master.gain.cancelScheduledValues(this.ctx.currentTime)
    this.master.gain.setValueAtTime(this.master.gain.value, this.ctx.currentTime)
    this.master.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.08)
    // four seconds of true silence, then the room breathes again, quieter
    this._timer = setTimeout(() => {
      if (!this._playing) return
      this.master.gain.setValueAtTime(0.0001, this.ctx.currentTime)
      this.master.gain.setTargetAtTime(0.16, this.ctx.currentTime, 2.5)
      this._loop()
    }, 4000)
  }

  // ------------------------------------------------------- the long loop

  _loop() {
    if (!this._playing) return
    const era = this.era
    const mode = MODES[era.mode]
    // Heat compresses time and lifts register: patience → pulse.
    const heatF = this.heat / 100
    const gap = (era.tempo - heatF * era.tempo * 0.65) * (0.6 + this.rand() * 0.8)
    const octaveLift = Math.floor(heatF * 2) * STEPS
    const degree = mode[Math.floor(this.rand() * mode.length)]
    const [lo, hi] = era.register
    const step = Math.min(hi + octaveLift, lo + degree + (this.rand() < 0.3 ? STEPS : 0) + octaveLift)
    const dur = 6 + this.rand() * 8 - heatF * 4
    const vel = 0.10 + this.rand() * 0.06 + heatF * 0.05

    this._voice(era.instrument, step, dur, vel, era.ref)
    // Occasionally a fifth-ish partner (11 steps ≈ 695¢) under the long tone.
    if (this.rand() < 0.35) this._voice(era.instrument, step - 11, dur * 1.2, vel * 0.6, era.ref)

    this._timer = setTimeout(() => this._loop(), gap * 1000)
  }

  _voice(kind, step, dur, vel, ref) {
    const f = freq19(step, ref)
    if (kind === 'viola') this._viola(f, dur, vel)
    else if (kind === 'guitar') this._guitar(f, dur, vel)
    else if (kind === 'brass') this._brass(f, dur, vel)
    else this._sax(f, dur, vel)
  }

  // --------------------------------------------------------- instruments

  /** Berlin: viola — two slightly detuned saws through body formants, slow bow. */
  _viola(f, dur, vel) {
    const { ctx, master } = this, t = ctx.currentTime
    const out = ctx.createGain()
    out.gain.setValueAtTime(0, t)
    out.gain.linearRampToValueAtTime(vel, t + dur * 0.25)          // slow bow in
    out.gain.setValueAtTime(vel * 0.9, t + dur * 0.7)
    out.gain.linearRampToValueAtTime(0.0001, t + dur)
    // wooden body: two formant bandpasses in parallel
    for (const [ff, q, g] of [[f * 2.4, 4, 1], [f * 5.1, 6, 0.4]]) {
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'; bp.frequency.value = ff; bp.Q.value = q
      const bg = ctx.createGain(); bg.gain.value = g
      for (const det of [0, 0.4]) {
        const osc = ctx.createOscillator()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(f * (1 + det / 100), t)
        this._vibrato(osc, f, t, dur, 4.6, dur * 0.4)              // vibrato arrives late
        osc.connect(bp); osc.start(t); osc.stop(t + dur + 0.1)
      }
      bp.connect(bg); bg.connect(out)
    }
    out.connect(master)
  }

  /** Meridian: guitar — Karplus-Strong pluck; long tones become slow strums. */
  _guitar(f, dur, vel) {
    const { ctx, master } = this, t0 = ctx.currentTime
    // a strum: root, fifth-ish (11), octave (19), staggered like a thumb pass
    const steps = [0, 11, 19]
    steps.forEach((interval, i) => {
      const f2 = f * Math.pow(2, interval / STEPS)
      const N = Math.round(ctx.sampleRate / f2)
      const len = ctx.sampleRate * Math.min(dur, 5)
      const buf = ctx.createBuffer(1, len, ctx.sampleRate)
      const d = buf.getChannelData(0)
      for (let n = 0; n < N; n++) d[n] = Math.random() * 2 - 1     // excite
      for (let n = N; n < len; n++) d[n] = (d[n - N] + d[n - N + 1]) * 0.4965 // decay string
      const src = ctx.createBufferSource(); src.buffer = buf
      const g = ctx.createGain(); g.gain.value = vel * (1 - i * 0.2)
      const tone = ctx.createBiquadFilter()
      tone.type = 'lowpass'; tone.frequency.value = 2400
      src.connect(tone); tone.connect(g); g.connect(master)
      src.start(t0 + i * 0.09)                                     // the strum
    })
  }

  /** New Orleans: brass — saw into gentle waveshaper, dirge swell, 1910 patience. */
  _brass(f, dur, vel) {
    const { ctx, master } = this, t = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(f, t)
    osc.frequency.linearRampToValueAtTime(f * 1.004, t + dur)      // breath drift
    const shaper = ctx.createWaveShaper()
    const curve = new Float32Array(256)
    for (let i = 0; i < 256; i++) { const x = (i / 128) - 1; curve[i] = Math.tanh(2.2 * x) }
    shaper.curve = curve
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'; lp.Q.value = 1.1
    lp.frequency.setValueAtTime(f * 1.5, t)
    lp.frequency.linearRampToValueAtTime(f * 4.5, t + dur * 0.5)   // the swell
    lp.frequency.linearRampToValueAtTime(f * 1.8, t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vel, t + dur * 0.18)
    g.gain.setValueAtTime(vel * 0.85, t + dur * 0.75)
    g.gain.linearRampToValueAtTime(0.0001, t + dur)
    osc.connect(shaper); shaper.connect(lp); lp.connect(g); g.connect(master)
    osc.start(t); osc.stop(t + dur + 0.1)
  }

  /** Paris: the 19TeamT sax voice — saw body + detuned square + breath noise. */
  _sax(f, dur, vel) {
    const { ctx, master } = this, t = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'; osc.frequency.setValueAtTime(f, t)
    const body = ctx.createBiquadFilter()
    body.type = 'bandpass'; body.frequency.value = f * 2.2; body.Q.value = 1.8
    const osc2 = ctx.createOscillator()
    osc2.type = 'square'; osc2.frequency.setValueAtTime(f * 1.002, t)
    const lp2 = ctx.createBiquadFilter()
    lp2.type = 'lowpass'; lp2.frequency.value = f * 3
    const noise = ctx.createBufferSource()
    const nb = ctx.createBuffer(1, ctx.sampleRate * Math.min(dur, 4), ctx.sampleRate)
    const nd = nb.getChannelData(0)
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1
    noise.buffer = nb
    const nf = ctx.createBiquadFilter()
    nf.type = 'bandpass'; nf.frequency.value = f * 4; nf.Q.value = 2.5
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0, t)
    ng.gain.linearRampToValueAtTime(vel * 0.12, t + 0.01)
    ng.gain.exponentialRampToValueAtTime(Math.max(vel * 0.03, 0.0002), t + 0.08)
    ng.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vel * 0.85, t + 0.05)
    g.gain.linearRampToValueAtTime(vel, t + dur * 0.2)
    g.gain.setValueAtTime(vel * 0.9, t + dur * 0.65)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    const g2 = ctx.createGain()
    g2.gain.setValueAtTime(0, t)
    g2.gain.linearRampToValueAtTime(vel * 0.22, t + 0.08)
    g2.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    this._vibrato(osc, f, t, dur, 5.2, dur * 0.3, osc2)
    osc.connect(body); body.connect(g); g.connect(master)
    osc2.connect(lp2); lp2.connect(g2); g2.connect(master)
    noise.connect(nf); nf.connect(ng); ng.connect(master)
    osc.start(t); osc.stop(t + dur + 0.05)
    osc2.start(t); osc2.stop(t + dur + 0.05)
    noise.start(t)
  }

  _vibrato(osc, f, t, dur, rate, onset, osc2 = null) {
    if (dur < 0.4) return
    const vib = this.ctx.createOscillator()
    const vg = this.ctx.createGain()
    vib.frequency.setValueAtTime(rate, t)
    vg.gain.setValueAtTime(0, t)
    vg.gain.linearRampToValueAtTime(f * 0.006, t + onset)
    vib.connect(vg); vg.connect(osc.frequency)
    if (osc2) vg.connect(osc2.frequency)
    vib.start(t); vib.stop(t + dur + 0.05)
  }
}
