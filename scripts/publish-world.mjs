// publish-world.mjs — the bridge from an authored world file to a table.
//
// You write a world in docs/worlds/*.json; the runtime never looks there.
// This carries it the last mile — validated first, so a broken world never
// reaches a table.
//
//   # Put it on MY table (edits house.json; the local Director serves it):
//   node scripts/publish-world.mjs docs/worlds/los-angeles-1937.json
//
//   # Share it with a FRIEND's table (grant it to their Director over the wire):
//   node scripts/publish-world.mjs docs/worlds/los-angeles-1937.json \
//        --grant <director-pubkey-hex> --relay wss://… --key <master-nsec-hex|path>
//
// --local (default) and --grant are the two ways a world reaches players;
// both run the same gate first: SCHEMA + NOTARY, so you cannot ship a world
// a real player can't solve.

import { readFileSync, writeFileSync } from 'node:fs'
import { validateWorldPack, generateWorldCase } from '../gm/caseweb.mjs'
import { verifyCase } from '../shared/verify.mjs'

const G = '\x1b[32m', R = '\x1b[31m', D = '\x1b[2m', X = '\x1b[0m'
const die = (msg) => { console.error(`${R}${msg}${X}`); process.exit(1) }

const args = process.argv.slice(2)
const opt = (name) => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
const file = args.find(a => !a.startsWith('--') && a !== opt('--grant') && a !== opt('--relay') &&
  a !== opt('--key') && a !== opt('--house') && a !== opt('--seeds'))
const grantTo = opt('--grant')
const housePath = opt('--house') ?? new URL('../house.json', import.meta.url)
const seeds = (opt('--seeds') ?? 'omega,sigma,kappa').split(',').map(s => s.trim()).filter(Boolean)

if (!file) die('usage: node scripts/publish-world.mjs <world.json> [--local | --grant <dir-pub> --relay <url> --key <hex|path>]')

let pack
try { const raw = JSON.parse(readFileSync(file, 'utf8')); pack = raw.world ?? raw }
catch (e) { die(`Could not read/parse ${file}: ${e.message}`) }

// ── Gate: never publish a world a player can't solve ───────────────────────
console.log(`\n${D}${pack.title ?? '(untitled)'} — ${pack.label ?? pack.id}${X}`)
const errs = validateWorldPack(pack)
if (errs.length) { errs.forEach(e => console.error(`  ${R}✗${X} ${e}`)); die('Schema failed — fix the fields above.') }
console.log(`  ${G}✓${X} schema`)
for (const seed of seeds) {
  const v = await verifyCase(generateWorldCase(seed, pack))
  if (!v.ok || v.failures.length) die(`  ${R}✗${X} Notary failed on seed "${seed}": ${JSON.stringify(v.failures)}`)
}
console.log(`  ${G}✓${X} Notary (seeds ${seeds.join(', ')})`)

// ── Publish ────────────────────────────────────────────────────────────────
if (!grantTo) {
  // LOCAL: merge into house.json's worlds[]. The Director reads this file;
  // the client's case-select shows house.worlds alongside the built-in eras.
  let house
  try { house = JSON.parse(readFileSync(housePath, 'utf8')) }
  catch (e) { die(`Could not read house file ${housePath}: ${e.message}`) }
  house.worlds = Array.isArray(house.worlds) ? house.worlds : []
  // house.worlds entries ARE full packs — the same shape resolveHouse delivers
  // over the wire (it pushes w.world). The client reads id/label/title/blurb
  // for the card AND passes the whole pack to generateWorldCase. A world is
  // identified by id; re-publishing replaces its entry in place.
  const existing = house.worlds.findIndex(w => w.id === pack.id)
  if (existing >= 0) house.worlds[existing] = pack
  else house.worlds.push(pack)
  writeFileSync(housePath, JSON.stringify(house, null, 2) + '\n')
  console.log(`\n${G}ON YOUR TABLE${X} — "${pack.title}" is ${existing >= 0 ? 'updated in' : 'added to'} ${housePath.pathname ?? housePath}.`)
  console.log(`${D}Restart the Director (npm run gm) and it appears on the case-select card.${X}\n`)
  process.exit(0)
}

// GRANT: publish to a friend's Director over the wire (the trust rule holds —
// only a world granted by the master seats their table; a stranger's is ignored).
const relayUrl = opt('--relay') ?? process.env.BUZZ_RELAY_URL
const keyArg = opt('--key') ?? process.env.NOIR_MASTER_KEY
if (!relayUrl) die('--grant needs --relay <url> (or BUZZ_RELAY_URL).')
if (!keyArg) die('--grant needs --key <master-nsec-hex|path> (or NOIR_MASTER_KEY). This must be the table master key.')
let masterSk
try {
  const hex = /^[0-9a-f]{64}$/i.test(keyArg) ? keyArg : readFileSync(keyArg, 'utf8').trim()
  masterSk = Uint8Array.from(hex.match(/.{2}/g).map(h => parseInt(h, 16)))
} catch (e) { die(`Could not read master key: ${e.message}`) }

const { LiveRelay } = await import('../lib/liverelay.mjs')
const { publishWorld } = await import('../shared/house.mjs')
const relay = new LiveRelay(relayUrl)
try {
  const wire = await publishWorld(relay, masterSk, pack, grantTo)
  console.log(`\n${G}GRANTED${X} — "${pack.title}" published to Director ${grantTo.slice(0, 12)}… (scope ${wire.scopeId.slice(0, 8)}…).`)
  console.log(`${D}Their Director resolves it on next poll; a world you did not grant never seats their table.${X}\n`)
} catch (e) { die(`Grant failed: ${e.message}`) }
finally { relay.close?.() }
process.exit(0)
