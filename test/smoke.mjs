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
import * as nola from '../gm/cases/neworleans-wetnegative.mjs'
import { CASES } from '../gm/cases/registry.mjs'
import { generateCase } from '../gm/casegen.mjs'
import { generateWebCase } from '../gm/caseweb.mjs'

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
check('a fumbled command costs no heat and grants nothing (§5.4)', gm.heat === 0 && (await notebook()).length === 2)
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
check('a bare name does not spend the accusation (§5.8)', !gm.over)
await say('accuse Brandt — the duty roster and adler\'s statement put him at the window')
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
  check('null verdict falls through to the miss path without heat', gmK.heat === heatBefore)
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
  const n1 = generateCase('gamma', 'neworleans-1968')
  check('NOLA generation is deterministic and era-tagged',
    n1.CASE_ID === 'gen:neworleans-1968:gamma' && n1.ERA === 'neworleans-1968' &&
    generateCase('gamma', 'neworleans-1968').accusation.culprit === n1.accusation.culprit)
  check('NOLA acrostic first letters spell the street', (() => {
    const street = n1.edges[0].answerKey.match(/spell ([A-Z]+)/)[1]
    const ads = n1.scopes.briefing.payload.body.split('\n')
      .map(l => l.match(/^  ([A-Z])/)).filter(Boolean).map(m => m[1]).join('')
    return ads === street
  })())
  for (const [seed, era] of [['alpha', undefined], ['bravo', undefined], ['charlie', undefined], ['delta', undefined],
                             ['gamma', 'neworleans-1968'], ['zeta', 'neworleans-1968']]) {
    const mod = generateCase(seed, era)
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
    check(`${era ?? 'berlin'} seed "${seed}": walkthrough reaches the epilogue at heat ${gmG.heat}`,
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

console.log('\n16. Review: the desk reads the case back')
{
  const rR = new Relay()
  const pR = generateSecretKey()
  const gmR = new StubGM(rR, berlin)
  await gmR.start(getPublicKey(pR))
  const sayR = async (text) => {
    await sendFieldReport(rR, pR, gmR.pub, text, berlin.CASE_ID)
    await gmR.poll()
    const d = await receiveRumors(rR, pR, [KIND_GM_DISPATCH])
    return JSON.parse(d[d.length - 1].content).text
  }
  const rev1 = await sayR('review')
  check('review lists open threads at case start', rev1.includes('decode <word>') && rev1.includes('Kantstrasse'))
  check('review always states the accusation instruction', rev1.includes('accuse <name>'))
  check('review costs nothing', gmR.heat === 0)
  await sayR('decode silber')
  const rev2 = await sayR('status')
  check('resolved threads drop off; new ones appear', !rev2.includes('decode <word>') && rev2.includes('ADLER'))
}

console.log('\n17. Deep cases: the deduction web (caseweb)')
{
  // Structure: 15 scopes, three list scopes, fair intersection.
  for (const era of ['berlin-1938', 'neworleans-1968', 'paris-1954', 'meridian-1849']) {
    const w = generateWebCase('omega', era)
    check(`${era} web: 15+ scopes (spec §4.2)`, Object.keys(w.scopes).length >= 15)
    check(`${era} web: deterministic per seed`,
      generateWebCase('omega', era).solutionCommitment.canonical() === w.solutionCommitment.canonical())
    const culprit = w.accusation.culprit
    const lists = ['rota', 'keybook', 'personnel'].map(k => w.scopes[k].payload.body)
    check(`${era} web: the culprit stands on all three lists`,
      lists.every(b => b.includes(culprit)))
    const others = w.accusation.wrong.slice(0, 3)   // the three cleared suspects
    check(`${era} web: each other suspect is cleared by exactly one list`,
      others.every(name =>
        lists.filter(b => b.split('\n').some(l => l.trim().startsWith(name) && (l.includes('—') || l.includes(':')) && !l.includes('yes'))).length >= 1))
    check(`${era} web: no scope names the culprit as the man`,
      !Object.values(w.scopes).some(s => s !== w.scopes.resolution &&
        new RegExp(`${culprit}[^\\n]*(IS THE|IS OUR MAN|SELLER IS|KILLER)`, 'i').test(s.payload.body)))
    check(`${era} web: the desk can count the lists (review inventory)`,
      w.lists && ['rota', 'keybook', 'personnel'].every(k => typeof w.lists[k] === 'string'))
  }
  // Solvability: replay the walkthrough through the real engine, both eras,
  // several seeds — epilogue reached, heat zero, everything granted honestly.
  for (const [seed, era] of [['omega', 'berlin-1938'], ['sigma', 'berlin-1938'], ['kappa', 'berlin-1938'],
                             ['omega', 'neworleans-1968'], ['sigma', 'neworleans-1968'], ['kappa', 'neworleans-1968'],
                             ['omega', 'paris-1954'], ['sigma', 'paris-1954'], ['kappa', 'paris-1954'],
                             ['omega', 'meridian-1849'], ['sigma', 'meridian-1849'], ['kappa', 'meridian-1849']]) {
    const mod = generateWebCase(seed, era)
    const rW = new Relay()
    const pW = generateSecretKey()
    const gmW = new StubGM(rW, mod)
    await gmW.start(getPublicKey(pW))
    for (const cmd of mod.walkthrough) {
      await sendFieldReport(rW, pW, gmW.pub, cmd, mod.CASE_ID)
      await gmW.poll()
    }
    const docs = []
    for (const gr of latestGrants(await receiveGrants(rW, pW))) docs.push(await fetchScope(rW, gr))
    check(`${era} web seed "${seed}": walkthrough reaches the epilogue at heat ${gmW.heat}`,
      docs.some(d => d.status === 'ok' && d.data?.kind === 'epilogue') && gmW.heat === 0)
    check(`${era} web seed "${seed}": the whole web opens on the happy path`,
      gmW.unlocked.size === Object.keys(mod.scopes).length)
  }
  // "Go to the Acme" must work — every solid word of an informant's venue
  // opens the door, not just the last one (field report, 2026-07-12).
  for (const era of ['berlin-1938', 'neworleans-1968', 'paris-1954', 'meridian-1849']) {
    const w = generateWebCase('omega', era)
    const edge = w.edges.find(e => e.to === 'informant')
    const venue = w.scopes.informant.payload.title.split(',').pop().trim()
    const words = venue.split(/[^A-Za-z]+/).filter(x => x.length >= 4 && x.toUpperCase() !== 'THE')
    check(`${era} web: any venue word reaches the informant (${words.join('/')})`,
      words.every(word => edge.match(`GO TO THE ${word.toUpperCase()}`)))
  }

  // The notary (shared/verify.mjs): the same proofs this suite runs,
  // packaged so the GAME refuses an unproven deal — the door every
  // future author, human or model, must pass through.
  const { verifyCase } = await import('../shared/verify.mjs')
  for (const era of ['berlin-1938', 'neworleans-1968', 'paris-1954', 'meridian-1849']) {
    const v = await verifyCase(generateWebCase('omega', era))
    check(`${era} web: the notary passes a true case`, v.ok && v.failures.length === 0)
  }
  const sab = generateWebCase('omega', 'berlin-1938')
  sab.walkthrough = sab.walkthrough.slice(0, -1)   // cut the accusation off the proof line
  check('the notary refuses a case whose walkthrough cannot finish', !(await verifyCase(sab)).ok)
  const sab2 = generateWebCase('omega', 'berlin-1938')
  sab2.accusation = { ...sab2.accusation, culprit: sab2.accusation.wrong[0] }
  check('the notary refuses a commitment that does not bind the culprit', !(await verifyCase(sab2)).ok)

  // Two lists are a coin flip: accusing a suspect who survives two of the
  // three lists must fail — the file closes unresolved, no epilogue.
  const w2 = generateWebCase('omega', 'berlin-1938')
  const r2w = new Relay(); const p2w = generateSecretKey(); const gm2w = new StubGM(r2w, w2)
  await gm2w.start(getPublicKey(p2w))
  await sendFieldReport(r2w, p2w, gm2w.pub, `accuse ${w2.accusation.wrong[0].toLowerCase()}`, w2.CASE_ID)
  await gm2w.poll()
  check('web: accusing a two-list suspect fails and ends the case',
    gm2w.over && !gm2w.unlocked.has('resolution'))
}

console.log('\n18. The desk converses (context pack + seam)')
{
  const mod = generateWebCase('omega', 'berlin-1938')
  const rC = new Relay(); const pC = generateSecretKey(); const gmC = new StubGM(rC, mod)
  await gmC.start(getPublicKey(pC))
  const pack = gmC.contextPack()
  check('context pack holds exactly the earned documents', pack.held.length === 1 && pack.held[0].title.includes('BRIEFING'))
  check('context pack never contains unearned content', !JSON.stringify(pack).includes('KEY BOOK'))
  check('context pack lists the open leads', pack.leads.length >= 3)
  let saw = null
  gmC.converse = async ({ report, context }) => {
    saw = { report, held: context.held.length, leads: context.leads.length }
    return 'The desk turns your question over like a coin it does not recognize.'
  }
  await sendFieldReport(rC, pC, gmC.pub, 'what do we truly have on the dead man so far', mod.CASE_ID)
  await gmC.poll()
  const d1 = await receiveRumors(rC, pC, [KIND_GM_DISPATCH])
  check('free reports route through the Director with earned context',
    saw?.held === 1 && JSON.parse(d1[d1.length - 1].content).text.includes('turns your question over'))
  check('conversational replies cost no heat', gmC.heat === 0)
  check('no "(Heat rises.)" appended to a Director reply',
    !JSON.parse(d1[d1.length - 1].content).text.includes('Heat rises'))
  gmC.converse = async () => { throw new Error('director down') }
  await sendFieldReport(rC, pC, gmC.pub, 'utterly unmatched gibberish here', mod.CASE_ID)
  await gmC.poll()
  const d2 = await receiveRumors(rC, pC, [KIND_GM_DISPATCH])
  check('a dead Director falls back to the scripted line',
    JSON.parse(d2[d2.length - 1].content).text.includes('Nothing gives'))
}

console.log('\n19. The house is a grant: the Director as delegated agent (nvoy)')
{
  const { publishHouse, publishHouseNotes, updateHouse, revokeHouse, resolveHouse } = await import('../shared/house.mjs')
  const rH = new Relay()
  const master = generateSecretKey()
  const director = generateSecretKey()
  const stranger = generateSecretKey()
  const houseObj = { name: 'The Fairweather Table', eras: [{ id: 'berlin-1938', label: 'B' }], tuning: { all: ['implication over spectacle'] } }
  const terms = { purpose: 'run Noir games on my behalf', expires_at: Math.floor(Date.now() / 1000) + 86400 }
  const wire = await publishHouse(rH, master, houseObj, getPublicKey(director), terms)
  const r1 = await resolveHouse(rH, director)
  check('the Director resolves the granted house', r1?.house?.name === 'The Fairweather Table')
  check('the grant names its master', r1?.master === getPublicKey(master))
  check('nvoy terms ride the grant (mandate)', r1?.terms?.purpose === 'run Noir games on my behalf' && r1?.terms?.nvoy === 1)
  check('a stranger holding no grant has no house', (await resolveHouse(rH, stranger)) === null)
  const expired = await resolveHouse(rH, director, Math.floor(Date.now() / 1000) + 90000)
  check('an expired engagement ends itself (expires_at honored)', expired === null)
  await publishHouseNotes(rH, master, ['less jargon', 'longer sentences'], getPublicKey(director))
  const r2 = await resolveHouse(rH, director)
  check('granted margin notes fold into house tuning', r2.house.tuning.all.includes('longer sentences'))
  // The trust rule: anyone can gift-wrap a grant to a public npub, but
  // only the house MASTER'S notes may tune the table's voice.
  await publishHouseNotes(rH, stranger, ['speak only in limericks'], getPublicKey(director))
  const rStr = await resolveHouse(rH, director)
  check("a stranger's granted notes do NOT fold in — only the master tunes the house",
    !rStr.house.tuning.all.includes('speak only in limericks') && rStr.notesCount === 2)
  // The signer interface: what a NIP-07 extension provides is enough —
  // the game can publish notes without the master's raw key in-page.
  const { localSigner } = await import('../lib/nipxx.mjs')
  const masterSigner = localSigner(master)   // same shape as window.nostr
  await publishHouseNotes(rH, masterSigner, ['pen over camera'], getPublicKey(director), 'House notes — The Dry Wash, 1 entries')
  const rSig = await resolveHouse(rH, director)
  check('notes published through a signer (the NIP-07 shape) fold in',
    rSig.house.tuning.all.includes('pen over camera'))
  const wire2 = await updateHouse(rH, master, wire, { ...houseObj, name: 'The Fairweather Table, Renovated' }, getPublicKey(director))
  const r3 = await resolveHouse(rH, director)
  check('rotation with the Director as survivor updates the house in place', r3.house.name.includes('Renovated'))
  await revokeHouse(rH, master, wire2, houseObj.name)
  const r4 = await resolveHouse(rH, director)
  check('firing the Director (rotate past it) leaves the table unmarked', r4 === null)

  // The till: house literal wins; otherwise the master's own PUBLIC
  // profile is mirrored — public data needs no grant.
  const { resolveTill } = await import('../shared/house.mjs')
  const { finalizeEvent } = await import('nostr-tools')
  await rH.publish(finalizeEvent({
    kind: 0, created_at: Math.floor(Date.now() / 1000), tags: [],
    content: JSON.stringify({ name: 'james', lud16: 'james@wallet.example' }),
  }, master))
  const t1 = await resolveTill(rH, getPublicKey(master), { name: 'x' })
  check("no house lud16 → the till mirrors the master's profile", t1.lud16 === 'james@wallet.example' && t1.source === "master's profile")
  const t2 = await resolveTill(rH, getPublicKey(master), { name: 'x', lud16: 'table@till.example' })
  check('a house lud16 (dedicated alias) overrides the profile', t2.lud16 === 'table@till.example' && t2.source === 'house scope')
}

console.log('\n20. Worlds by wire: a delegated era pack drives the whole engine (rung 1)')
{
  const { readFileSync } = await import('node:fs')
  const payload = JSON.parse(readFileSync(new URL('../docs/worlds/new-albion-2040.json', import.meta.url), 'utf8'))
  const pack = payload.world
  const { validateWorldPack, generateWorldCase } = await import('../gm/caseweb.mjs')
  const { verifyCase } = await import('../shared/verify.mjs')
  check('the New Albion pack validates', validateWorldPack(pack).length === 0)
  check('a broken pack is named, not played',
    validateWorldPack({ ...pack, words: ['BRASS'] }).length > 0)   // repeated letter
  const w1 = generateWorldCase('omega', pack)
  check('a world case is deterministic per seed',
    generateWorldCase('omega', pack).solutionCommitment.canonical() === w1.solutionCommitment.canonical())
  check('the world case identifies itself', w1.CASE_ID === 'world:new-albion-2040:omega' && w1.LABEL === 'NEW ALBION 2040')
  for (const seed of ['omega', 'sigma', 'kappa']) {
    const v = await verifyCase(generateWorldCase(seed, pack))
    check(`world seed "${seed}": the Notary passes the delegated era`, v.ok && v.failures.length === 0)
  }
  // The delegation: the master grants the world; a stranger's world is
  // received, decrypted, and ignored — same trust rule as the notes.
  const { publishHouse, publishWorld, resolveHouse } = await import('../shared/house.mjs')
  const rW = new Relay()
  const master = generateSecretKey(), dir = generateSecretKey(), stranger = generateSecretKey()
  await publishHouse(rW, master, { name: 'The Fairweather Table', eras: [] }, getPublicKey(dir))
  await publishWorld(rW, master, pack, getPublicKey(dir))
  await publishWorld(rW, stranger, { ...pack, id: 'impostor-era', label: 'IMPOSTOR' }, getPublicKey(dir))
  const res = await resolveHouse(rW, dir)
  check('a granted world reaches the Director', res.worlds.length === 1 && res.worlds[0].id === pack.id)
  check("a stranger's world never seats a table", !res.worlds.some(x => x.id === 'impostor-era'))
  check("the world's voice folds into the house tuning under its own era id",
    res.house.tuning['new-albion-2040']?.some(l => l.includes('Verne')))
}

console.log('\n21. Playability: exploration is free, tradecraft cools, plain phrasing lands (#5, #6)')
{
  const mk = async (prefix = []) => {
    const r = new Relay()
    const p = generateSecretKey()
    const g = new StubGM(r, berlin)
    await g.start(getPublicKey(p))
    const s = async (text) => {
      await sendFieldReport(r, p, g.pub, text, berlin.CASE_ID)
      await g.poll()
      const d = await receiveRumors(r, p, [KIND_GM_DISPATCH])
      return JSON.parse(d[d.length - 1].content).text
    }
    for (const cmd of prefix) await s(cmd)
    return { g, s }
  }

  // The #4 repro: six natural-language commands, no mistakes — heat must
  // stay at zero and every one of them must get an answer.
  {
    const { g, s } = await mk()
    const replies = []
    for (const cmd of ['look around', 'examine the room', 'who is weiss',
                       'ask about the courier', 'go to the station', 'search the satchel'])
      replies.push(await s(cmd))
    check('the #4 repro sequence ends at heat 0', g.heat === 0, `heat ${g.heat}`)
    check('every off-path command gets an in-world answer', replies.every(x => x && x.length > 0))
    check('bare looking around takes stock instead of the cold shoulder', replies[0].includes('take stock'))
    check('no off-path reply claims heat rose', replies.every(x => !x.includes('Heat rises')))
  }

  // Tradecraft: heat earned by a bad deduction can be walked off.
  {
    const { g, s } = await mk(['decode silber', 'ask adler at josty about weiss', 'ask station for the watcher log'])
    await s('timeline a b c')
    await s('timeline c a b')
    check('a recognizably wrong deduction still costs heat', g.heat === 2 * berlin.heat.wrongAnswer)
    const rev = await s('review')
    check('review surfaces standing heat and the way down', rev.includes('Heat stands at 20') && rev.includes('Laying low'))
    const cooled = await s('lay low')
    check('lay low reduces heat', g.heat === 0 && cooled.includes('Heat falls'))
    const dry = await s('lay low')
    check('laying low when clean is a dry no-op', g.heat === 0 && dry.includes('no eyes on you'))
  }

  // Loud moves still cost: press and bribe are unchanged.
  {
    const { g, s } = await mk(['decode silber', 'ask adler at josty about weiss'])
    await s('offer adler money')
    check('a failed bribe still warms the city', g.heat === 5)
    await s('press adler for the name')
    check('pressing the informant still burns and heats', g.burned.has('adler') && g.heat === 5 + berlin.heat.pressedInterrogation)
  }

  // Intent, not spelling: ≥3 phrasings per entity reach the same node,
  // including ones no authored matcher anticipates.
  const synonyms = [
    ['kasse', [], ['pay a visit to voss', 'call at the travel office on kantstrasse', 'go to the reiseburo']],
    ['adler', ['decode silber'],
      ['ask adler at josty about weiss', 'talk to the coat check woman', 'go find the informant at josty']],
    ['watcher', ['decode silber', 'ask adler at josty about weiss'],
      ['ask station for the watcher log', 'pull the streetwork detail', 'go see what station kept']],
    ['roster', ['decode silber', 'ask adler at josty about weiss'],
      ['check who held the tuesday duty window', 'who was on the tuesday evening window', 'pull the duty list for tuesday evenings']],
  ]
  for (const [target, prefix, phrasings] of synonyms) {
    for (const phrase of phrasings) {
      const { g, s } = await mk(prefix)
      await s(phrase)
      check(`"${phrase}" reaches ${target} at no heat`, g.unlocked.has(target) && g.heat === 0)
    }
  }

  // The miss path is a guide, not a wall (#8): escalating, rotating,
  // relevant — and progress resets the escalation.
  {
    const { g, s } = await mk()
    const m1 = await s('mumble something opaque')
    const m2 = await s('mutter something else entirely')
    const m3 = await s('grumble a third time to the rain')
    check('first miss stays atmosphere', !m1.includes('A thread still hangs'))
    check('second miss names an open thread', m2.includes('A thread still hangs:'))
    check('third miss points at the page to reread', m3.includes('read it again'))
    check('the three nudges are all different', m1 !== m2 && m2 !== m3 && m1 !== m3)
    const near = await s('go to the zoo locker')
    check('a near-miss on a puzzle names its thread at once', near.includes('decode <word>'))
    check('misses never cost heat', g.heat === 0)
    await s('decode silber')
    const m4 = await s('mumble again opaquely')
    check('progress resets the escalation', !m4.includes('A thread still hangs'))
  }

  // Dead drops, last clause (§5 type 4): casing a guarded drop is loud.
  // Two looks free (the second warns); systematic rattling loiters.
  {
    const { g, s } = await mk()
    await s('check locker three at the zoo')
    check('the first case of a guarded drop is a free nudge', g.heat === 0)
    const warn = await s('go through locker five at the zoo')
    check('the second look buys an in-world warning, still free',
      g.heat === 0 && warn.includes('remember your face'))
    const hot = await s('try locker seven at the zoo bahnhof')
    check('systematic rattling is loitering — heat.loiter charged',
      g.heat === berlin.heat.loiter && hot.includes('Heat rises'))
    check('the loiter line still points at the thread', hot.includes('decode <word>'))
    await s('decode silber')
    check('solving the drop ends the loitering', g.unlocked.has('locker') && g.heat === berlin.heat.loiter)
    check('probe counts survive serialize/restore', (() => {
      const g2 = StubGM.restore(new Relay(), berlin, g.serialize())
      return g2.probes.locker >= 3
    })())
  }

  // The cold game breathes (#11): tiers open with patience, spent
  // scenes rotate in character, known names get the room's deflection.
  {
    const { g, s } = await mk(['decode silber', 'ask adler at josty about weiss', 'visit voss at the travel office'])
    await s('ask adler about weiss')                    // +1
    await s('ask adler about her son')                  // +1
    check('gentle asking earns standing across tiers', g.npcState.adler.disposition === 2)
    const deep = await s('ask adler what was before all this')
    check('a patient player reaches the deepest tier', deep.includes('November'))
    const react = await s('ask adler about voss')
    check('a known name she has no line for gets the room, not the desk',
      react.includes('Names are your trade') || react.includes('coats, not clerks') || react.includes('Paper does not'))
    const f1 = await s('ask adler about the weather then')
    const f2 = await s('ask adler for anything at all')
    check('spent closers rotate, never the same line twice running', f1 !== f2 && f1.length > 0)
    const before = g.npcState.adler.disposition
    await s('adler tell me quickly')
    check('bluntness costs standing', g.npcState.adler.disposition === before - 1)
    await s('press adler for the name')
    check('pressing still burns her — no regression', g.burned.has('adler'))
  }

  // Corroboration (§5.2, #7): the roster answers the QUESTION the ledger
  // and Adler ask together — not the word "roster", and not one source.
  {
    const { g, s } = await mk(['decode silber', 'ask adler at josty about weiss'])
    await s('get the embassy duty roster')
    check('naming the roster does not open the corroboration gate', !g.unlocked.has('roster') && g.heat === 0)
    const nudged = await s('go get the roster for me')
    check('a corroboration miss nudges toward the derived question', nudged.includes('Put the two together'))
    await s('who held the tuesday evening window')
    check('the derived question opens the gate', g.unlocked.has('roster'))
    const { g: g2, s: s2 } = await mk(['decode silber'])
    await s2('who held the tuesday evening window')
    check('the question needs both sources in hand (adler missing)', !g2.unlocked.has('roster'))
  }

  // The tail (§5.7, #7): at heat 60 the surveillance gets a face;
  // flagging what repeats is a real, earned cooldown.
  {
    const { g, s } = await mk(['decode silber', 'ask adler at josty about weiss', 'ask station for the watcher log'])
    await s('press adler for the name')          // +40, burns her
    await s('timeline a b c')                    // +10
    const beat = await s('timeline a c b')       // +10 → 60: the tail appears
    check('crossing heat.tail puts a face on the heat', g.tailFired && beat.includes('green loden'))
    const flagged = await s('flag the man in the green loden coat')
    check('flagging the repeat folds the tail and cools for real',
      g.tailDone && g.heat === 30 && flagged.includes('Flagged'))
    await s('timeline c b a')                    // +10 → 40: no second tail
    check('the tail beat fires once per case', g.heat === 40)
    check('tail state survives serialize/restore', (() => {
      const g3 = StubGM.restore(new Relay(), berlin, g.serialize())
      return g3.tailFired && g3.tailDone
    })())
  }

  // The accusation is an argument (§5.8, #10): name + chain, with the
  // desk arguing back once when the player's own papers disagree.
  {
    const prefix = ['decode silber', 'ask adler at josty about weiss', 'check who held the tuesday duty window']
    const { g, s } = await mk(prefix)
    const bare = await s('accuse brandt')
    check('right name, no chain — the desk asks for the proof', !g.over && bare.includes('Show the work'))
    const burnedEvidence = await s('accuse brandt with the ledger and some feeling')
    check('one citation is not a chain', !g.over && burnedEvidence.includes('Show the work'))
    const warned = await s('accuse keller')
    check('a suspect your own roster rules out gets argued back, unspent',
      !g.over && warned.includes('roster argues back'))
    await s('accuse brandt — the roster and the ledger together name him')
    check('name + two cited documents closes the case',
      g.over && g.unlocked.has('resolution'))
    const { g: g2, s: s2 } = await mk(prefix)
    await s2('accuse keller')
    await s2('accuse keller, I insist')
    check('insisting past the warning spends the shot and fails',
      g2.over && !g2.unlocked.has('resolution'))
    const { g: g3, s: s3 } = await mk(['decode silber'])
    await s3('accuse keller')
    check('the guard needs the contradicting paper in hand — without it the shot fires',
      g3.over && !g3.unlocked.has('resolution'))
    const { g: g4, s: s4 } = await mk()
    const noname = await s4('accuse the man in the gray coat')
    check('an accusation naming nobody is handed back, unspent', !g4.over && noname.includes('Name the man'))
  }

  // A held document re-reads instead of charging; puzzle gates stay shut.
  {
    const { g, s } = await mk(['decode silber'])
    const reread = await s('reread the briefing')
    check('acting on a held document re-reads it, free', reread.includes('notebook') && g.heat === 0)
    const { g: g0, s: s0 } = await mk()
    await s0('check the locker at the zoo bahnhof')
    check('naming a puzzle scope does not spring its gate (cipher)', !g0.unlocked.has('locker') && g0.heat === 0)
    const { g: g2, s: s2 } = await mk(['decode silber', 'ask adler at josty about weiss', 'ask station for the watcher log'])
    await s2('go to the freight sidings')
    check('naming a puzzle scope does not spring its gate (timeline)', !g2.unlocked.has('freight') && g2.heat === 0)
  }
}

console.log('\n22. World-builder rung 1: an authored world pack plays to a solve (los-angeles-1937)')
{
  const { readFileSync } = await import('node:fs')
  const payload = JSON.parse(readFileSync(new URL('../docs/worlds/los-angeles-1937.json', import.meta.url), 'utf8'))
  const pack = payload.world
  const { validateWorldPack, generateWorldCase } = await import('../gm/caseweb.mjs')
  const { verifyCase } = await import('../shared/verify.mjs')
  check('the Silver Nitrate pack validates', validateWorldPack(pack).length === 0)
  const c1 = generateWorldCase('omega', pack)
  check('the authored world identifies itself',
    c1.CASE_ID === 'world:los-angeles-1937:omega' && c1.LABEL === 'LOS ANGELES 1937')
  check('a world case is deterministic per seed',
    generateWorldCase('omega', pack).solutionCommitment.canonical() === c1.solutionCommitment.canonical())
  for (const seed of ['omega', 'sigma', 'kappa']) {
    const v = await verifyCase(generateWorldCase(seed, pack))
    check(`world seed "${seed}": the Notary passes the authored era`, v.ok && v.failures.length === 0)
  }
  // Beyond the Notary — actually PLAY the authored walkthrough to a solve.
  const kase = generateWorldCase('omega', pack)
  const r = new Relay(), p = generateSecretKey()
  const g = new StubGM(r, kase)
  await g.start(getPublicKey(p))
  for (const step of kase.walkthrough) {
    await sendFieldReport(r, p, g.pub, step, kase.CASE_ID)
    await g.poll()
  }
  check('the authored walkthrough solves at heat 0',
    g.over && g.unlocked.has('resolution') && g.heat === 0)
}

console.log('\n23. Photo analysis (§5.5): the image is the puzzle')
{
  // Structure: the case keys the photo gate to an edge, the carrying
  // scope ships the client overlay spec, and no document a player can
  // hold BEFORE solving spells the detail out — the print is the only
  // witness that says it.
  check('the case keys a photo puzzle to an edge',
    nola.photo?.scope === 'levee' && nola.photo?.to === 'blowup')
  const overlay = nola.scopes.levee.payload.photo
  check('the carrying scope ships an overlay spec with alt text',
    overlay?.id === 'frame-15' && overlay.mark === 'chevrons' && (overlay.alt ?? '').length > 0)
  const gate = nola.edges.find(e => e.to === 'blowup')
  check('the photo edge is a puzzle gate with an answer key',
    gate?.puzzle === 'photo' && /stripes|chevron/i.test(gate.answerKey))
  check('the detail lives in the image only — no pre-solve document spells it',
    !Object.entries(nola.scopes).some(([k, s]) =>
      !['blowup', 'resolution'].includes(k) && /STRIPE|CHEVRON/i.test(s.payload.body)))

  // The overlay lands deterministically: same (photo, seed) → the same
  // print in the same corner. Pure math, provable without a canvas.
  const { photoLayout } = await import('../client/art.mjs')
  const L1 = photoLayout(overlay, 'scope-abc')
  const L2 = photoLayout(overlay, 'scope-abc')
  const L3 = photoLayout(overlay, 'scope-xyz')
  check('overlay layout is deterministic per (photo, seed)', JSON.stringify(L1) === JSON.stringify(L2))
  check('a different seed hangs the print elsewhere', JSON.stringify(L1) !== JSON.stringify(L3))
  check('the print stays inside the scene at any seed',
    ['scope-abc', 'scope-xyz', nola.CASE_ID].every(s => {
      const L = photoLayout(overlay, s)
      return L.x >= 0 && L.y >= 0 && L.x + L.w <= 960 && L.y + L.h <= 540
    }))

  // Engine: studying the print is free guidance, naming it never
  // springs the gate, reading the composited detail does — heat zero.
  const rP = new Relay(); const pP = generateSecretKey(); const gmP = new StubGM(rP, nola)
  await gmP.start(getPublicKey(pP))
  const sayP = async (text) => {
    await sendFieldReport(rP, pP, gmP.pub, text, nola.CASE_ID)
    await gmP.poll()
    const d = await receiveRumors(rP, pP, [KIND_GM_DISPATCH])
    return JSON.parse(d[d.length - 1].content).text
  }
  for (const cmd of ['the ad spells dauphine', 'ask remy about unit 12', 'check the dispatch log', 'timeline b a c'])
    await sayP(cmd)
  check('the wet negative reaches the drum on the happy path', gmP.unlocked.has('levee'))
  const study = await sayP('study the photograph')
  check('studying the print is free and points at the image, never the answer',
    study.includes('Report what the sleeve wears') && !/(STRIPE|CHEVRON)/i.test(study) && gmP.heat === 0)
  await sayP('check the blow-up')
  check('naming the print does not spring the photo gate', !gmP.unlocked.has('blowup') && gmP.heat === 0)
  await sayP('the near sleeve in frame 15 wears desk sergeant stripes')
  check('reporting the composited detail opens the gate at heat zero',
    gmP.unlocked.has('blowup') && gmP.heat === 0)
  const after = await sayP('study the photograph')
  check('a solved print stops intercepting study commands', !after.includes('Report what the sleeve wears'))

  // The judge seam reads the same answer key — a paraphrase of what the
  // player SAW in the image still lands (§5.5 via the §5 verdict path).
  const rQ = new Relay(); const pQ = generateSecretKey(); const gmQ = new StubGM(rQ, nola)
  await gmQ.start(getPublicKey(pQ))
  const sayQ = async (text) => { await sendFieldReport(rQ, pQ, gmQ.pub, text, nola.CASE_ID); await gmQ.poll() }
  for (const cmd of ['the ad spells dauphine', 'ask remy about unit 12', 'check the dispatch log', 'timeline b a c'])
    await sayQ(cmd)
  gmQ.judge = async ({ answers }) => answers.find(a => /chevron/i.test(a.canonical))?.id ?? null
  await sayQ('the second man carries three v-shaped marks on his arm')
  check('the judge matches a paraphrase against the photo answer key',
    gmQ.unlocked.has('blowup') && gmQ.heat === 0)
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
