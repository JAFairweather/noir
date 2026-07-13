# Noir: An Architecture

*How a mystery game became the proving ground for an entire protocol
stack — and what's genuinely new in it.*

---

Noir looks like a game. A typewriter drum turns in a dark room; ink
draws a street in Berlin or a mooring field in a steampunk 2040; a red
dot moves along a map while a hard-boiled narrator deals you documents
one earned page at a time. You ask questions in plain language. You
accuse someone. You are right or you are wrong, once.

Under the typewriter, though, there is no game server, no accounts
database, no permission system, and no trust in the narrator. Every one
of those absences is the point. Noir is the flagship demonstration of a
protocol stack for **scoped, revocable data sharing over nostr**
(NIP-DA), and its design rule is one sentence: *the game about scoped
data grants is operated through scoped data grants.*

## The stack it stands on

Four layers, each honest about what it adds (Fig. 1):

- **nostr** — identity is a keypair, transport is dumb relays, data is
  signed events.
- **NIP-DA (Scoped Data Grants)** — the missing primitive: a
  publisher-owned, encrypted, addressable data set whose readership the
  publisher can change at any moment, including to zero. Revocation is
  a key rotation, not a policy (Figs. 2–3).
- **The N-family** — [Nontact](https://github.com/JAFairweather/nontact)
  (contact cards as an emergent view),
  [Nvelope](https://github.com/JAFairweather/nvelope) (live documents,
  revocation instead of expiring links),
  [Nvoy](https://github.com/JAFairweather/nvoy) (delegation of data to
  autonomous agents, with honest terms and a ledger console), plus
  [Nherit](https://github.com/JAFairweather/nherit) (a family
  break-glass legacy vault),
  [Ntrigue](https://github.com/JAFairweather/ntrigue) (a party game of
  secrets and blackmail — Noir's sibling at the games table), and
  [Notegate](https://github.com/JAFairweather/notegate) (serverless
  newsroom tip intake) — all shipped, all public, all the same
  primitive.
- **Noir** — everything at once, load-bearing, in public.

![Fig. 1 — The layer cake](https://raw.githubusercontent.com/JAFairweather/noir/main/docs/figures/fig1-layer-cake.png)

## Protocol as game mechanics

The inversion that makes Noir interesting is that the protocol's
semantics *are* the game's rules, not a metaphor for them:

- A document you've earned is a kind-30440 scope granted to your key.
  "NEW INTEL" is literally a gift wrap arriving.
- Your case notebook is your kind-10440 grant index — self-encrypted,
  recoverable on any device from your nsec alone.
- A **burned contact** is a scope rotated past you. The protocol's
  honest caveat — a revoked party keeps what it already read — becomes
  dramatic stakes: *a burned source stays legible exactly as far as you
  already read. Nothing in this city is yours forever.*
- The **tradecraft view** shows you your own session as a relay
  observer sees it: ciphertext, wrapped grants under ephemeral keys,
  nothing else. The privacy claim is a toggle you can check.

## The three minds of the table

Inside the Noir band there are three components with three different
epistemologies (Fig. 1, inner boxes):

**The Engine** is deterministic and knows everything: the case web, the
solution, what unlocks what, what burns. It publishes a salted SHA-256
**commitment to the solution before dealing the first document** — the
fair-play promise, in public, in the table's profile.

**The Director** is generative and knows almost nothing. It is a
language model behind four endpoints (voice, converse, interrogate,
verdict), and it is *info-starved by design*: on every call it receives
only the documents the player has actually earned, the open leads, and
the transcript tail. It cannot leak the solution because it has never
held it. Every path fails soft to scripted prose — the game always
plays without AI. The model dresses the beat; it never decides it.

**The Notary** is the newest organ and the keystone (Fig. 6). Before
any case deals — hand-written or generated — the client proves it:
structure (no dangling edges), fairness (the culprit stands on all
three evidence lists, every innocent is cleared, no document names the
killer early), solvability (the walkthrough is *replayed through the
real engine* and must reach the epilogue at zero heat), and commitment
integrity. Then the transcript opens with the verdict typed into the
story: *— notarized: proved fair and solvable before the deal ·
solution sealed a3f81c29d0b4… —*. The thesis in one line: **physics by
commitment, flesh by language.**

![Fig. 6 — One deal, notarized](https://raw.githubusercontent.com/JAFairweather/noir/main/docs/figures/fig6-notarized-deal.png)

## The Director is an employee, not an owner

Each table has a personality — its **house**: name, motto, era menu,
dialog tuning. The house is not a config file. It is a NIP-DA scope
published under the *house master's* identity and granted to the
Director's own keypair via Nvoy, with terms (`purpose` becomes the
mandate the desk displays; `expires_at` ends the engagement). Update
the house: rotate with the Director as survivor. **Fire the Director:
rotate past it** — its next poll returns `NVOY_GRANT_REVOKED` and the
desk announces that the table stands unmarked tonight (Fig. 4).

![Fig. 4 — The house handshake](https://raw.githubusercontent.com/JAFairweather/noir/main/docs/figures/fig4-house-handshake.png)

Three keys, three custody zones (Fig. 5): the master's key never
touches a server; the Director's key holds nothing but revocable
grants; per-case burner keys do the noisy signing and are disposable.
Even payments follow the pattern without custody: the table's lightning
pointer mirrors the master's own public profile — the agent displays
where value goes; it never holds any.

![Fig. 5 — The three keys of the table](https://raw.githubusercontent.com/JAFairweather/noir/main/docs/figures/fig5-three-keys.png)

## The workshop loop: feedback as delegation

Noir is being written by being played. In author mode you pin margin
notes to the text as it flows; the freshest ride along to the Director
immediately as style notes. Then the loop closes cryptographically
(Fig. 7): **SEND TO HOUSE** publishes your notes as a scope under your
real identity — signed by your NIP-07 extension, nsec never entering
the page — granted to the Director's npub. The Director folds in *only
the master's* notes: anyone can gift-wrap a grant to a public key, and
a stranger must not be able to tune your table's voice. The signature
is the authorization. There is still no permission system anywhere.

This loop has operated in production: field notes from live play have
rewritten the openings of all four eras, added permanent voice rules,
and fixed interaction bugs. The game is edited by playing it.

![Fig. 7 — Feedback as delegation](https://raw.githubusercontent.com/JAFairweather/noir/main/docs/figures/fig7-workshop-loop.png)

## Worlds by wire

The newest capability closes the circle. An era — the whole setting:
names, rooms, phrases, a ledger of dead airships, a voice — is now
**data**: a world pack, published as a scope under the master's key and
granted to the Director like everything else. The engine dresses its
proven mystery skeleton in the pack; the Notary refuses anything that
doesn't prove out; the client seats the new world beside the built-in
eras. The first delegated world is a steampunk 2040 — dirigibles over
the estuary, digital newsprint that's gospel by dark and kindling by
dawn, steam velocipedes — and it reached the table the same way a
contact card reaches a friend: as an encrypted, revocable grant.

That is the ladder (Fig. 8): worlds as data today; new mystery
archetypes next, each adding its own fairness clauses to the Notary;
and eventually the Director proposing whole worlds itself — generate
freely, ratify mechanically. The author can be wrong. The deal cannot.

![Fig. 8 — The world-builder ladder](https://raw.githubusercontent.com/JAFairweather/noir/main/docs/figures/fig8-world-builder-ladder.png)

## What's actually novel here

1. **Revocation with feelings.** Key-rotation semantics taught through
   burned informants, not documentation.
2. **A provably fair narrator.** Commitment-before-deal plus mechanical
   replay: you don't trust the author, you check the proof.
3. **An AI with scoped ignorance.** The Director's safety is not a
   system prompt promise; it's an information architecture. It cannot
   reveal what it has never held.
4. **Management-plane-as-protocol.** Hiring, tuning, firing, and paying
   a game master are all grants, rotations, and public profile reads.
5. **Worlds as delegated data.** A genre travels over the same wire as
   a contact card, with the same revocability.

Everything above is running code with a 151-check offline test suite —
the in-memory relay satisfies the same interface as the live ones, so
the whole stack proves itself with zero network. Which is, in the end,
the whole aesthetic: a small dark room on the open internet where
nothing asks for your trust, because everything can show its work.

---

*The stack, all public:
[the NIP-DA protocol](https://github.com/JAFairweather/nostr-scoped-data-grants) ·
[Nontact](https://github.com/JAFairweather/nontact) ·
[Nvelope](https://github.com/JAFairweather/nvelope) ·
[Nvoy](https://github.com/JAFairweather/nvoy) ·
[Nherit](https://github.com/JAFairweather/nherit) ·
[Ntrigue](https://github.com/JAFairweather/ntrigue) ·
[Notegate](https://github.com/JAFairweather/notegate) ·
[Noir](https://github.com/JAFairweather/noir) —
[play Noir here](https://jafairweather.github.io/noir/client/).*
