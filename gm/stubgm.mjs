// stubgm.mjs — the M1 game master: no AI, real protocol.
//
// Serves a hand-authored case (gm/cases/*) over NIP-DA exactly the way the
// full director will (spec §3, §11 M1): every dossier is a kind-30440 scope
// published before play begins, progression is kind-440 grant issuance,
// a burned informant is a genuine key rotation plus a kind-441 burn notice.
// The only thing stubbed is the writer in the chair — responses are scripted.
//
// Runs identically in Node (tests) and the browser (demo mode), because the
// relay interface is just { publish, query } per lib/nipxx.mjs.

import { getPublicKey, generateSecretKey, finalizeEvent } from 'nostr-tools'
import { newScopeKey, publishScope, grant, rotateScope } from '../lib/nipxx.mjs'
import {
  KIND_FIELD_REPORT, receiveRumors, sendDispatch, sendBurnNotice,
} from '../shared/wrap.mjs'

const normalize = (text) => text.toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

// Vigenère decode — the desk's cipher tables. Any key produces output;
// only the right one produces language. Wrong keys teach the mechanic.
const vigenereDecode = (ct, key) => {
  const A = 65
  let ki = 0
  return [...ct.replace(/[^A-Z]/g, '')].map(ch =>
    String.fromCharCode(A + ((ch.charCodeAt(0) - A) - (key[ki++ % key.length].charCodeAt(0) - A) + 26) % 26)).join('')
}
const groups5 = (s2) => s2.replace(/(.{5})/g, '$1 ').trim()
const DECODE_NOISE = new Set(['DECODE', 'TRY', 'KEY', 'WITH', 'THE', 'USING', 'UNDER', 'WORKNAME', 'IT', 'AS'])

async function sha256hex(str) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}

const randomScopeId = () => 's' + [...crypto.getRandomValues(new Uint8Array(6))].map(b => (b % 36).toString(36)).join('')

const toHex = (b) => [...b].map(x => x.toString(16).padStart(2, '0')).join('')
const fromHex = (h) => Uint8Array.from(h.match(/../g), (x) => parseInt(x, 16))
const b64 = (bytes) => btoa(String.fromCharCode(...bytes))
const unb64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0))

export class StubGM {
  constructor(relay, caseModule, gmSecret = generateSecretKey()) {
    this.relay = relay
    this.case = caseModule
    this.secret = gmSecret
    this.pub = getPublicKey(gmSecret)
    // per-scope wire state: opaque id, key, generation
    this.scopes = new Map()
    this.unlocked = new Set()
    this.burned = new Set()
    this.heat = 0
    this.over = false
    this.seenReports = new Set()
    // interrogation state per NPC (§5.3): disposition + which lines are spent
    this.npcState = {}
    for (const key of Object.keys(caseModule.npcs ?? {}))
      this.npcState[key] = { disposition: 0, used: [] }
  }

  /** Snapshot everything a saved game needs to resume this GM. */
  serialize() {
    return {
      secret: toHex(this.secret),
      playerPub: this.playerPub,
      scopes: [...this.scopes.entries()].map(([name, w]) =>
        [name, { scopeId: w.scopeId, generation: w.generation, scopeKey: b64(w.scopeKey) }]),
      unlocked: [...this.unlocked],
      burned: [...this.burned],
      heat: this.heat,
      over: this.over,
      seenReports: [...this.seenReports],
      npcState: this.npcState,
    }
  }

  /** Rebuild a GM from a snapshot. The relay must already hold the world's events. */
  static restore(relay, caseModule, state) {
    const gm = new StubGM(relay, caseModule, fromHex(state.secret))
    gm.playerPub = state.playerPub
    gm.scopes = new Map(state.scopes.map(([name, w]) =>
      [name, { scopeId: w.scopeId, generation: w.generation, scopeKey: unb64(w.scopeKey) }]))
    gm.unlocked = new Set(state.unlocked)
    gm.burned = new Set(state.burned)
    gm.heat = state.heat
    gm.over = state.over
    gm.seenReports = new Set(state.seenReports)
    gm.npcState = state.npcState ?? gm.npcState
    return gm
  }

