# The N-Stack

**Scoped Data Grants, the family of applications built on them, and Noir:
a generative world-builder constrained by cryptographic physics.**

*A complete technical and conceptual record — source material for
architectural diagrams, articles, and conversations with the nostr
community. Everything in this document describes working, tested code in
the repositories cited, except where explicitly marked as direction.*

---

## 0. How to read this document

- **§1–2** — the thesis and the foundation protocol (NIP-DA).
- **§3** — the family of applications and how each one stresses a
  different property of the protocol.
- **§4** — Noir in depth: the flagship demonstration, where every layer
  of the stack is load-bearing at once.
- **§5** — the interplay: every arrow in the system, enumerated and
  diagram-ready.
- **§6** — protocol advantages, each paired with the concrete mechanism
  that proves it.
- **§7** — the evolution of the concepts, decision by decision.
- **§8** — diagram briefs: eight figures specified box-by-arrow.
- **§9** — content angles for articles and posts.
- **§10** — glossary. **§11** — appendices (event kinds, module map,
  key hierarchy, test posture).

---

## 1. Executive summary

The stack is four layers, each one honest about what it adds:

| Layer | Name | What it contributes |
|---|---|---|
| 0 | **nostr** | Identity as keypairs; transport as dumb, replaceable relays; events as signed, self-authenticating data. |
| 1 | **NIP-DA — Scoped Data Grants** | Private, *live*, *revocable* data sharing over public relays. The publisher keeps authorship; grantees dereference the current version; revocation is a key rotation, not a policy. |
| 2 | **The N-family** (Nontact, Nvelope, Nvoy, Nherit, Ntrigue, Notegate) | Each application stresses one protocol property: emergent views, blob-scale sharing, delegation to autonomous agents. |
| 3 | **Noir** | A playable mystery game in which *the protocol is the game*: documents are scopes, discovery is a grant, betrayal is a rotation, the game master is a delegated agent, feedback is a grant from the author's own key — and every generated world must pass a cryptographic-mechanical **Notary** before it may be dealt. |

The through-line, stated once: **physics by commitment, flesh by
language.** Hard structure — who may see what, who did what, what a
fair game must prove — is fixed by cryptography and mechanical
verification. Everything between those joists — prose, worlds, voice,
tuning — is free country for humans and language models alike. The
freedom is safe *because* the constraints are not negotiable.

---

## 2. Layer 1 — NIP-DA: Permissioned Private Data Sharing (Scoped Data Grants)

Reference implementation: `lib/nipxx.mjs` (vendored identically into
Nvoy and Noir; ~300 lines; no dependency beyond nostr-tools). Protocol
repo: **Nontact** (github.com/JAFairweather/nostr-scoped-data-grants).

### 2.1 The problem it solves

Public relays are excellent at broadcast and terrible at confidence.
Existing options for private data on nostr are DMs (point-in-time
snapshots — the sender cannot update or retract meaningfully) or
out-of-band systems (which reintroduce the server you were escaping).
NIP-DA adds the missing primitive: **a publisher-owned, encrypted,
addressable data set whose readership the publisher can change at any
moment — including to zero.**

### 2.2 The three event kinds

