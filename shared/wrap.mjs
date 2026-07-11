// wrap.mjs — thin NIP-59 layer over nostr-tools, mirroring the internal
// seal/gift-wrap construction in lib/nipxx.mjs (which does not export it).
// Noir uses this for the two rumor kinds the game adds on top of NIP-DA:
//
//   14   field report   — player → GM: free-text commands, puzzle answers
//   441  burn notice    — GM → player: a scope you held has been rotated
//   15   GM dispatch    — GM → player: narrative beats, scene text
//
// Everything here is plain NIP-59: unsigned rumor, kind-13 seal, kind-1059
// wrap under an ephemeral key. Relays see only opaque blobs.

import { finalizeEvent, generateSecretKey, getEventHash, getPublicKey, nip44, verifyEvent } from 'nostr-tools'

export const KIND_FIELD_REPORT = 14
export const KIND_GM_DISPATCH = 15
export const KIND_BURN_NOTICE = 441

const now = () => Math.floor(Date.now() / 1000)
const fuzz = () => now() - Math.floor(Math.random() * 2 * 24 * 60 * 60)
const conv = (sk, pk) => nip44.v2.utils.getConversationKey(sk, pk)

// Every keyholder parameter accepts a raw 32-byte secret key OR a *signer*
// — { getPublicKey(), signEvent(e), nip44Encrypt(pub, pt), nip44Decrypt(pub, ct) },
// all async — the same interface as lib/nipxx.mjs. A NIP-07 extension
// (Alby, nos2x) maps onto this directly: sign in with your real nostr
// identity and the game plays under your npub without the key ever
// touching the page. Wired up when live relays land (M2).
const asSigner = (s) => s instanceof Uint8Array ? {
  getPublicKey: async () => getPublicKey(s),
  signEvent: async (event) => finalizeEvent(event, s),
  nip44Encrypt: async (pk, pt) => nip44.v2.encrypt(pt, conv(s, pk)),
  nip44Decrypt: async (pk, ct) => nip44.v2.decrypt(ct, conv(s, pk)),
} : s

/** Seal + gift-wrap an unsigned rumor to a recipient. Returns the kind-1059 wrap. */
export async function giftWrap(sender, recipientPub, rumor) {
  const signer = asSigner(sender)
  rumor.pubkey = await signer.getPublicKey()
  rumor.id = getEventHash(rumor)
  const seal = await signer.signEvent({
    kind: 13, created_at: fuzz(), tags: [],
    content: await signer.nip44Encrypt(recipientPub, JSON.stringify(rumor)),
  })
  const ephemeral = generateSecretKey()
  return finalizeEvent({
    kind: 1059, created_at: fuzz(), tags: [['p', recipientPub]],
    content: nip44.v2.encrypt(JSON.stringify(seal), conv(ephemeral, recipientPub)),
  }, ephemeral)
}

/** Unwrap a kind-1059 addressed to us. Returns the verified rumor. */
export async function giftUnwrap(recipient, wrap) {
  const signer = asSigner(recipient)
  const seal = JSON.parse(await signer.nip44Decrypt(wrap.pubkey, wrap.content))
  if (seal.kind !== 13 || !verifyEvent(seal)) throw new Error('bad seal')
  const rumor = JSON.parse(await signer.nip44Decrypt(seal.pubkey, seal.content))
  if (rumor.pubkey !== seal.pubkey) throw new Error('seal/rumor pubkey mismatch')
  return rumor
}

/** Player → GM: a command line typed at the drum. */
export async function sendFieldReport(relay, playerSecret, gmPub, text, caseId) {
  const wrap = await giftWrap(playerSecret, gmPub, {
    kind: KIND_FIELD_REPORT, created_at: now(),
    tags: [['case', caseId]],
    content: text,
  })
  await relay.publish(wrap)
  return wrap
}

/** GM → player: narrative text (and optional structured extras). */
export async function sendDispatch(relay, gmSecret, playerPub, { caseId, text, extra = {} }) {
  const wrap = await giftWrap(gmSecret, playerPub, {
    kind: KIND_GM_DISPATCH, created_at: now(),
    tags: [['case', caseId]],
    content: JSON.stringify({ text, ...extra }),
  })
  await relay.publish(wrap)
  return wrap
}

/** GM → player: a kind-441 burn notice for a rotated scope. Renders in-game as the BURN NOTICE card. */
export async function sendBurnNotice(relay, gmSecret, playerPub, { scopeId, generation, reason }) {
  const gmPub = getPublicKey(gmSecret)
  const wrap = await giftWrap(gmSecret, playerPub, {
    kind: KIND_BURN_NOTICE, created_at: now(),
    tags: [['a', `30440:${gmPub}:${scopeId}`], ['v', String(generation)]],
    content: JSON.stringify({ reason }),
  })
  await relay.publish(wrap)
  return wrap
}

/** Collect and unwrap all rumors of the given kinds addressed to `secret`, oldest first. */
export async function receiveRumors(relay, secret, kinds) {
  const signer = asSigner(secret)
  const pub = await signer.getPublicKey()
  const wraps = await relay.query({ kinds: [1059], '#p': [pub] })
  const rumors = []
  for (const wrap of wraps) {
    try {
      const rumor = await giftUnwrap(signer, wrap)
      if (kinds.includes(rumor.kind)) rumors.push({ ...rumor, _wrapId: wrap.id })
    } catch { /* not for us / not one of ours */ }
  }
  return rumors.sort((a, b) => a.created_at - b.created_at)
}