  /** Author the whole world up front (§4.3), commit to the solution, deal the inciting grant. */
  async start(playerPub) {
    this.playerPub = playerPub
    for (const [name, def] of Object.entries(this.case.scopes)) {
      const wire = { scopeId: randomScopeId(), generation: 1, scopeKey: newScopeKey() }
      this.scopes.set(name, wire)
      await publishScope(this.relay, this.secret, {
        ...wire,
        payload: { name: def.name, ...def.payload },
      })
    }
    // Fair-play commitment in the case's public kind-0 (§4.3).
    const commitment = await sha256hex(this.case.solutionCommitment.canonical())
    const profile = finalizeEvent({
      kind: 0, created_at: Math.floor(Date.now() / 1000), tags: [],
      content: JSON.stringify({
        name: `Noir GM — ${this.case.CASE_ID}`,
        about: 'Game master for a Noir case. All scopes pre-authored; solution committed below.',
        noir: { case: this.case.CASE_ID, era: this.case.ERA, solution_commitment: commitment },
      }),
    }, this.secret)
    await this.relay.publish(profile)

    await this.grantScope('briefing')
    await this.dispatch(this.case.opening)
    return { gmPub: this.pub, commitment }
  }

  async grantScope(name) {
    const wire = this.scopes.get(name)
    const def = this.case.scopes[name]
    this.unlocked.add(name)
    await grant(this.relay, this.secret, this.playerPub, { ...wire, scopeName: def.name })
  }

  /** Send narrative to the player. If a Director voice is attached (M3),
   *  it rewrites the beat in era prose — the mechanical outcome (grants,
   *  burns, heat, verdicts) is already decided and never changes. The
   *  scripted line is always the fallback: the game must play without AI. */
  async dispatch(text, extra = {}) {
    let out = text
    if (this.voice && !extra.noVoice) {
      try {
        out = (await this.voice({ canned: text, extra, heat: this.heat })) || text
      } catch { out = text }
    }
    return sendDispatch(this.relay, this.secret, this.playerPub, {
      caseId: this.case.CASE_ID, text: out, extra: { heat: this.heat, ...extra },
    })
  }

  /** Burn a scope for real: rotate the key past the player, then say so with a 441. */
  async burn(name, reason) {
    const wire = this.scopes.get(name)
    const def = this.case.scopes[name]
    const { generation } = await rotateScope(this.relay, this.secret, {
      scopeId: wire.scopeId, generation: wire.generation,
      payload: { name: def.name, ...def.payload },
      scopeName: def.name, survivors: [],   // no survivors: the player is cut off
    })
    wire.generation = generation
    this.burned.add(name)
    await sendBurnNotice(this.relay, this.secret, this.playerPub, {
      scopeId: wire.scopeId, generation, reason,
    })
  }

  addHeat(n) {
    this.heat = Math.min(this.case.heat.max, this.heat + n)
  }

  /** Read new field reports off the relay and play the case forward. */
  async poll() {
    if (this.over) return
    const reports = await receiveRumors(this.relay, this.secret, [KIND_FIELD_REPORT])
    for (const report of reports) {
      if (this.seenReports.has(report._wrapId)) continue
      this.seenReports.add(report._wrapId)
      await this.handle(report.content)
      if (this.over) break
    }
  }

