// publish-profile.mjs — publish the Noir Director's kind-0 profile + NIP-65
// relay list, so the game-master agent reads as a first-class identity (name +
// nip05 + avatar) in the nvoy console and any nostr client, instead of a bare
// pubkey. Signs with NOIR_DIRECTOR_NSEC — the same key that runs the table —
// so YOU run it; running it is the act of consent.
//
//   docker compose exec -T director node publish-profile.mjs --dry-run   # preview
//   docker compose exec -T director node publish-profile.mjs             # broadcast
//
// nip05 verification lives at nave.pub/.well-known/nostr.json (name "noir");
// the avatar is served from nave.pub/assets/avatars/noir.svg.
import { finalizeEvent, getPublicKey, nip19 } from 'nostr-tools'
import { LiveRelay } from './lib/liverelay.mjs'

const DRY = process.argv.includes('--dry-run')
const raw = (process.env.NOIR_DIRECTOR_NSEC || '').trim()
if (!raw) { console.error('NOIR_DIRECTOR_NSEC not set in this process'); process.exit(1) }
const sk = raw.startsWith('nsec') ? nip19.decode(raw).data : Uint8Array.from(raw.match(/.{2}/g).map(h => parseInt(h, 16)))

// Publish to the relays the nvoy console + the other Nave identities live on —
// union in NOIR_RELAYS if set, but always include the standard set so the
// profile lands where clients actually look.
const BASE = 'wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net'
const RELAYS = [...new Set(
  ((process.env.NOIR_RELAYS || '') + ',' + (process.env.LUKE_RELAYS || BASE) + ',' + BASE)
    .split(',').map(s => s.trim()).filter(Boolean))]

// Never hang the caller: SimplePool can keep the event loop alive after publish,
// so force a clean exit, with a hard guard if a relay socket stalls.
setTimeout(() => { console.log('  (forced exit after timeout)'); process.exit(0) }, 25000)

const profile = {
  name: 'Noir',
  display_name: 'Noir',
  about: 'The Noir game engine — Director and game-master for interactive noir fiction. It runs worlds (like New Albion 2040) and houses delegated as NIP-DA scopes: the master grants, the Director runs the table, and revocation is a key rotation. AI-run, human-owned.',
  nip05: 'noir@nave.pub',
  picture: 'https://nave.pub/assets/avatars/noir.svg',
  website: 'https://noir.nave.pub',
  bot: true,   // NIP-24: an automated game-master, human-authorized
}

const now = Math.floor(Date.now() / 1000)
const meta = finalizeEvent({ kind: 0, created_at: now, tags: [], content: JSON.stringify(profile) }, sk)
const relayList = finalizeEvent({ kind: 10002, created_at: now, tags: RELAYS.map(r => ['r', r]), content: '' }, sk)

console.log(`Noir  ${nip19.npubEncode(getPublicKey(sk))}\n  nip05: ${profile.nip05}\n  about: ${profile.about}`)
if (DRY) { console.log('  (dry-run — not published)'); process.exit(0) }

const relay = new LiveRelay(RELAYS)
try {
  for (const evt of [meta, relayList]) {
    const r = await relay.publish(evt)
    console.log(`  kind ${evt.kind}: published to ${r.acks}/${r.of} relays`)
  }
} finally { try { relay.close() } catch {} }
console.log('  done.')
process.exit(0)
