// master.mjs — the player's REAL identity, via a NIP-07 extension.
//
// The field identity is a per-browser burner; it plays the case. This
// module is for the one act that must be signed by the master's own key:
// granting margin notes to the Director as a NIP-DA scope. The nsec
// never enters the page — nipxx speaks the signer interface, and a
// NIP-07 extension (Alby, nos2x) IS that interface. The Director folds
// only notes granted by its house master, so the signature is the
// authorization.

import { nip19 } from 'nostr-tools'
import { LiveRelay } from '../lib/liverelay.mjs'
import { publishHouseNotes } from '../shared/house.mjs'
import { loadGrantIndex, saveGrantIndex, toIssuedEntry } from '../lib/nipxx.mjs'

export const hasNip07 = () => typeof window !== 'undefined' && !!window.nostr

export function nip07Signer() {
  const n = window.nostr
  if (!n?.nip44) throw new Error('the extension lacks NIP-44 — update Alby/nos2x')
  return {
    getPublicKey: async () => n.getPublicKey(),
    signEvent: async (event) => n.signEvent(event),
    nip44Encrypt: async (pk, plaintext) => n.nip44.encrypt(pk, plaintext),
    nip44Decrypt: async (pk, ciphertext) => n.nip44.decrypt(pk, ciphertext),
  }
}

/** Ask the extension who the master is (prompts to connect on first use). */
export async function signIn() {
  if (!hasNip07()) return null
  const pub = await window.nostr.getPublicKey()
  localStorage.setItem('noir.master.pub', pub)
  return pub
}

/**
 * Publish margin notes straight from the game: a scope on the master's
 * identity, granted to the Director's npub, over the relays the table
 * watches. Best-effort ledgers the grant in the master's own kind-10440
 * index so the nvoy console can list and rotate it later.
 */
export async function sendNotesToHouse({ notes, name, directorNpub, relays }) {
  const signer = nip07Signer()
  const directorPub = nip19.decode(directorNpub).data
  const relay = new LiveRelay(relays)
  try {
    const wire = await publishHouseNotes(relay, signer, notes, directorPub, name)
    try {
      const index = await loadGrantIndex(relay, signer)
      index.issued.push(toIssuedEntry({ ...wire, scopeName: name }, [directorPub]))
      await saveGrantIndex(relay, signer, index)
    } catch { /* the send already landed; the ledger can catch up */ }
    return wire
  } finally {
    relay.close()
  }
}