  async handle(text) {
    const t = normalize(text)
    if (!t) return

    if (t === 'HELP' && this.case.helpText) {
      return this.dispatch(this.case.helpText)
    }

    // The desk reads the case back: what you hold, what dangles, how out.
    if (['REVIEW', 'STATUS', 'RECAP', 'CASE REVIEW', 'WHERE AM I'].includes(t)) {
      const lines = ['CASE REVIEW — the desk reads it back:', '']
      lines.push(`You hold ${this.unlocked.size} documents.` +
        (this.burned.size ? ` Burned and gone forward: ${[...this.burned].map(k => this.case.scopes[k].name).join(', ')}.` : ''))
      // The three lists are the spine of a web case: the desk keeps
      // count so the player never wonders which they already own.
      if (this.case.lists) {
        const held = Object.entries(this.case.lists).filter(([k]) => this.unlocked.has(k)).map(([, n]) => n)
        const out = Object.entries(this.case.lists).filter(([k]) => !this.unlocked.has(k)).map(([, n]) => n)
        lines.push(out.length === 0
          ? 'All three lists are in your hands. One name stands on all of them.'
          : held.length === 0
            ? `Of the three lists you hold none yet. Out there still: ${out.join(', ')}.`
            : `Of the three lists you hold ${held.join(' and ')}. Still out there: ${out.join(', ')}.`)
      }
      const open = this.case.edges.filter(e =>
        !this.unlocked.has(e.to) && e.requires.every(r => this.unlocked.has(r)) && e.lead)
      if (open.length) {
        lines.push('', 'Threads still hanging:')
        for (const e of open) lines.push(`  - ${e.lead}`)
      } else {
        lines.push('', 'No threads left hanging. You hold everything this city will hand you.')
      }
      lines.push('', 'Standing instruction: when you are certain of your man,')
      lines.push('file it — "accuse <name>". You file it once, and you live with it.')
      if (this.heat >= this.case.heat.tail) lines.push('', `Heat stands at ${this.heat}. You are being watched.`)
      return this.dispatch(lines.join('\n'))
    }

    // Homage winks (§8) — one dry line each, never load-bearing.
    if (t === 'XYZZY') {
      return this.dispatch('Nothing happens. This is not that kind of cave, agent. It was worth trying exactly once.')
    }
    if (t === 'WEST' && this.unlocked.size === 1) {
      return this.dispatch('West of here the boulevard runs toward the Tiergarten, black branches over black water. Station did not send you here to admire it.')
    }

    // The desk runs the cipher tables (§5.1): "decode <key>". The puzzle is
    // spotting the key in the documents, not doing polyalphabetic arithmetic.
    const cipher = this.case.cipher
    if (cipher && !this.unlocked.has(cipher.to) && /^(DECODE|TRY KEY|RUN)\b/.test(t)) {
      const candidate = t.split(' ').reverse().find(w => w && !DECODE_NOISE.has(w) && /^[A-Z]{3,}$/.test(w))
      if (!candidate) {
        return this.dispatch('The desk needs a key word to run against the intercept: "decode <word>".')
      }
      if (candidate === cipher.key) {
        const plain = groups5(vigenereDecode(cipher.ciphertext, candidate))
        const edge = this.case.edges.find(e => e.to === cipher.to)
        await this.grantScope(cipher.to)
        return this.dispatch(
          `The desk lays ${candidate} against the intercept and the groups fall open: ${plain}. ` +
          (edge?.response ?? ''), { granted: cipher.to })
      }
      const garbage = groups5(vigenereDecode(cipher.ciphertext, candidate))
      return this.dispatch(
        `The desk runs ${candidate} against the intercept: ${garbage} — noise. Wrong key. ` +
        'The right word turns it into language.')
    }

    // The accusation endgame (§5.8).
    if (t.startsWith('ACCUSE')) return this.accuse(t)

    // Scripted burn trigger: pressing the informant (§5.3).
    const press = this.case.burnTriggers.press
    if (this.unlocked.has(press.scope) && !this.burned.has(press.scope) && press.match(t)) {
      this.addHeat(this.case.heat.pressedInterrogation)
      await this.burn(press.scope, press.reason)
      await this.dispatch(press.response, { burned: press.scope })
      return this.checkHeat()
    }

    // Unlock edges, in order; first match on an available edge wins.
    for (const edge of this.case.edges) {
      if (this.unlocked.has(edge.to)) continue
      if (!edge.requires.every(r => this.unlocked.has(r))) continue
      if (edge.match(t)) {
        await this.grantScope(edge.to)
        return this.dispatch(edge.response, { granted: edge.to })
      }
      // A recognizable wrong attempt at this edge (e.g. a bad timeline order)
      // gets the edge's own rebuke instead of the generic one.
      if (edge.failMatch?.(t)) {
        this.addHeat(this.case.heat.wrongAnswer)
        await this.dispatch(edge.failResponse)
        return this.checkHeat()
      }
    }

    // Structured verdict (§5): if exact match failed but a judge is
    // attached, let it compare the attempt against the canonical answers
    // of reachable puzzle edges — ground truth in, one id out, never prose.
    const judgeable = this.case.edges.filter(e =>
      e.answerKey && !this.unlocked.has(e.to) && e.requires.every(r => this.unlocked.has(r)))
    if (this.judge && judgeable.length) {
      try {
        const match = await this.judge({
          attempt: text,
          answers: judgeable.map(e => ({ id: e.to, canonical: e.answerKey })),
        })
        const edge = judgeable.find(e => e.to === match)
        if (edge) {
          await this.grantScope(edge.to)
          return this.dispatch(edge.response, { granted: edge.to })
        }
      } catch { /* judge unavailable — exact matching already had its turn */ }
    }

    // Interrogation (§5.3): talking to an unlocked, unburned NPC.
    // With the Director present, the NPC is played live — bounded to the
    // dossier the player already holds plus the facts the scripted lines
    // would currently be willing to reveal. Burns stay mechanical (above).
    for (const [key, npc] of Object.entries(this.case.npcs ?? {})) {
      if (!this.unlocked.has(key) || this.burned.has(key)) continue
      if (!npc.aliases.some(a => t.includes(a))) continue
      const st = this.npcState[key]
      if (this.interrogator) {
        try {
          const out = await this.interrogator({
            name: this.case.scopes[key].name,
            statement: `${this.case.scopes[key].payload.title}\n${this.case.scopes[key].payload.body}`,
            reveals: npc.lines
              .filter((l, i) => !st.used.includes(i) && (l.minDisposition ?? 0) <= st.disposition)
              .map(l => l.response),
            disposition: st.disposition,
            playerText: text,
          })
          if (out?.reply) {
            st.disposition = Math.max(0, Math.min(3, st.disposition + (out.disposition_delta | 0)))
            await this.dispatch(out.reply, { noVoice: true })
            return this.checkHeat()
          }
        } catch { /* live NPC unavailable — the scripted lines still know their part */ }
      }
      for (let i = 0; i < npc.lines.length; i++) {
        const line = npc.lines[i]
        if (st.used.includes(i)) continue
        if ((line.minDisposition ?? 0) > st.disposition) continue
        if (!line.match(t)) continue
        st.used.push(i)
        st.disposition += line.disposition ?? 0
        if (line.heat) this.addHeat(line.heat)
        await this.dispatch(line.response)
        return this.checkHeat()
      }
      return this.dispatch(npc.fallback)   // engaged, but no new ground
    }

    // Contextual hints: a near-miss earns a nudge, not the cold shoulder.
    for (const hint of this.case.hints ?? []) {
      if (hint.requires && !hint.requires.every(r => this.unlocked.has(r))) continue
      if (hint.match(t)) return this.dispatch(hint.response)
    }

    // No edge matched: the city notices people who ask the wrong questions.
    this.addHeat(this.case.heat.wrongAnswer)
    // If the Director is listening, the desk answers the report in its
    // own words — grounded in the FULL earned context (and nothing
    // more), never granting, never inventing. Scripted line on any
    // failure: the game must always play without AI.
    if (this.converse) {
      try {
        const reply = await this.converse({ report: text, context: this.contextPack() })
        if (reply) {
          await this.dispatch(reply + ' (Heat rises.)', { noVoice: true })
          return this.checkHeat()
        }
      } catch { /* scripted fallback below */ }
    }
    await this.dispatch(this.case.missResponse ??
      'Nothing gives. A doorman remembers your face; somewhere a telephone is lifted and set down again. (Heat rises.)',
    )
    return this.checkHeat()
  }

