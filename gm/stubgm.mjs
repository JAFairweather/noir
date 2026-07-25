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
import { buildEntityIndex, mentions, isAction, isSurvey } from './entities.mjs'

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
    this.heatExplained = false
    this.missStreak = 0
    this.accuseWarned = new Set()
    this.tailFired = false
    this.tailDone = false
    this.over = false
    this.seenReports = new Set()
    // the case's noun index (§5): entity fallback for plain phrasing
    this.entities = buildEntityIndex(caseModule)
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
      heatExplained: this.heatExplained ?? false,
      missStreak: this.missStreak ?? 0,
      accuseWarned: [...this.accuseWarned],
      tailFired: this.tailFired ?? false,
      tailDone: this.tailDone ?? false,
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
    gm.heatExplained = state.heatExplained ?? false
    gm.missStreak = state.missStreak ?? 0
    gm.accuseWarned = new Set(state.accuseWarned ?? [])
    gm.tailFired = state.tailFired ?? false
    gm.tailDone = state.tailDone ?? false
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
    this.missStreak = 0            // progress resets the escalating nudge (#8)
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
    // The first time heat ever rises, say the rule once, in-world (§5.4):
    // a legible price beats a silent threat.
    if (this.heat > 0 && !this.heatExplained) {
      this.heatExplained = true
      out += '\n\n(The city noticed that. Heat rises on loud moves — pressing a source, ' +
        'flashing money, filing a bad deduction — never on looking around. "lay low" cools it.)'
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

  coolHeat(n) {
    this.heat = Math.max(0, this.heat - n)
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
      if (this.heat > 0) {
        lines.push('', `Heat stands at ${this.heat}` +
          (this.heat >= this.case.heat.tail ? '. You are being watched.' : '.') +
          ' Laying low costs days and cools the city.')
      }
      return this.dispatch(lines.join('\n'))
    }

    // Homage winks (§8) — one dry line each, never load-bearing.
    if (t === 'XYZZY') {
      return this.dispatch('Nothing happens. This is not that kind of cave, agent. It was worth trying exactly once.')
    }
    if (t === 'WEST' && this.unlocked.size === 1) {
      return this.dispatch('West of here the boulevard runs toward the Tiergarten, black branches over black water. Station did not send you here to admire it.')
    }

    // The tail (§5.7): once heat has put a recurring stranger on the
    // player's street, flagging what repeats folds him — and cools the
    // city for real. One beat per case; wrong guesses just miss, free.
    const tail = this.case.tail
    if (tail && this.tailFired && !this.tailDone && tail.match(t)) {
      this.tailDone = true
      this.coolHeat(tail.cool ?? 30)
      return this.dispatch(tail.response, { cooled: tail.cool ?? 30 })
    }

    // Tradecraft lowers heat (§5.4) — the other half of the economy.
    // Loud moves warm the city; laying low spends days and cools it.
    if (/\b(LAY LOW|LIE LOW|LAY DOWN LOW|SAFE HOUSE|SAFEHOUSE|GO TO GROUND|GO DARK|COOL OFF)\b/.test(t)) {
      if (this.heat === 0) {
        return this.dispatch('The city has no eyes on you worth dodging. Save the tradecraft for when it is warm.')
      }
      const n = this.case.heat.layLow ?? 25
      this.coolHeat(n)
      return this.dispatch(this.case.layLowResponse ??
        'You go to ground: a rented room, cash, no letters, meals carried up cold. Two days pass on ' +
        'other people\'s footsteps. When you surface, the city has half forgotten your face. (Heat falls.)',
      { cooled: n })
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

    // Photo analysis (§5.5): the answer lives in the IMAGE — the client
    // composites the detail over the scene; no document spells it out.
    // The desk can only put the loupe in the player's hand; the reading
    // itself goes through the gate edge's answer key like any verdict.
    const photo = this.case.photo
    if (photo && this.unlocked.has(photo.scope) && !this.unlocked.has(photo.to) &&
        /\b(STUDY|EXAMINE|INSPECT|ENLARGE|LOOK|READ|CHECK|SEE)\b/.test(t) &&
        /\b(PHOTO|PHOTOGRAPH|PICTURE|IMAGE|FRAME|PRINT|NEGATIVE|SHOT|LOUPE)\b/.test(t) &&
        !this.case.edges.find(e => e.to === photo.to)?.match(t)) {
      return this.dispatch(photo.study)
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
        st.disposition = Math.max(0, Math.min(3, st.disposition + (line.disposition ?? 0)))
        if (line.heat) this.addHeat(line.heat)
        await this.dispatch(line.response)
        return this.checkHeat()
      }
      // Engaged, but no new ground (#11). A name she knows but has no
      // line for gets an in-character deflection; otherwise the
      // disposition-aware closers rotate, so a spent scene reads as
      // spent — never as broken.
      if (npc.reactiveMiss?.length &&
          [...this.entities.keys()].some(k => k !== key && mentions(this.entities, k, t))) {
        st.reactAt = (st.reactAt ?? 0) + 1
        return this.dispatch(npc.reactiveMiss[(st.reactAt - 1) % npc.reactiveMiss.length])
      }
      const closers = (npc.fallbacks ?? [{ response: npc.fallback }])
        .filter(f => (f.minDisposition ?? 0) <= st.disposition)
      const pool = closers.length ? closers : [{ response: npc.fallback }]
      st.fallAt = (st.fallAt ?? 0) + 1
      return this.dispatch(pool[(st.fallAt - 1) % pool.length].response)
    }

    // Contextual hints: a near-miss earns a nudge, not the cold shoulder.
    // `requires` opens a hint; `unless` retires it once later scopes have
    // made its advice stale.
    for (const hint of this.case.hints ?? []) {
      if (hint.requires && !hint.requires.every(r => this.unlocked.has(r))) continue
      if (hint.unless && hint.unless.some(r => this.unlocked.has(r))) continue
      if (hint.match(t)) return this.dispatch(hint.response)
    }

    // Intent fallback (§5): the authored matchers had their turn; now
    // resolve the command against the case's own nouns. Acting on a
    // reachable node unlocks it; acting on a held document re-reads it —
    // both by meaning, not by the author's exact spelling.
    if (isAction(t)) {
      for (const edge of this.case.edges) {
        if (this.unlocked.has(edge.to)) continue
        if (!edge.requires.every(r => this.unlocked.has(r))) continue
        // Puzzle gates keep their answers: an edge with a canonical
        // answer or a recognizable-wrong path must be SOLVED, not named.
        if (edge.answerKey || edge.failMatch) continue
        if (mentions(this.entities, edge.to, t)) {
          await this.grantScope(edge.to)
          return this.dispatch(edge.response, { granted: edge.to })
        }
      }
      for (const key of this.unlocked) {
        if (this.case.scopes[key] && mentions(this.entities, key, t)) {
          return this.dispatch(
            `${this.case.scopes[key].name} is already in your notebook — the drum will read it back.`,
            { reopen: key })
        }
      }
    }

    // Bare looking around is free and answers with the state of the case.
    if (isSurvey(t)) {
      const open = this.case.edges.filter(e =>
        !this.unlocked.has(e.to) && e.requires.every(r => this.unlocked.has(r)) && e.lead)
      const lines = [`You take stock. ${this.unlocked.size} document${this.unlocked.size === 1 ? '' : 's'} in the notebook; the city gives nothing away for free.`]
      if (open.length) lines.push(`The nearest loose thread: ${open[0].lead}`)
      return this.dispatch(lines.join('\n'))
    }

    // No edge matched. Being lost is free (§5.4): heat is a price for
    // loud moves — pressed sources, failed bribes, bad deductions —
    // never for a question the parser didn't recognize.
    // If the Director is listening, the desk answers the report in its
    // own words — grounded in the FULL earned context (and nothing
    // more), never granting, never inventing. Scripted line on any
    // failure: the game must always play without AI.
    this.missStreak = (this.missStreak ?? 0) + 1
    if (this.converse) {
      try {
        const reply = await this.converse({ report: text, context: this.contextPack() })
        if (reply) return this.dispatch(reply, { noVoice: true })
      } catch { /* scripted fallback below */ }
    }
    // The miss is a guide, not a wall (#8): a near-miss that names a
    // known entity gets its thread at once; otherwise the nudge
    // escalates — atmosphere, then a thread, then the page to reread —
    // rotating threads so repeated misses never repeat themselves.
    const base = this.case.missResponse ??
      'Nothing gives. A doorman remembers your face; somewhere a telephone is lifted and set down again.'
    const open = this.case.edges.filter(e =>
      !this.unlocked.has(e.to) && e.requires.every(r => this.unlocked.has(r)) && e.lead)
    const relevant = open.find(e => mentions(this.entities, e.to, t))
    const pick = relevant ?? (open.length ? open[(this.missStreak - 1) % open.length] : null)
    if (!pick || (!relevant && this.missStreak < 2)) return this.dispatch(base)
    let line = `${base}\n\nA thread still hangs: ${pick.lead}`
    if (this.missStreak >= 3) {
      const doc = pick.requires.filter(r => this.case.scopes[r]).pop()
      if (doc) line += `\nStart from ${this.case.scopes[doc].name} — read it again; it names the door.`
    }
    return this.dispatch(line)
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
    const acc = this.case.accusation
    const { culprit, wrong, unlocks, correctResponse, wrongResponse } = acc
    const named = t.includes(culprit) ? culprit : wrong.find(w => t.includes(w))
    // An accusation with no recognizable name is a clerical error, not a
    // spent shot — the one-shot only fires on a name the case knows.
    if (!named) {
      return this.dispatch('The desk reads the report twice and hands it back. Name the man: "accuse <name>". You file it once, and you live with it.')
    }
    if (named !== culprit) {
      // The desk argues back — once (#10): if the player's own papers
      // rule the man out, the contradiction is put to them before the
      // one-shot is spent. Insisting a second time files it anyway.
      const guard = acc.contradictions?.[named]
      if (guard && this.unlocked.has(guard.requires) && !this.accuseWarned.has(named)) {
        this.accuseWarned.add(named)
        return this.dispatch(guard.response)
      }
      this.over = true
      return this.dispatch(wrongResponse(named), { ended: 'failed' })
    }
    // §5.8: the right name still needs the chain. The desk asks the
    // player to show their work — cite the papers — before it moves.
    if (acc.evidence?.length) {
      const needed = acc.evidenceRequired ?? 2
      const cited = acc.evidence.filter(key =>
        this.unlocked.has(key) && mentions(this.entities, key, t))
      if (cited.length < needed) {
        return this.dispatch(acc.proofResponse ??
          `A name alone does not move the desk. Show the work — "accuse ${culprit.toLowerCase()} ` +
          'with <the papers that put him there>". Two documents, minimum, out of your own notebook.')
      }
    }
    await this.grantScope(unlocks)
    this.over = true
    return this.dispatch(correctResponse, { granted: unlocks, ended: 'solved' })
  }

  async checkHeat() {
    const { press, heatThreshold, heatReason } = this.case.burnTriggers
    // §5.7: crossing the tail threshold puts a face on the heat — a
    // three-sighting beat the player can resolve for a real cooldown.
    if (this.case.tail && !this.tailFired && this.heat >= this.case.heat.tail) {
      this.tailFired = true
      await this.dispatch(this.case.tail.open, { tail: true })
    }
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