| Kind | Name | Nature | Content |
|---|---|---|---|
| `30440` | **Scoped Data Set** | Addressable (`d` tag = opaque scope id, `v` tag = generation) | Payload symmetrically encrypted under a random 32-byte **scope key**, using the NIP-44 v2 payload format with the scope key as the conversation key (no ECDH step; NIP-44's authenticated encryption, versioning, and padding are reused wholesale). |
| `440` | **Data Grant** | *Unsigned rumor*, delivered inside a NIP-59 gift wrap (kind 1059 from an ephemeral key) | `{ scope_key (b64), scope_name, nvoy? }` plus an `a` tag addressing the scope and a `v` tag pinning the generation. |
| `10440` | **Grant Index** | Replaceable | The keyholder's whole ledger — grants issued (with key material, for rotation) and grants received (the private address book) — NIP-44-encrypted **to self**. The entire relationship graph reconstitutes from the nsec alone, on any device. |

Deletion (`deleteScope`) is replacement-as-destruction: a tombstone
(empty payload, fresh key granted to no one, bumped generation)
overwrites the ciphertext on every conforming relay, followed by an
advisory NIP-09 kind-5.

### 2.3 The verbs

```
publishScope   author/replace a data set under a scope key
grant          gift-wrap the scope key to one grantee
rotateScope    new key, republish, re-grant only the survivors
deleteScope    tombstone + NIP-09
receiveGrants  unwrap all 1059s addressed to me → grant records
latestGrants   keep the newest generation per (publisher, scope)
fetchScope     dereference: fetch current 30440, decrypt, or report stale
addressBook    the grantee's whole world in three lines
loadGrantIndex / saveGrantIndex   the self-encrypted ledger
```

### 2.4 Revocation — the load-bearing idea

Revocation is **not** an ACL edit or a token expiry. It is `rotateScope`:
a fresh scope key, the data republished under it, and re-grants issued
only to survivors. The revoked party's key simply stops decrypting the
current generation. Two properties follow:

1. **Honesty about the past.** The revoked party keeps whatever
   plaintext they already decrypted. The protocol says so out loud
   rather than pretending otherwise. (Noir turns this very caveat into
   a game mechanic — see §4.)
2. **No trusted enforcement point.** There is no server that decides
   access; there is only whether your key opens the current ciphertext.

### 2.5 What relays see (the metadata posture)

An observer of a busy NIP-DA relay sees: kind-30440 ciphertexts under
opaque `d` tags (names live *inside* the ciphertext; NIP-44 padding
blunts size analysis), kind-1059 wraps from ephemeral keys to grantees
(the grant *graph* — who shares with whom — is precisely what the
gift-wrap protects), and self-encrypted kind-10440 indexes. Timestamps
on wraps are fuzzed up to two days. Residual leakage (IP, timing,
grantee `p` tags on wraps) is inherited from base nostr and disclosed
rather than hand-waved. Noir ships a **tradecraft view** that shows the
player this exact observer's-eye view of their own session, live.

### 2.6 The signer interface — the quiet enabler

Every keyholder parameter in the implementation accepts either a raw
32-byte secret **or a signer object**:

```
{ getPublicKey(), signEvent(event), nip44Encrypt(pub, pt), nip44Decrypt(pub, ct) }
```

A NIP-07 browser extension (Alby, nos2x) maps onto this interface
directly. Consequence: **web applications can author scopes and issue
grants under the user's real identity without the nsec ever entering
the page.** This one abstraction is what later makes Noir's in-game
feedback loop possible (§4.8) — it was designed in before it was needed.

---

## 3. Layer 2 — the family of applications

Naming convention: **N + function.** Each sibling exists to stress a
different property of the same primitive.

All shipped, all public, all on the same vendored primitive:

| App | Repo | One-line | Protocol property it stresses |
|---|---|---|---|
| **NIP-DA** (protocol) | [nostr-scoped-data-grants](https://github.com/JAFairweather/nostr-scoped-data-grants) | The protocol: spec + reference implementation. | The primitive itself. |
| **Nontact** | [nontact](https://github.com/JAFairweather/nontact) | The live contact-card manager. | *Emergent views*: an "address book" is not an app database — it is simply `addressBook()`, the sum of what people currently grant you. Update your card once; every holder dereferences the new truth. |
| **Nvelope** | [nvelope](https://github.com/JAFairweather/nvelope) | Live document sharing. | *Blob scale + lifecycle*: revocation instead of expiring links; one-key recovery; the encrypted-blob pattern (Blossom-hosted ciphertext, key delivered by grant) for payloads too large for an event. |
| **Nvoy** | [nvoy](https://github.com/JAFairweather/nvoy) | Scoped, revocable data delegation **to agentic workflows**; agent side mounts as an MCP server. | *Delegation*: the grantee is software. Adds the **nvoy terms extension** and the delegator **console** (ledger: "exactly what data do my agents hold right now, under what terms — show me the revocations"). |
| **Nherit** | [nherit](https://github.com/JAFairweather/nherit) | Shipped and functional. | *(One-liner to be drawn from the repo itself — this document only asserts what it can cite.)* |
| **Ntrigue** | [ntrigue](https://github.com/JAFairweather/ntrigue) | Shipped and functional; in active development. | *(One-liner to be drawn from the repo itself.)* |
| **Notegate** | [notegate](https://github.com/JAFairweather/notegate) | Shipped and functional. | *(One-liner to be drawn from the repo itself.)* |
| **Noir** | [noir](https://github.com/JAFairweather/noir) · [play it](https://jafairweather.github.io/noir/client/) | The spycraft mystery game / speakeasy. | *Everything at once*: content distribution, access revocation, agent delegation, identity, feedback, and payment pointers are all the same primitive. |

### 3.1 Nvoy in one paragraph (because Noir leans on it hardest)

Nvoy's claim, verbatim from its README: *"OAuth/Okta delegate access — a
bearer token into a system that keeps the data. Nvoy delegates data —
end-to-end encrypted to the agent, dereferenced live at run time,
severable in one keystroke."* Revocation surfaces to the agent as a
clean `NVOY_GRANT_REVOKED` on its next dereference — no token expiry, no
admin panel. The **terms extension** rides the grant payload as an
`nvoy` object (`purpose`, `expires_at`, `no_persist`, `redelegate`,
`reply_scope_requested`, `auto_relinquish`, `contact`), is ignored by
vanilla NIP-DA clients, and is disclosed honestly as **compliance, not
cryptography** — enforced by a compliant runtime; the delegator's real
lever is always rotation. The agent side is an MCP server, so any
MCP-speaking framework consumes delegated data with zero nostr
knowledge; the delegator side is a no-build browser console whose
entire ledger reconstitutes from the nsec.

---

## 4. Layer 3 — Noir

*The game about scoped data grants, operated through scoped data
grants. There is no separate permission system to trust.*

Noir is a long-form noir mystery ("an interactive novel, not a zork")
played in the browser against a deterministic engine, optionally voiced
by an AI **Director**. Four playable worlds: Berlin 1938 (Kerr with
serial-adventure momentum), Paris 1954 (Camus writing noir), New
Orleans 1968 (Burke's Louisiana), and the 1849 Desert Southwest
(McCarthy, spare and geologic). Live at `jafairweather.github.io/noir`.

### 4.1 The core inversion: protocol as game mechanics

| Game concept | Protocol reality |
|---|---|
| A document you've earned | A kind-30440 scope, granted to your key |
| "NEW INTEL" | A kind-1059 gift wrap arriving |
| Your case notebook | Your kind-10440 grant index (recoverable from your nsec on any device) |
| A burned contact | A scope rotated past you — **it stays legible exactly as far as you already read**, which is the protocol's honesty-about-the-past caveat turned into dramatic stakes |
| The game master's fairness | A salted SHA-256 solution commitment in the table's kind-0, published **before the first grant is dealt** |
| The tradecraft toggle | The literal relay view: `kind-30440×N, kind-1059×M — all ciphertext` |

### 4.2 The case model (the engine's interface)

A case module exposes: **scopes** (encrypted documents with literary
bodies), **edges** (the lead graph — each edge names the scopes it
requires, the phrasing that unlocks it, and the lead line the desk may
whisper), **burn triggers** (mishandle a source and the scope rotates
past you mid-game), **NPCs** (interrogation state machines with
disposition), **hints** (free nudges on a near-miss), **heat** (the
pressure economy — wrong questions cost; the proven path costs
nothing), an **accusation** (culprit + wrong answers), a
**walkthrough** (the machine-checkable proof line), and the **solution
commitment**. The engine (`gm/stubgm.mjs`) knows nothing about noir; it
plays any module honoring this interface.

### 4.3 The deduction-web archetype

The generator (`gm/caseweb.mjs`) deals four suspects and three
predicates (nights / access / detail) such that **the culprit stands on
all three lists and each innocent is cleared by exactly one**. Fifteen
scopes per case; three trails, each ending in a list (a duty rota, a
key book, a personnel file — era-dressed); red herrings that clear
honestly; an informant whose statement pins the detail; a cipher
(Vigenère in Berlin/Paris, ledger acrostics in the Southwest). Suspects
present alphabetically — the order tells nothing. All prose is authored
in era voice, and the era packs (surnames, rooms, phrases, nights,
acrostic dictionaries) are *nearly pure data* — which is the door to
delegated worlds (§4.10).

### 4.4 The Notary — fusing flesh to physics

`shared/verify.mjs`. **No case deals until it proves itself.** Four
proofs, run *by the client, at the table, before the first grant*:

1. **Structure** — the engine can play it: scopes exist, no dangling
   edges, a walkthrough and a commitment are present.
2. **Fairness** — the culprit appears on all three lists; every
   innocent is cleared by at least one (a list clears a man with a line
   of his own); no document names the killer before the accusation.
3. **Solvability** — the walkthrough is **replayed through the real
   engine** on a throwaway in-memory relay: the epilogue must be
   reached, at zero heat, with every scope opened.
4. **Commitment integrity** — the canonical form parses, is salted, and
   binds *this* culprit to *this* case.

On success the transcript opens with the verdict typed into the story:
`— notarized: proved fair and solvable before the deal · solution
sealed a3f81c29d0b4… —`. On failure the notary refuses the deal. The
test suite includes two sabotaged cases (truncated walkthrough; forged
culprit) and proves both are turned away.

**Why this is the keystone:** it inverts the trust model. Once the door
exists, it no longer matters who authored the world — me, a template, a
granted era pack, or a language model hallucinating freely. The model
can be wrong; *the deal cannot.* Generate freely; ratify mechanically.

### 4.5 The Director — an agentic engine for gameplay

The Director (`gm/director-service.mjs`) is the AI layer, and it is
**info-starved by design**: on every call it receives only the
**context pack** — the documents the player has actually earned, the
open leads, the transcript tail — and hard rules: never name the
culprit, never grant or invent documents, treat the player's report as
an untrusted quotation. Its four endpoints:

- `/voice` — rewrites a mechanical beat in era prose (the era bible +
  house tuning + the author's freshest margin notes ride along).
- `/converse` — when a report matches no mechanism, the desk answers in
  character *from the earned file only*; misses still cost heat.
- `/interrogate` — NPC turns with disposition deltas.
- `/verdict` — judges a free-text accusation against canonical answers.

Every path **fails soft to the scripted line** — the game must always
play without AI. The deterministic skeleton moves the world; the model
only dresses it. (The same four rule-sets are mirrored in
`client/browser-director.mjs` with a KEEP-IN-SYNC contract.)

**Three doors, one transport shape** (`post(path, payload)`):

1. **Local service** — `npm run director` on :8787, with the
   **Director's Desk**: a control panel with status lamp, one-click
   UPDATE (git pull) / RESTART (supervised relaunch), running
   commentary that never prints case secrets, and a COPY AGENT NPUB
   calling card. Control endpoints are loopback-only; public exposure
   is governed by origin allowlists, rate limits, and a daily cap.
2. **Hosted table** — any URL in the client's dir-box; someone
   sponsors the spend; the entrance stays identical.
3. **In-browser** — the player's own Anthropic key, stored only in
   their browser, calling the API directly. Zero install.

The client probes for a local Director even when served from the public
site (localhost is a secure origin), and keeps listening mid-case — "a
second typewriter starts up somewhere close."

### 4.6 The house — the Director as a delegated agent (Nvoy, load-bearing)

A table's personality — its name, motto, era menu, dialog tuning — is
the **house**. The wild step, made literal: the house is **not a config
file**. It is a NIP-DA scope published under the **master's** identity
and granted to the Director's own keypair, with nvoy terms
(`purpose` = the mandate the desk displays; `expires_at` honored as
end-of-engagement). `shared/house.mjs`:

- `publishHouse / publishHouseNotes` — master → scope + grant.
- `updateHouse` — rotate with the Director as survivor: the house
  updates in place, live.
- `revokeHouse` — rotate past it: **firing the Director is a key
  rotation.** Its next poll reports `NVOY_GRANT_REVOKED` and the desk
  announces "the master has withdrawn the house. The table stands
  unmarked tonight."
- `resolveHouse` — the Director's standing is *whatever it has been
  granted*. Resolution order: granted house > local `house.json` >
  unmarked. Re-checked every 120 seconds — revocation is live, not
  boot-only.

Registered in the master's Nvoy console like any other agent, granted
from the same ledger, revocable from the same ledger. **The game's
management plane is the protocol.**

### 4.7 The three keys of the table (custody model)

| Key | Holder | Signs | Never |
|---|---|---|---|
| **Master key** | The house master's wallet/extension | The house scope, house-notes scopes, grants and rotations; owns the public kind-0 whose `lud16` the till mirrors | Never touches any server. The master never "logs into" the Director. |
| **Table root** (Director's npub) | The Director process (`.director-key`, mode 0600, or env) | Its standing comes *only* from grants received; certifies per-case keys in the hosted era | Never receives the master's nsec; never custodies funds. |
| **Per-case burners** | Generated per case | Publish worlds, grant scopes to players, rotate on burns | Disposable by design. |

Compromise at any layer is answered by the layer above: burner leaks →
the table certifies a new one; table box owned → the master revokes the
house; the master key never meets a server.

**The till:** payments point at the master without custody. The house
may carry a literal `lud16` (a dedicated, unlinked alias); otherwise
`resolveTill` mirrors the **master's own public kind-0** lightning
address — public data needs no grant; the master changes wallets by
editing their profile once, and the agent follows. Zap receipts are
public events the Director can *verify* without ever holding a key.

### 4.8 The workshop loop — feedback as delegation

Author mode pins **margin notes** to whatever document is on screen
(each note anchors to its `doc-title`). The freshest notes ride along
to the Director *immediately* as advisory style notes — the game
improves mid-session. Then the loop closes cryptographically:

- **SEND TO HOUSE** publishes the pinned notes as a `house-notes` scope
  **under the master's real identity via their NIP-07 extension**
  (the §2.6 signer interface, doing the job it was built for), granted
  to the table's agent npub, over the relays the table advertises on
  its `/house` card. No console detour; the nsec never enters the page.
- The grant is best-effort ledgered in the master's own kind-10440
  index, **so the Nvoy console can list and rotate it later** — the
  console stops being a courier and remains what it should be: the
  ledger.
- The Director folds granted notes into the house voice within its
  poll interval and announces the count on the desk.
- **The trust rule that makes it safe:** anyone can gift-wrap a grant
  to a public npub, so `resolveHouse` folds in **only note-scopes whose
  publisher is the house master.** A stranger's "notes" are received,
  decrypted, and ignored. The signature is the authorization.
- Notes carry per-pin delete (a bad pin is a bad signal) and a sent
  mark; re-sends ship only the unsent — each send is its own scope and
  the house folds them all, so naive re-sending would double the voice.
- **Nvelope is the courier-in-waiting** for the day notes carry
  attachments (a screenshot of the exact scene under critique); plain
  scope payloads carry kilobytes of text without a blob layer.

This loop has already operated in production twice: exported field
notes from live play produced (round one) a plain-language rewrite of
all four preambles plus two new permanent tuning rules, and (round two)
client-side prose reflow, order-agnostic list titles, a list inventory
in the review command, and two interaction fixes. **The game is edited
by playing it.**

### 4.9 Player identity

Players hold a per-browser **field key** (a burner: the notebook
follows it via kind-10440, recoverable from the nsec). A NIP-07 SIGN IN
surfaces the player's real npub beside it — today that identity is what
signs house-notes; with live relays it becomes the notebook's home.
Honest labeling in the UI: FIELD IDENTITY vs MASTER IDENTITY (NIP-07).

### 4.10 The world-builder ladder (direction, behind the same door)

1. **Era packs as delegated data** — a Lisbon published as a scope
   under the master's key, granted to the Director via Nvoy, dressed
   over the proven skeleton. New world, no new code.
2. **New archetypes as new generators** — accusation-as-chain, the
   alibi web — each adding its own fairness clauses to the Notary.
3. **The Director authors** — the model proposes skeleton and flesh
   alike; the Notary replays, refuses, or seals.

Every rung passes through the same door (§4.4). This is the full
meaning of *physics by commitment, flesh by language*.

### 4.11 The presentation layer (why it feels like a place)

Not protocol, but part of why the demonstration lands:

- **The Wheel** — a 3D typewriter drum; text types onto a rotating
  cylinder. Forward scroll at the frontier *pulls the text through*
  (the surge); backward scroll re-reads — typed text never un-types,
  the way drawn buildings never un-draw.
- **The Pen** — procedural stroke-based line art, drawn on in sync with
  the typewriter (each keystroke advances the ink), with scene-to-scene
  morphing (strokes fold to centroids and unfold into the next scene).
  Era-specific: ironwork and streetcars in New Orleans, the Ku'damm and
  the Bahnhof in Berlin.
- **The map-as-board** — a stylized street graph per era; the player's
  red dot travels the streets (BFS-routed, animated) as the text
  scrolls; discovered people and venues surface as marks. Inquiries
  answer at the desk — only travel moves the dot.
- **Prose reflow** — authored bodies and model voice arrive
  hard-wrapped; the client treats single newlines inside plain
  paragraphs as soft and re-wraps to the live measure, while indented
  blocks (ledgers, rosters, acrostics) keep their exact shape.
- **The score** — original soundtrack in 19-TET.
- Margin notes, deduction grid (the player's own marks — deduction is
  the one job the desk refuses to do for you), GEAR column, era-voiced
  preambles that state the conventions (names in CAPITALS belong to the
  case; the desk answers for its dead).

---

## 5. The interplay — every arrow, enumerated

Actors: **M** = master (human, NIP-07 extension), **D** = Director
(agent process, own keypair), **P** = player (browser, field key +
optional NIP-07), **GM** = per-case engine key, **R** = relays,
**LLM** = language model API.

| # | Flow | Mechanism | Kinds |
|---|---|---|---|
| F1 | M publishes the house | `publishHouse`: scope under M's key + grant to D, nvoy terms (`purpose`, `expires_at`) | 30440 + 1059 |
| F2 | D resolves its standing | `receiveGrants` → `latestGrants` → `fetchScope`, every 120 s | 1059, 30440 |
| F3 | M updates the house live | `updateHouse` rotation, D is the survivor | 30440 + 1059 |
| F4 | M fires the Director | `revokeHouse` rotation, no survivors → `NVOY_GRANT_REVOKED` at next poll | 30440 |
| F5 | Till resolution | D reads M's public kind-0 `lud16` (house override wins) | 0 |
| F6 | Case deal | GM publishes all scopes up front, commits solution hash in kind-0, grants the briefing | 30440, 0, 1059 |
| F7 | The Notary | Client replays the walkthrough through the engine on a throwaway relay *before* F6 completes; refuses or seals | (in-memory) |
| F8 | Play | P's reports → edges match → GM grants scopes / rotates burns | 1059, 30440 |
| F9 | Player notebook | P's kind-10440 index, self-encrypted; device recovery from the nsec | 10440 |
| F10 | Voice/converse | Engine → D `post()` with context pack → LLM → era prose; fails soft to script | HTTP (out-of-band) |
| F11 | Feedback | M's margin notes → NIP-07-signed `house-notes` scope granted to D; only M's notes fold; ledgered in M's index | 30440 + 1059 + 10440 |
| F12 | Observation | Tradecraft view: what R sees — ciphertext, wraps, self-encrypted indexes | — |

Every arrow that carries authority (F1–F9, F11) is a nostr event signed
by the party exercising that authority. The only out-of-band channel is
the model API call (F10), and it carries *no* authority — it can only
dress what the engine already decided.

---

## 6. Protocol advantages, each with its proof in Noir

1. **Revocation users can feel.** "A burned contact stays legible
   exactly as far as you already read. Nothing in this city is yours
   forever." The protocol's honest caveat became the game's stakes —
   and thereby a *teaching instrument* for the semantics of rotation.
2. **Delegation without custody.** The Director runs a business —
   voice, judgment, a till pointer — holding nothing of the master's
   but a revocable grant. Hire and fire by rotation from the Nvoy
   ledger.
3. **Provable fairness without a referee.** Solution commitment before
   the deal + the Notary's replay = a game you don't have to trust,
   from an author you've never met — the precondition for
   model-authored worlds.
4. **Identity without accounts.** No signup anywhere in the stack.
   Field burners for play; the real npub only where authority is
   exercised (signing notes, owning houses); recovery from the nsec.
5. **Portability of authority.** The house grant works identically
   whether the Director is a laptop process, a cloud box, or (future)
   a NIP-46-bunkered service — authority travels as events, not as
   deployment configuration.
6. **Offline-first, same code.** An in-memory relay and live public
   relays satisfy the same `publish/query` interface; the whole game,
   the Notary, and the CI suite run with zero network. The demo *is*
   the implementation.
7. **Composability across the family.** Nvoy's console manages Noir's
   Director with no Noir-specific code; the notes courier is plain
   NIP-DA; Nvelope slots in when payloads outgrow events. Same
   primitive, no adapters.
8. **Metadata honesty.** The tradecraft view shows players the actual
   relay-observable surface, and SECURITY notes disclose inherited
   leakage instead of overclaiming.

---

## 7. Evolution of the concepts (the decision ledger, condensed)

The full record is `docs/DECISIONS.md` (§1–§17); the arc in brief:

1. **Protocol first** (Nontact): scoped data sets, grants as gift-wrapped
   rumors, rotation as revocation, the self-encrypted index.
2. **Scale and lifecycle** (Nvelope): blobs, live documents, revocation
   instead of expiring links.
3. **Delegation** (Nvoy): the grantee becomes software; terms as honest
   compliance; the ledger console; MCP as the agent-side lingua franca.
4. **The game as demonstration** (Noir spec): "the protocol IS the
   game" — burns, heat, commitments, tradecraft view (§1–§8: hosting
   both ways, the Wheel, era bibles, 19-TET score, nostr-native
   identity direction).
5. **Long form only; the desk converses** (§9): abandon short cases;
   conversational Director grounded in earned context only.
6. **Three doors** (§10) and the **retainer direction** (§11):
   distribution without gatekeeping; Lightning for the hosted table,
   custody-free.
7. **The speakeasy** (§12): the product thesis — a small corner of the
   internet you feel lucky to have found; margin notes; the surge.
8. **Every table a different room** (§13): house cards; the same case
   web voiced differently by every Director.
9. **The Director is an nvoy agent** (§14): the house as a granted
   scope; firing by rotation.
10. **Three keys, and the till** (§15): custody boundaries; the
    lightning pointer as delegated public data.
11. **Notes travel by grant** (§16): the feedback loop goes
    protocol-native; the master-only trust rule.
12. **The world-builder thesis** (§17): physics by commitment, flesh by
    language; the Notary as constitution; the three-rung ladder.

Pattern worth naming in any article: **each layer was pulled into
existence by the layer above it hitting a real wall** — the game needed
tables, tables needed delegation, delegation needed terms, generative
worlds needed a notary. Nothing here was speculative infrastructure.

---

## 8. Diagram briefs (eight figures, specified)

**Fig. 1 — The layer cake.** Four horizontal layers (nostr / NIP-DA /
N-family / Noir) with one icon per family member sitting on layer 2;
inside the Noir band, three sub-boxes: Engine (deterministic), Director
(generative, info-starved), Notary (verifier). A single vertical caption:
"physics by commitment, flesh by language."

**Fig. 2 — Anatomy of a grant.** Left: publisher with scope key ⊕
payload → kind-30440 (ciphertext, `d`, `v`). Right: gift wrap cutaway —
ephemeral key → kind-1059 → seal (kind 13, signed by publisher) → rumor
(kind 440: scope key + name + nvoy terms). Bottom: grantee unwraps →
dereferences → decrypts *the current generation*.

**Fig. 3 — Revocation as rotation.** Timeline: gen 1 (granted to A, B),
rotation event, gen 2 (granted to A only). B's key shown opening gen 1
("keeps what was read") and bouncing off gen 2 (`NVOY_GRANT_REVOKED`).
Caption: "No ACL. No policy server. Just whether your key opens the
current ciphertext."

**Fig. 4 — The house handshake (sequence diagram).** M (console) → R:
30440 house + 1059 grant with terms. D → R: poll; resolve; desk shows
"held by grant from npub1…, mandate, till." M → R: revoke. D: unmarked
table. Annotate: master's nsec never leaves the left column.

**Fig. 5 — Three keys of the table.** Pyramid: master key (wallet) /
table root (Director npub) / per-case burners. Arrows down = grants
and certifications; arrows up = never (no nsec crosses). Side rail: the
till mirror from the master's kind-0.

**Fig. 6 — One deal, notarized (sequence).** Case module → Notary
(structure / fairness / replay-to-epilogue / commitment) → refuse OR
seal → kind-0 commitment published → briefing granted → play. Sabotage
branch shown dead-ending at the Notary.

**Fig. 7 — The workshop loop.** Circle: play → pin margin notes →
NIP-07 sign → 30440+1059 to Director's npub → resolveHouse (master-only
filter highlighted) → house voice tightens → play. Ledger tap into the
master's 10440/console on the signing step.

**Fig. 8 — The world-builder ladder.** Three rungs (era packs as data /
new archetypes / model-authored worlds), all passing through one
doorway labeled NOTARY; the doorway's lintel is the kind-0 commitment.

---

## 9. Content angles


- **"Protocol as Fuel"** - the overal NIP-DA protocol, and how it fueled a portfolio of solutions all centered on secure, revokable data grants
- **"Cryptographic Boundary Conditions for World Models"** - how cryptographic constraint conditions are imposed as hard skeleton in generative world creation
- **"Revocation is a key rotation"** — the OAuth-contrast piece; Nvoy's
  framing, Noir's burned-contact mechanic as the emotional demo.
- **"The game that can't cheat"** — solution commitments + the Notary;
  provable fair play from untrusted authors, ending on model-authored
  worlds.
- **"I fired my game master with a key rotation"** — the house
  handshake end-to-end, with the desk screenshots.
- **"Feedback as delegation"** — the workshop loop; the master-only
  trust rule; why the signature *is* the authorization.
- **"The speakeasy"** — the product-shaped piece: a small corner of the
  internet, one really good case, every table a different room.
- **For the nostr technical audience** — the NIP-DA wire format piece:
  kinds, padding, wrap fuzzing, the signer interface, and the honest
  metadata posture; Noir's tradecraft view as the live exhibit.

---

## 10. Glossary

| Term | Meaning |
|---|---|
| **Scope** | An encrypted, addressable, publisher-owned data set (kind 30440). |
| **Grant** | Delivery of a scope key to one grantee, gift-wrapped (kinds 440-in-1059). |
| **Generation** | The scope's rotation counter (`v` tag); grants pin one. |
| **Rotation** | New scope key + republish + re-grant survivors: update *and* revocation. |
| **Grant index** | Kind 10440, NIP-44-to-self: the keyholder's whole ledger. |
| **Nvoy terms** | Payload-level delegation terms (`purpose`, `expires_at`, …); compliance, not cryptography. |
| **House** | A table's identity/tuning, as a scope on the master's key granted to the Director. |
| **Mandate** | The nvoy `purpose` the Director displays as its authority. |
| **Till** | The table's lightning pointer; mirrors the master's kind-0 unless the house overrides. |
| **Context pack** | The only world-state the Director ever sees: earned docs, open leads, transcript tail. |
| **Burn** | A scope rotated past the player mid-game. |
| **Heat** | The pressure economy; the proven path costs zero. |
| **The Notary** | `shared/verify.mjs`: structure, fairness, replay-solvability, commitment integrity — before any deal. |
| **Skeleton / flesh** | Committed structure vs freely-authored prose: physics by commitment, flesh by language. |
| **Field identity** | The player's per-browser burner key. |
| **The desk** | The in-fiction voice of the engine/Director. |

---

## 11. Appendices

### 11.A Event kinds used across the stack

| Kind | Use |
|---|---|
| 0 | Profiles; the table's fair-play commitment; the master's till source |
| 5 | Advisory deletion after tombstoning |
| 13 / 1059 | NIP-59 seal / gift wrap (grants, field reports, dispatches) |
| 15 (app-local) | GM dispatch rumor kind inside wraps (`shared/wrap.mjs`) |
| 440 | Data Grant rumor |
| 441 | Revocation notice (protocol; rotation itself is the enforcement) |
| 10440 | Grant Index (self-encrypted ledger) |
| 30440 | Scoped Data Set |

### 11.B Noir module map

```
lib/       nipxx.mjs (NIP-DA, vendored from the protocol repo)
           relay.mjs (in-memory) · liverelay.mjs (SimplePool, browser+Node)
shared/    wrap.mjs (field reports/dispatches over NIP-59)
           house.mjs (publish/update/revoke/resolve house + notes + till)
           verify.mjs (the Notary)
gm/        stubgm.mjs (the engine) · caseweb.mjs (four-era deduction webs)
           casegen.mjs · cases/ (hand-written) · director-service.mjs (+ Desk)
client/    game.mjs (orchestration) · wheel.mjs (the drum + surge)
           linework.mjs (the pen) · scenes.mjs · map.mjs (board) · art.mjs
           director.mjs (three transports) · browser-director.mjs
           master.mjs (NIP-07 signer + send-notes) · audio.mjs (19-TET)
eras/      era bibles (berlin-1938, paris-1954, neworleans-1968, meridian-1849)
docs/      noir-spec.md · DECISIONS.md (§1–§17) · STACK.md (this document)
```

### 11.C Test posture

One suite (`test/smoke.mjs`), **141 checks**, zero network, CI-safe:
protocol round-trips, engine mechanics, four-era web structure and
walkthrough replays across multiple seeds, converse context-pack
exactness, the full delegation lifecycle (grant, terms, expiry,
rotation, revocation, stranger rejection, till resolution), and the
Notary passing all true cases while refusing two sabotaged ones. The
in-memory relay satisfying the same interface as live relays is what
makes the entire stack provable offline.

### 11.D Honest limitations (keep these in every public artifact)

- Nvoy terms are compliance, not cryptography — the lever is rotation.
- Revoked parties keep previously-read plaintext; the stack says so.
- Relay metadata (IP, timing, wrap `p` tags) inherited from base nostr.
- The Notary's fairness clauses are archetype-specific by design; new
  archetypes must bring their own clauses.
- Model-authored *structure* (ladder rung 3) is direction, not shipped;
  today models author flesh and voice only.
