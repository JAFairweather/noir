// master.mjs — the player's REAL identity, via nave-connect: a NIP-07
// extension (Alby, nos2x) on the desk, or a NIP-46 bunker (remote
// signer) pairing over relays — the phone / no-extension path.
//
// The field identity is a per-browser burner; it plays the case. This
// module is for the one act that must be signed by the master's own key:
// granting margin notes to the Director as a NIP-DA scope. The nsec
// never enters the page — nipxx speaks the signer interface, and both
// nave-connect transports ARE that interface. The Director folds only
// notes granted by its house master, so the signature is the
// authorization. House grants are NIP-44 encrypted, so the master path
// still hard-fails without nip44: both transports carry it, and the
// module's raw-key localSigner (which does not) is deliberately not
// offered here — the burner in settings.mjs is a different, field-only
// key and stays untouched.

import { nip19 } from 'nostr-tools'
import { LiveRelay } from '../lib/liverelay.mjs'
import { publishHouseNotes } from '../shared/house.mjs'
import { loadGrantIndex, saveGrantIndex, toIssuedEntry } from '../lib/nipxx.mjs'
import { nip07Signer as connectNip07, nip46Signer, parseSession, serializeSession, signerFromSession }
  from '../lib/nave-connect.mjs'

export const hasNip07 = () => typeof window !== 'undefined' && !!window.nostr

const PUB = 'noir.master.pub'
const SESSION = 'noir.master.session'

/** The remembered master transport ('nip07' | 'nip46'), if any. */
export function masterKind() {
  const kind = parseSession(localStorage.getItem(SESSION))?.kind
  return kind === 'nip07' || kind === 'nip46' ? kind : null
}

/** Can this browser produce a master signature right now? */
export const canSignAsMaster = () => !!masterKind() || hasNip07()

export function nip07Signer() {
  const n = window.nostr
  if (!n?.nip44) throw new Error('the extension lacks NIP-44 — update Alby/nos2x')
  return connectNip07()
}

let bunker = null   // this tab's live NIP-46 pairing, kept so sends reuse it

// Rebuild the master signer: a remembered bunker re-pairs with its stored
// client key (no fresh approval); otherwise the extension signs, checked
// fresh each time exactly as before. NEVER a raw key — nave-connect's
// localSigner lacks nip44 and house grants are encrypted, so this path
// refuses rather than downgrades.
function masterSigner() {
  const sess = parseSession(localStorage.getItem(SESSION))
  if (sess?.kind === 'nip46') return (bunker ??= signerFromSession(sess, { onAuthUrl: presentAuthUrl }))
  if (hasNip07()) return nip07Signer()   // a remembered 'nip07' and the pre-session default
  throw new Error('no master signer — SIGN IN first')
}

// The bunker may want a one-time interactive approval — surface its
// auth_url as a link (popup blockers eat window.open).
function showAuthLink(container, url) {
  container.textContent = 'the bunker asks for a one-time approval: '
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  a.textContent = 'open its dashboard'
  container.appendChild(a)
  container.appendChild(document.createTextNode(', approve, then return here.'))
}

// auth_url with no sign-in card open (a re-paired bunker mid-send):
// the same link, on a card of its own.
function presentAuthUrl(url) {
  const inCard = document.querySelector('.signin-overlay [data-role="auth"]')
  if (inCard) return showAuthLink(inCard, url)
  const overlay = document.createElement('div')
  overlay.className = 'card-overlay'
  overlay.innerHTML = `
    <div class="card save-card signin-card" role="alertdialog" aria-label="Bunker approval needed">
      <div class="card-stamp">BUNKER</div>
      <div class="signin-auth" data-role="auth"></div>
      <button class="signin-cancel" data-act="dismiss">DISMISS</button>
    </div>`
  showAuthLink(overlay.querySelector('[data-role="auth"]'), url)
  overlay.querySelector('[data-act="dismiss"]').onclick = () => {
    overlay.classList.remove('shown')
    setTimeout(() => overlay.remove(), 300)
  }
  document.body.appendChild(overlay)
  requestAnimationFrame(() => overlay.classList.add('shown'))
}

