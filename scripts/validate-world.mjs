// validate-world.mjs — the world-author's self-check (DECISIONS §17).
// Author a world pack in docs/worlds/, then prove it before it ships:
//
//   node scripts/validate-world.mjs docs/worlds/new-albion-2040.json
//   node scripts/validate-world.mjs docs/worlds/new-albion-2040.json --seeds omega,sigma,kappa
//
// Three gates, in order — each must pass:
//   1. SCHEMA   validateWorldPack: every field present and well-formed.
//   2. NOTARY   verifyCase: the generated case is fair and solvable (per seed).
//   3. PLAY     the authored walkthrough actually reaches the epilogue at heat 0.
//
// Exit 0 = shippable. Exit 1 = a named reason it is not. No network, no AI.

import { readFileSync } from 'node:fs'
import { generateSecretKey, getPublicKey } from 'nostr-tools'
import { Relay } from '../lib/relay.mjs'
import { StubGM } from '../gm/stubgm.mjs'
import { validateWorldPack, generateWorldCase } from '../gm/caseweb.mjs'
import { verifyCase } from '../shared/verify.mjs'
import { sendFieldReport, receiveRumors, KIND_GM_DISPATCH, KIND_BURN_NOTICE } from '../shared/wrap.mjs'

const G = '\x1b[32m', R = '\x1b[31m', D = '\x1b[2m', X = '\x1b[0m'
const ok = (s) => console.log(`  ${G}✓${X} ${s}`)
const no = (s) => console.log(`  ${R}✗${X} ${s}`)

const args = process.argv.slice(2)
const file = args.find(a => !a.startsWith('--'))
const seedsArg = args.includes('--seeds') ? args[args.indexOf('--seeds') + 1] : 'omega,sigma,kappa'
const seeds = seedsArg.split(',').map(s => s.trim()).filter(Boolean)

if (!file) {
  console.error('usage: node scripts/validate-world.mjs <world.json> [--seeds a,b,c]')
  process.exit(1)
}

let pack
try {
  const raw = JSON.parse(readFileSync(file, 'utf8'))
  pack = raw.world ?? raw   // accept either the wrapped {kind,world} file or a bare pack
} catch (e) {
  console.error(`${R}Could not read/parse ${file}:${X} ${e.message}`)
  process.exit(1)
}

console.log(`\nVALIDATING  ${file}`)
console.log(`${D}${pack.title ?? '(untitled)'} — ${pack.label ?? '(no label)'} · seeds: ${seeds.join(', ')}${X}\n`)

let failed = false

// ── Gate 1: schema ────────────────────────────────────────────────────────
console.log('1. SCHEMA (validateWorldPack)')
const errs = validateWorldPack(pack)
if (errs.length === 0) {
  ok('every field present and well-formed')
} else {
  failed = true
  for (const e of errs) no(e)
  console.log(`\n${R}Schema failed — fix the fields above and re-run.${X}\n`)
  process.exit(1)   // no point generating from a malformed pack
}

// ── Gate 2: notary (fair + solvable, per seed) ────────────────────────────
console.log('\n2. NOTARY (verifyCase — fair-play + solvability)')
for (const seed of seeds) {
  try {
    const v = await verifyCase(generateWorldCase(seed, pack))
    if (v.ok && v.failures.length === 0) ok(`seed "${seed}" — the Notary passes`)
    else { failed = true; no(`seed "${seed}" — ${JSON.stringify(v.failures)}`) }
  } catch (e) { failed = true; no(`seed "${seed}" — generation threw: ${e.message}`) }
}

// ── Gate 3: play the authored walkthrough to a heat-0 solve ────────────────
console.log('\n3. PLAY (the authored walkthrough reaches the epilogue)')
for (const seed of seeds) {
  try {
    const kase = generateWorldCase(seed, pack)
    const relay = new Relay(); const sk = generateSecretKey()
    const gm = new StubGM(relay, kase); await gm.start(getPublicKey(sk))
    for (const step of kase.walkthrough) {
      await sendFieldReport(relay, sk, gm.pub, step, kase.CASE_ID); await gm.poll()
    }
    const solved = gm.over && gm.unlocked.has('resolution')
    if (solved && gm.heat === 0) ok(`seed "${seed}" — walkthrough solves at heat 0 (${gm.unlocked.size} docs)`)
    else { failed = true; no(`seed "${seed}" — over=${gm.over} solved=${gm.unlocked.has('resolution')} heat=${gm.heat}`) }
  } catch (e) { failed = true; no(`seed "${seed}" — play threw: ${e.message}`) }
}

console.log(failed
  ? `\n${R}NOT SHIPPABLE${X} — address the ✗ above.\n`
  : `\n${G}SHIPPABLE${X} — schema, Notary, and play all green. Add it to the registry or grant it by wire.\n`)
process.exit(failed ? 1 : 0)
