// house.mjs — the house as a NIP-DA scope; the Director as delegated agent.
//
// The wild step, made literal: the house master's house — its name, its
// rooms, its dialog tuning, the distilled margin notes — is not a config
// file. It is an encrypted kind-30440 scope published under the MASTER'S
// identity, and the Director (which has its own nsec/npub) holds it only
// because the master GRANTED it (kind-440). The Director is an agent
// running games on the master's behalf, and its authority is a grant:
//   - update the house  → rotate with the Director as survivor
//   - fire the Director → rotate with no survivors; the key it holds
//     goes stale and the table stands unmarked by nightfall.
// The game about scoped data grants is operated through scoped data
// grants. There is no separate permission system to trust.

import { newScopeKey, publishScope, grant, rotateScope, receiveGrants, latestGrants, fetchScope } from '../lib/nipxx.mjs'

const randomScopeId = () =>
  'house' + [...crypto.getRandomValues(new Uint8Array(6))].map(b => (b % 36).toString(36)).join('')

/** Master publishes the house and hands the Director its grant. */
export async function publishHouse(relay, masterSk, house, directorPub, terms) {
  const wire = { scopeId: randomScopeId(), generation: 1, scopeKey: newScopeKey() }
  const name = `House — ${house.name ?? 'unnamed'}`
  await publishScope(relay, masterSk, {
    ...wire,
    payload: { name, kind: 'house', house },
  })
  await grant(relay, masterSk, directorPub, { ...wire, scopeName: name, terms })
  return wire
}

/** Master publishes distilled margin notes as their own granted scope. */
export async function publishHouseNotes(relay, masterSk, notes, directorPub,
                                        name = `House notes — ${notes.length} entries`) {
  const wire = { scopeId: randomScopeId(), generation: 1, scopeKey: newScopeKey() }
  await publishScope(relay, masterSk, {
    ...wire,
    payload: { name, kind: 'house-notes', notes },
  })
  await grant(relay, masterSk, directorPub, { ...wire, scopeName: name })
  return wire
}

/** Master publishes a WORLD PACK — an entire playable era as data
 *  (DECISIONS §17, rung 1). Same wire as everything else: a scope on
 *  the master's identity, granted to the Director's key. */
export async function publishWorld(relay, masterSk, world, directorPub, terms) {
  const wire = { scopeId: randomScopeId(), generation: 1, scopeKey: newScopeKey() }
  const name = `World — ${world.label ?? world.id}`
  await publishScope(relay, masterSk, {
    ...wire,
    payload: { name, kind: 'world', world },
  })
  await grant(relay, masterSk, directorPub, { ...wire, scopeName: name, terms })
  return wire
}

/** Update the house in place: rotate, keeping the Director inside. */
export async function updateHouse(relay, masterSk, wire, house, directorPub) {
  const name = `House — ${house.name ?? 'unnamed'}`
  const { generation } = await rotateScope(relay, masterSk, {
    scopeId: wire.scopeId, generation: wire.generation,
    payload: { name, kind: 'house', house },
    scopeName: name,
    survivors: [directorPub],
  })
  return { ...wire, generation }
}

/** Fire the Director: rotate past it. Its key goes stale; the house is withdrawn. */
export async function revokeHouse(relay, masterSk, wire, houseName = 'the house') {
  const name = `House — ${houseName}`
  const { generation } = await rotateScope(relay, masterSk, {
    scopeId: wire.scopeId, generation: wire.generation,
    payload: { name, kind: 'house', house: null },
    scopeName: name,
    survivors: [],
  })
  return { ...wire, generation }
}

/** The Director reads its standing: whatever house it has been granted.
 *  Returns { house, master, terms } or null — a revoked, expired, or
 *  absent grant is the same thing: no house, an unmarked table. Nvoy
 *  terms on the grant are honored as compliance (expires_at ends the
 *  engagement; purpose is displayed as the agent's mandate). Granted
 *  note-scopes fold into the house's tuning — but ONLY the master's:
 *  anyone can gift-wrap a grant to a public npub, and a stranger must
 *  not be able to tune the table's voice. */
export async function resolveHouse(relay, directorSk, nowSec = Math.floor(Date.now() / 1000)) {
  let house = null, master = null, terms = null
  const noteScopes = []
  const worldScopes = []
  for (const g of latestGrants(await receiveGrants(relay, directorSk))) {
    if (g.nvoy?.expires_at && g.nvoy.expires_at < nowSec) continue   // engagement over
    const res = await fetchScope(relay, g)
    if (res.status !== 'ok') continue
    if (res.data?.kind === 'house' && res.data.house) {
      house = res.data.house
      master = g.publisher
      terms = g.nvoy ?? null
    } else if (res.data?.kind === 'house-notes' && Array.isArray(res.data.notes)) {
      noteScopes.push({ publisher: g.publisher, notes: res.data.notes })
    } else if (res.data?.kind === 'world' && res.data.world?.id) {
      worldScopes.push({ publisher: g.publisher, world: res.data.world })
    }
  }
  if (!house) return null
  const notes = noteScopes.filter(n => n.publisher === master).flatMap(n => n.notes)
  if (notes.length) {
    house = { ...house, tuning: { ...(house.tuning ?? {}), all: [...(house.tuning?.all ?? []), ...notes] } }
  }
  // Worlds obey the same trust rule as notes: only the house MASTER may
  // hand this table an era. A stranger's world is received, decrypted,
  // and ignored. Pack tuning folds in under the world's own era id.
  const worlds = []
  const seen = new Set()
  for (const w of worldScopes.filter(w => w.publisher === master)) {
    if (seen.has(w.world.id)) continue
    seen.add(w.world.id)
    worlds.push(w.world)
    if (Array.isArray(w.world.tuning)) {
      house = { ...house, tuning: { ...(house.tuning ?? {}), [w.world.id]: [...(house.tuning?.[w.world.id] ?? []), ...w.world.tuning] } }
    }
  }
  return { house, master, terms, notesCount: notes.length, worlds }
}

/** The table's till: where zaps land. The house may carry a literal
 *  lud16 (a dedicated, unlinked alias — delegated private config); when
 *  it does not, the Director mirrors the MASTER'S OWN public kind-0
 *  profile — public data needs no grant, and the master changes wallets
 *  by editing their profile once. The agent follows. */
export async function resolveTill(relay, masterPub, house) {
  if (house?.lud16) return { lud16: house.lud16, source: 'house scope' }
  try {
    const profiles = await relay.query({ kinds: [0], authors: [masterPub] })
    const latest = profiles.sort((a, b) => b.created_at - a.created_at)[0]
    if (latest) {
      const meta = JSON.parse(latest.content)
      const lud16 = meta.lud16 ?? meta.lud06 ?? null
      if (lud16) return { lud16, source: "master's profile" }
    }
  } catch { /* no profile in reach */ }
  return { lud16: null, source: 'none' }
}
