// smoke.mjs — Noir M1 smoke test, patterned after the protocol repo.
//
//   node test/smoke.mjs          # in-memory relay (CI-safe, no network)
//
// Plays "The Last Visa (mini)" end to end over the real protocol:
// pre-authored world, grant-driven progression, a genuine burn (rotation +
// 441), fair-play commitment verification, and an adversarial observer check.

import { generateSecretKey, getPublicKey } from 'nostr-tools'
import { Relay } from '../lib/relay.mjs'
import { receiveGrants, latestGrants, fetchScope } from '../lib/nipxx.mjs'
import { sendFieldReport, receiveRumors, KIND_GM_DISPATCH, KIND_BURN_NOTICE } from '../shared/wrap.mjs'
import { StubGM } from '../gm/stubgm.mjs'
import * as berlin from '../gm/cases/berlin-minicase.mjs'
import { CASES } from '../gm/cases/registry.mjs'
import { generateCase } from '../gm/casegen.mjs'

let passed = 0, failed = 0
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${name}${detail ? ` — ${detail}` : ''}`)
  ok ? passed++ : failed++
}

const sha256hex = async (str) => {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('')
}

const relay = new Relay()
const player = generateSecretKey()
const playerPub = getPublicKey(player)
const gm = new StubGM(relay, berlin)

const notebook = async () => latestGrants(await receiveGrants(relay, player))
const readable = async () => {
  const out = []
  for (const g of await notebook()) {
    const res = await fetchScope(relay, g)
    out.push({ ...g, ...res })
  }
  return out
}
const say = async (text) => {
  await sendFieldReport(relay, player, gm.pub, text, berlin.CASE_ID)
  await gm.poll()
}

console.log('\n1. GM authors the world before play')
const { commitment } = await gm.start(playerPub)
const worldEvents = relay.query({ kinds: [30440] })
check('all eight scopes published as 30440 before first command', worldEvents.length === 8)
check('inciting grant received', (await notebook()).length === 1)
check('briefing decrypts', (await readable())[0]?.data?.title?.includes('BRIEFING'))

console.log('\n2. Fair-play commitment')
check('kind-0 carries solution commitment', (() => {
  const [profile] = relay.query({ kinds: [0], authors: [gm.pub] })
  return JSON.parse(profile.content).noir.solution_commitment === commitment
})())
check('commitment matches the skeleton solution', commitment === await sha256hex(berlin.solutionCommitment.canonical()))

console.log('\n3. Progression is grant issuance')
await say('help')
check('help costs nothing', gm.heat === 0 && (await notebook()).length === 1)
await say('The intercept decodes to zoo locker nine. Going there now.')
check('cipher answer grants the locker scope', (await notebook()).length === 2)
await say('completely wrong nonsense answer')
check('wrong answer raises heat, grants nothing', gm.heat === berlin.heat.wrongAnswer && (await notebook()).length === 2)
await say('Pay a visit to Voss at the travel office')
check('red herring (Reisebüro Voss) is reachable', (await notebook()).length === 3)
await say('Take the cloakroom ticket to Josty and ask Adler about Weiss')
check('informant scope granted', (await notebook()).length === 4)
const adlerBefore = (await readable()).find(s => s.data?.kind === 'npc')
check('informant statement decrypts', adlerBefore?.status === 'ok')

console.log('\n4. Timeline reconstruction')
await say('ask station for the watcher log')
check('watcher log granted', (await notebook()).some(g => g.scopeName?.includes('Watcher')))
const heatBefore = gm.heat
await say('timeline A B C')
check('wrong order rebuked with heat', gm.heat === heatBefore + berlin.heat.wrongAnswer)
await say('timeline B C A')
check('correct order grants the freight scope', (await notebook()).some(g => g.scopeName?.includes('Freight')))

console.log('\n5. The burn is a real rotation + 441')
await say('press Adler for the name')
const afterBurn = await readable()
const adlerAfter = afterBurn.find(g => g.scopeId === adlerBefore.scopeId)
check('burned scope reads STALE with the old key', adlerAfter.status === 'stale')
const burns = await receiveRumors(relay, player, [KIND_BURN_NOTICE])
check('kind-441 burn notice delivered', burns.length === 1 && JSON.parse(burns[0].content).reason.includes('pressed'))
check('441 addresses the rotated scope', burns[0].tags.find(t => t[0] === 'a')[1].endsWith(adlerBefore.scopeId))

console.log('\n6. Finish the case anyway')
await say('check who held the tuesday duty window')
check('roster granted after the burn', (await notebook()).some(g => g.scopeName?.includes('Roster')))
await say('accuse Brandt')
const final = await readable()
check('accusation grants the resolution scope', final.some(s => s.data?.kind === 'epilogue' && s.status === 'ok'))
const dispatches = await receiveRumors(relay, player, [KIND_GM_DISPATCH])
check('case marked solved', dispatches.some(d => JSON.parse(d.content).ended === 'solved'))

console.log('\n7. Adversarial observer (what a relay operator learns)')
// The case's *title* is public by design (it lives in the kind-0 alongside
// the commitment). Its *contents* — people, places, answers — must not be.
const view = relay.observerView()
const leaked = JSON.stringify(view).match(/BRANDT|KELLER|ADLER|WEISS|JOSTY|SILBER|LOCKER|ROSTER|VOSS|ANHALTER/i)
check('no case secrets visible to the relay', !leaked, leaked ? `leaked: ${leaked[0]}` : '')
check('grants indistinguishable (only 1059 wraps visible)', view.every(e => [0, 1059, 30440].includes(e.kind)))

console.log('\n8. GM save/restore (mid-case device recovery)')
const snapshot = gm.serialize()
const gm2 = StubGM.restore(relay, berlin, snapshot)
check('restored GM keeps identity and world', gm2.pub === gm.pub && gm2.scopes.size === 8)
check('restored GM keeps progress', gm2.unlocked.size === gm.unlocked.size && gm2.heat === gm.heat && gm2.over)
check('restored GM keeps the burn (rotated generation)', gm2.scopes.get('adler').generation === 2)
check('player notebook rebuilds against restored world', (await readable()).filter(s => s.status === 'ok').length >= 6)

console.log('\n9. Every registered case: walkthrough to the epilogue')
for (const mod of Object.values(CASES)) {
  const r2 = new Relay()
  const p2 = generateSecretKey()
  const gmN = new StubGM(r2, mod)
  await gmN.start(getPublicKey(p2))
  for (const cmd of mod.walkthrough) {
    await sendFieldReport(r2, p2, gmN.pub, cmd, mod.CASE_ID)
    await gmN.poll()
  }
  const docs = []
  for (const gr of latestGrants(await receiveGrants(r2, p2))) docs.push(await fetchScope(r2, gr))
  check(`${mod.CASE_ID}: walkthrough reaches the epilogue`, docs.some(d => d.status === 'ok' && d.data?.kind === 'epilogue'))
  check(`${mod.CASE_ID}: no heat spent on the happy path`, gmN.heat === 0)
}

console.log('\n10. Scripted interrogation (dialogue state, hints)')
{
  const r3 = new Relay()
  const p3 = generateSecretKey()
  const gmB = new StubGM(r3, berlin)
  await gmB.start(getPublicKey(p3))
  const talk = async (text) => {
    await sendFieldReport(r3, p3, gmB.pub, text, berlin.CASE_ID)
    await gmB.poll()
    const d = await receiveRumors(r3, p3, [KIND_GM_DISPATCH])
    return JSON.parse(d[d.length - 1].content).text
  }
  await talk('the intercept decodes to zoo locker nine')
  await talk('ask adler at josty about weiss')             // unlock edge
  const gated = await talk('ask adler about brandt')
  check('deep line gated behind disposition', !gated.includes('evening belonged'))
  const warm = await talk('ask adler about weiss')          // dialogue, +1 disposition
  check('dialogue line responds in character', warm.includes('apologizing'))
  const open_ = await talk('ask adler about brandt')
  check('disposition opens the deeper line', open_.includes('evening belonged'))
  const heatBefore = gmB.heat
  await talk('offer adler money')
  check('bribing the wrong person costs heat', gmB.heat === heatBefore + 5)
  const hint = await talk('I want to decode the cipher')
  check('near-miss earns a hint, not the generic miss', hint.includes('workname'))
  check('hints and dialogue cost no wrong-answer heat', gmB.heat === heatBefore + 5)
  check('npc state survives serialize/restore', (() => {
    const g2 = StubGM.restore(r3, berlin, gmB.serialize())
    return g2.npcState.adler.disposition >= 1 && g2.npcState.adler.used.length >= 2
  })())
}

console.log('\n11. Director voice seam fails soft')
{
  const r4 = new Relay()
  const p4 = generateSecretKey()
  const gmV = new StubGM(r4, berlin)
  await gmV.start(getPublicKey(p4))
  gmV.voice = async () => { throw new Error('service down') }
  await sendFieldReport(r4, p4, gmV.pub, 'the intercept decodes to zoo locker nine', berlin.CASE_ID)
  await gmV.poll()
  const d = await receiveRumors(r4, p4, [KIND_GM_DISPATCH])
  check('voice failure falls back to scripted prose', d.some(x => JSON.parse(x.content).text.includes('pfennigs')))
  gmV.voice = async ({ canned }) => 'THE DIRECTOR SPEAKS: ' + canned.slice(0, 20)
  await sendFieldReport(r4, p4, gmV.pub, 'ask adler at josty about weiss', berlin.CASE_ID)
  await gmV.poll()
  const d2 = await receiveRumors(r4, p4, [KIND_GM_DISPATCH])
  check('voice rewrites the beat when available', d2.some(x => JSON.parse(x.content).text.startsWith('THE DIRECTOR SPEAKS')))
}

console.log('\n12. Live interrogation seam (Director NPCs)')
{
  const r5 = new Relay()
  const p5 = generateSecretKey()
  const gmI = new StubGM(r5, berlin)
  await gmI.start(getPublicKey(p5))
  const say5 = async (text) => { await sendFieldReport(r5, p5, gmI.pub, text, berlin.CASE_ID); await gmI.poll() }
  await say5('the intercept decodes to zoo locker nine')
  await say5('ask adler at josty about weiss')
  let captured = null
  gmI.interrogator = async (npc) => { captured = npc; return { reply: 'LIVE: she considers you.', disposition_delta: 1 } }
  await say5('adler, tell me about your son')
  const d5 = await receiveRumors(r5, p5, [KIND_GM_DISPATCH])
  check('live NPC reply dispatched', d5.some(x => JSON.parse(x.content).text.startsWith('LIVE:')))
  check('live NPC sees only held statement + willing reveals', captured.statement.includes('COAT-CHECK') && Array.isArray(captured.reveals))
  check('disposition delta applied and clamped', gmI.npcState.adler.disposition === 1)
  gmI.interrogator = async () => null
  await say5('ask adler about weiss')
  const d6 = await receiveRumors(r5, p5, [KIND_GM_DISPATCH])
  check('null from live NPC falls back to scripted line', d6.some(x => JSON.parse(x.content).text.includes('apologizing')))
  await say5('press adler for the name')
  check('burns stay mechanical with a live NPC attached', gmI.burned.has('adler'))
}

console.log('\n13. Structured verdicts (judge seam)')
{
  const r6 = new Relay()
  const p6 = generateSecretKey()
  const gmJ = new StubGM(r6, berlin)
  await gmJ.start(getPublicKey(p6))
  let judged = 0
  gmJ.judge = async ({ answers }) => { judged++; return answers[0].id }
  const say6 = async (text) => { await sendFieldReport(r6, p6, gmJ.pub, text, berlin.CASE_ID); await gmJ.poll() }
  await say6('the intercept decodes to zoo locker nine')
  check('exact match wins without consulting the judge', judged === 0 && gmJ.unlocked.has('locker'))
  gmJ.judge = async ({ attempt, answers }) =>
    attempt.toUpperCase().includes('NINTH BOX') ? (answers.find(a => a.id === 'adler') ? null : null) : null
  // reset for a paraphrase test on a fresh case
  const r7 = new Relay(), p7 = generateSecretKey()
  const gmK = new StubGM(r7, berlin)
  await gmK.start(getPublicKey(p7))
  gmK.judge = async ({ answers }) => answers.find(a => a.canonical.includes('ZOO LOCKER NINE'))?.id ?? null
  await sendFieldReport(r7, p7, gmK.pub, 'the message says the ninth box at the zoo terminal', berlin.CASE_ID)
  await gmK.poll()
  check('judge match grants the edge on a paraphrase', gmK.unlocked.has('locker') && gmK.heat === 0)
  gmK.judge = async () => null
  const heatBefore = gmK.heat
  await sendFieldReport(r7, p7, gmK.pub, 'random flailing about nothing', berlin.CASE_ID)
  await gmK.poll()
  check('null verdict falls through to the normal miss', gmK.heat === heatBefore + berlin.heat.wrongAnswer)
}

console.log('\n14. Casegen: deterministic, solvable, committed')
{
  const a1 = generateCase('alpha'), a2 = generateCase('alpha'), b1 = generateCase('bravo')
  check('same seed → same case (culprit, cipher, commitment)',
    a1.accusation.culprit === a2.accusation.culprit &&
    a1.scopes.briefing.payload.body === a2.scopes.briefing.payload.body &&
    a1.solutionCommitment.canonical() === a2.solutionCommitment.canonical())
  check('different seed → different case',
    JSON.stringify({ c: a1.accusation.culprit, b: a1.scopes.briefing.payload.body }) !==
    JSON.stringify({ c: b1.accusation.culprit, b: b1.scopes.briefing.payload.body }))
  for (const seed of ['alpha', 'bravo', 'charlie', 'delta']) {
    const mod = generateCase(seed)
    const rG = new Relay()
    const pG = generateSecretKey()
    const gmG = new StubGM(rG, mod)
    await gmG.start(getPublicKey(pG))
    for (const cmd of mod.walkthrough) {
      await sendFieldReport(rG, pG, gmG.pub, cmd, mod.CASE_ID)
      await gmG.poll()
    }
    const docs = []
    for (const gr of latestGrants(await receiveGrants(rG, pG))) docs.push(await fetchScope(rG, gr))
    check(`seed "${seed}": walkthrough reaches the epilogue at heat ${gmG.heat}`,
      docs.some(d => d.status === 'ok' && d.data?.kind === 'epilogue') && gmG.heat === 0)
  }
}

console.log('\n15. The desk runs the tables (decode command)')
{
  const rD = new Relay()
  const pD = generateSecretKey()
  const gmD = new StubGM(rD, berlin)
  await gmD.start(getPublicKey(pD))
  const sayD = async (text) => {
    await sendFieldReport(rD, pD, gmD.pub, text, berlin.CASE_ID)
    await gmD.poll()
    const d = await receiveRumors(rD, pD, [KIND_GM_DISPATCH])
    return JSON.parse(d[d.length - 1].content).text
  }
  const noise = await sayD('decode keller')
  check('wrong key shows real gibberish, costs nothing', noise.includes('noise') && gmD.heat === 0 && !gmD.unlocked.has('locker'))
  const open_ = await sayD('decode with silber')
  check('right key opens the intercept and grants the drop', gmD.unlocked.has('locker') && open_.includes('ZOOLO CKERN INE'))
  const genD = generateCase('echo')
  const rE = new Relay(); const pE = generateSecretKey(); const gmE = new StubGM(rE, genD)
  await gmE.start(getPublicKey(pE))
  await sendFieldReport(rE, pE, gmE.pub, `decode ${genD.cipher.key.toLowerCase()}`, genD.CASE_ID)
  await gmE.poll()
  check('generated cases honor the decode desk too', gmE.unlocked.has('drop'))
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