  /** Everything the PLAYER has earned — and nothing else (spec §4.4).
   *  This is the Director's whole world: held documents (burned ones
   *  survive only as what was already read), open leads, public case
   *  facts. The solution is not here, so it cannot leak. */
  contextPack() {
    const held = [...this.unlocked]
      .filter(k => this.case.scopes[k])
      .map(k => {
        const p = this.case.scopes[k].payload
        return { title: p.title ?? this.case.scopes[k].name, body: p.body ?? '' }
      })
    const leads = this.case.edges
      .filter(e => !this.unlocked.has(e.to) && e.requires.every(r => this.unlocked.has(r)) && e.lead)
      .map(e => e.lead)
    return {
      era: this.case.ERA,
      title: this.case.TITLE ?? this.case.CASE_ID,
      heat: this.heat,
      burned: [...this.burned].map(k => this.case.scopes[k].name),
      held, leads,
    }
  }

  async accuse(t) {
    const { culprit, wrong, unlocks, correctResponse, wrongResponse } = this.case.accusation
    if (t.includes(culprit)) {
      await this.grantScope(unlocks)
      this.over = true
      return this.dispatch(correctResponse, { granted: unlocks, ended: 'solved' })
    }
    const named = wrong.find(w => t.includes(w)) ?? 'the wrong man'
    this.over = true
    return this.dispatch(wrongResponse(named), { ended: 'failed' })
  }

  async checkHeat() {
    const { press, heatThreshold, heatReason } = this.case.burnTriggers
    if (this.heat >= heatThreshold && this.unlocked.has(press.scope) && !this.burned.has(press.scope)) {
      await this.burn(press.scope, heatReason)
      await this.dispatch('Word reaches you sideways: your one pair of eyes has gone dark. The city closed over her like water.', { burned: press.scope })
    }
    if (this.heat >= this.case.heat.max) {
      this.over = true
      await this.dispatch(
        'A car with its lights off has been outside for an hour. Station orders you across the border by the milk train. The case stays open; you do not.',
        { ended: 'heat' },
      )
    }
  }
}