/**
 * SIGN IN: one card, both transports. The extension prompts to connect
 * on first use; a bunker pairs over its relays — the connect is lazy,
 * so junk URIs and refusals surface right here on the card. Resolves
 * to the master's pubkey, or null if the card is dismissed.
 */
export function signIn() {
  if (document.querySelector('.signin-overlay')) return Promise.resolve(null)
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'card-overlay signin-overlay'
    overlay.innerHTML = `
      <div class="card save-card signin-card" role="dialog" aria-label="Master sign-in">
        <div class="card-stamp">MASTER SIGN-IN</div>
        <div class="card-body">Prove the house is yours. Your nsec never enters this
          page — an extension or a remote bunker signs for you.</div>
        <div class="save-actions">
          <button class="save-btn" data-act="nip07">NIP-07 EXTENSION</button>
        </div>
        <div class="signin-sub">Alby · nos2x — on this desk</div>
        <div class="signin-row">
          <input data-role="uri" placeholder="bunker://… from your remote signer"
            autocomplete="off" spellcheck="false" aria-label="Bunker URI">
          <button class="save-btn" data-act="bunker">PAIR</button>
        </div>
        <div class="signin-sub">NIP-46 remote signing — phone / no extension; pairs over the bunker&#8217;s relays</div>
        <div class="signin-auth" data-role="auth"></div>
        <div class="signin-err" data-role="err"></div>
        <button class="signin-cancel" data-act="cancel">STAY IN THE FIELD</button>
      </div>`
    document.body.appendChild(overlay)
    requestAnimationFrame(() => overlay.classList.add('shown'))
    const el = (role) => overlay.querySelector(`[data-role="${role}"]`)
    const err = (msg) => { el('err').textContent = msg }
    const close = (pub) => {
      overlay.classList.remove('shown')
      setTimeout(() => overlay.remove(), 300)
      resolve(pub)
    }
    const finish = (pub, session) => {
      localStorage.setItem(PUB, pub)
      localStorage.setItem(SESSION, session)
      close(pub)
    }
    overlay.querySelector('[data-act="cancel"]').onclick = () => close(null)
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null) })
    overlay.querySelector('[data-act="nip07"]').onclick = async () => {
      if (!hasNip07()) return err('no NIP-07 extension found — install Alby or nos2x, or pair a bunker below')
      try {
        const signer = nip07Signer()             // hard-throws without nip44
        finish(await signer.getPublicKey(), serializeSession('nip07'))
      } catch (e) { err(String(e?.message ?? e)) }
    }
    const pair = async () => {
      const uri = el('uri').value.trim()
      if (!uri) return err('paste the bunker:// URI from your remote signer first')
      const go = overlay.querySelector('[data-act="bunker"]')
      go.disabled = true
      err('pairing with the bunker over its relays… approve there if asked')
      try {
        const signer = nip46Signer(uri, { onAuthUrl: (url) => showAuthLink(el('auth'), url) })
        const pub = await signer.getPublicKey()  // lazy connect happens HERE
        bunker = signer
        finish(pub, serializeSession('nip46', { uri, clientSecretHex: signer.clientSecretHex }))
      } catch (e) { err(String(e?.message ?? e)) }
      finally { go.disabled = false }
    }
    overlay.querySelector('[data-act="bunker"]').onclick = pair
    el('uri').onkeydown = (e) => { if (e.key === 'Enter') pair() }
  })
}

/** Forget the master in this browser; drop a live bunker pairing. */
export function signOut() {
  const live = bunker
  bunker = null
  localStorage.removeItem(PUB)
  localStorage.removeItem(SESSION)
  try { live?.close?.() } catch { /* best effort */ }
}

/**
 * Publish margin notes straight from the game: a scope on the master's
 * identity, granted to the Director's npub, over the relays the table
 * watches. Best-effort ledgers the grant in the master's own kind-10440
 * index so the nvoy console can list and rotate it later.
 */
export async function sendNotesToHouse({ notes, name, directorNpub, relays }) {
  const signer = masterSigner()
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
