// verify.mjs — the notary. Physics by commitment, flesh by language.
//
// The thesis this module enforces: a case is two things. The SKELETON —
// who did it, what clears whom, what unlocks what, what burns — is
// physics: committed to cryptographically before the first grant, and
// provable. The FLESH — every sentence, room, and name between those
// joists — is free country: hand-written today, granted as an era pack
// or authored by a language model tomorrow. The freedom is safe exactly
// because nothing deals until the notary passes. Any author, human or
// model, submits to the same proofs:
//
//   1. STRUCTURE — the module exposes what the engine plays.
//   2. FAIRNESS — the culprit stands on all three lists; every innocent
//      is cleared by exactly one; no document names the killer early.
//   3. SOLVABILITY — the walkthrough is replayed through the real
//      engine on a throwaway relay: the epilogue must be reached, at
//      zero heat, with the whole web opened.
//   4. COMMITMENT — the solution hash is well-formed and binds culprit
//      to case, so the kind-0 promise published at the deal is real.
//
// verifyCase returns { ok, failures } and never throws on a bad case —
// the point is to refuse the deal politely, not to crash the table.

import { generateSecretKey, getPublicKey } from 'nostr-tools'
import { Relay } from '../lib/relay.mjs'
import { receiveGrants, latestGrants, fetchScope } from '../lib/nipxx.mjs'
import { sendFieldReport } from './wrap.mjs'
import { StubGM } from '../gm/stubgm.mjs'

export async function verifyCase(mod) {
  const failures = []
  const fail = (rule) => failures.push(rule)

  // -- 1. structure ---------------------------------------------------
  const hasScopes = mod?.scopes && typeof mod.scopes === 'object'
  if (!hasScopes) fail('structure: no scopes')
  if (!Array.isArray(mod?.edges) || !mod.edges.length) fail('structure: no edge graph')
  if (!Array.isArray(mod?.walkthrough) || !mod.walkthrough.length) fail('structure: no walkthrough to prove')
  if (!mod?.accusation?.culprit) fail('structure: no committed culprit')
  if (!mod?.solutionCommitment?.canonical) fail('structure: no solution commitment')
  if (failures.length) return { ok: false, failures }

  // Every edge must point at a real scope, and every requirement too —
  // a dangling edge is a door drawn on a wall.
  for (const e of mod.edges) {
    if (!mod.scopes[e.to]) fail(`structure: edge to unknown scope "${e.to}"`)
    for (const r of e.requires ?? []) if (!mod.scopes[r]) fail(`structure: edge requires unknown scope "${r}"`)
  }

  // -- 2. fairness (deduction-web archetype) ---------------------------
  const culprit = mod.accusation.culprit
  if (mod.lists) {
    const listBodies = Object.keys(mod.lists)
      .map(k => mod.scopes[k]?.payload?.body ?? '')
    if (!listBodies.every(b => b.includes(culprit)))
      fail('fairness: the culprit must stand on all three lists')
    // A list CLEARS a man with a line of his own — name, dash or colon,
    // and no affirmation. Every innocent needs at least one such line
    // somewhere, or two names stand at the end and the game is a coin.
    const innocents = (mod.board?.suspects ?? []).filter(n => n !== culprit)
    for (const name of innocents) {
      const cleared = listBodies.filter(b => b.split('\n').some(l =>
        l.trim().startsWith(name) && (l.includes('—') || l.includes(':')) && !l.includes('yes'))).length
      if (cleared < 1) fail(`fairness: ${name} is cleared by no list — two candidates at the end`)
    }
  }
  for (const [key, s] of Object.entries(mod.scopes)) {
    if (key === 'resolution') continue
    if (new RegExp(`${culprit}[^\\n]*(IS THE|IS OUR MAN|SELLER IS|KILLER)`, 'i').test(s.payload?.body ?? ''))
      fail(`fairness: scope "${key}" names the culprit before the accusation`)
  }

  // -- 3. solvability: replay the walkthrough through the real engine --
  try {
    const relay = new Relay()
    const playerSk = generateSecretKey()
    const gm = new StubGM(relay, mod)
    await gm.start(getPublicKey(playerSk))
    for (const cmd of mod.walkthrough) {
      await sendFieldReport(relay, playerSk, gm.pub, cmd, mod.CASE_ID)
      await gm.poll()
    }
    const docs = []
    for (const g of latestGrants(await receiveGrants(relay, playerSk))) docs.push(await fetchScope(relay, g))
    if (!docs.some(d => d.status === 'ok' && d.data?.kind === 'epilogue'))
      fail('solvability: the walkthrough never reaches the epilogue')
    if (gm.heat !== 0)
      fail(`solvability: the clean path costs heat (${gm.heat}) — the proof line must be free`)
    if (gm.unlocked.size !== Object.keys(mod.scopes).length)
      fail(`solvability: the happy path leaves ${Object.keys(mod.scopes).length - gm.unlocked.size} scope(s) sealed`)
  } catch (err) {
    fail(`solvability: replay crashed — ${String(err?.message ?? err).slice(0, 120)}`)
  }

  // -- 4. commitment integrity -----------------------------------------
  try {
    const canonical = JSON.parse(mod.solutionCommitment.canonical())
    if (canonical.culprit !== culprit) fail('commitment: hash does not bind the accused culprit')
    if (canonical.case !== mod.CASE_ID) fail('commitment: hash does not bind this case')
    if (!canonical.salt) fail('commitment: unsalted — solvable by dictionary')
  } catch {
    fail('commitment: canonical form is not well-formed JSON')
  }

  return { ok: failures.length === 0, failures }
}
