# Protocol as Fuel

*How one small nostr primitive — the scoped, revocable data grant —
fueled a whole portfolio of applications, and what that says about
building on protocols instead of platforms.*

---

Most software portfolios grow sideways: a company ships a product,
then ships a second product, and the two share a login page and a
billing system and not much else. This is a story about a portfolio
that grew *upward* — seven public repositories, each one standing on the same
~300-line protocol implementation, each one built because the layer
below it hit a real wall.

## The primitive

NIP-DA — Scoped Data Grants — adds one missing thing to nostr. Relays
are excellent at broadcast and terrible at confidence: DMs are
snapshots you can never update or retract, and anything more
sophisticated usually reintroduces the server you were trying to
escape. NIP-DA's answer is a **scope**: a publisher-owned, encrypted,
addressable data set (kind 30440) whose key travels to each reader as
a gift-wrapped **grant** (kind 440 inside 1059). The publisher keeps
authorship forever; readers dereference the *current* version; and
revocation is not an ACL edit — it is a **key rotation**. Re-encrypt,
re-grant the survivors, done. The revoked party's key simply stops
opening the current ciphertext.

![Fig. 2 — Anatomy of a grant](https://raw.githubusercontent.com/JAFairweather/noir/main/docs/figures/fig2-anatomy-of-a-grant.png)

![Fig. 3 — Revocation as rotation](https://raw.githubusercontent.com/JAFairweather/noir/main/docs/figures/fig3-revocation-as-rotation.png)

Two design choices made everything after possible:

- **Honesty.** A revoked reader keeps whatever plaintext they already
  read, and the protocol says so out loud. No pretend un-sharing.
- **The signer interface.** Every operation accepts either a raw key
  or a NIP-07-shaped signer object — so a web page can author scopes
  and issue grants under a user's real identity without the secret key
  ever entering the page. This one abstraction was designed in before
  it was needed. It was needed.

## The portfolio it fueled

**[Nontact](https://github.com/JAFairweather/nontact)** came first,
alongside the [protocol repo](https://github.com/JAFairweather/nostr-scoped-data-grants)
itself: a contact-card manager.
Its insight is that an address book shouldn't be an app's database —
it's an *emergent view*, the sum of what people currently grant you.
Update your card once; every holder dereferences the new truth. Move,
change numbers, remarry — one edit, everyone current, and anyone you
drop simply stops seeing updates.

**[Nvelope](https://github.com/JAFairweather/nvelope)** pushed on scale and lifecycle: live document sharing where
a shared file is a scope, revocation replaces expiring links, and
recovery needs only your key. Blobs too large for an event ride
encrypted on Blossom with the key delivered by grant — same wire,
bigger cargo.

**[Nvoy](https://github.com/JAFairweather/nvoy)** made the leap that changed the trajectory: the grantee became
*software*. Delegating data to an AI agent is the moment access control
stops being about politeness and starts being about survival — and the
OAuth world has the wrong shape for it. A bearer token delegates
*access* into a system that keeps the data; Nvoy delegates *the data*,
end-to-end encrypted to the agent's key, dereferenced live at run
time, severable in one keystroke. Revocation surfaces to the agent as
a clean `NVOY_GRANT_REVOKED` on its next read. Terms — purpose,
expiry, no-persist — ride the grant and are enforced as *compliance,
not cryptography*, disclosed honestly; the delegator's real lever is
always rotation. The agent side mounts as an MCP server, so any
MCP-speaking framework consumes delegated data with zero nostr
knowledge.

The family kept growing on the same fuel, each sibling pointing the
primitive at a different hard problem.
**[Nherit](https://github.com/JAFairweather/nherit)** turned it toward
*time*: a family break-glass legacy vault — one estate record in
per-beneficiary scopes, heirs holding revocable grants, the whole
thing reconstituting from a single key printed on paper. No company
between you and your family.
**[Ntrigue](https://github.com/JAFairweather/ntrigue)** turned it
toward *adversaries*: a phones-only party game of secrets, dilemmas,
and blackmail, where every answer is an encrypted scope and pairwise
prisoner's-dilemma exchanges decide who sees what. Its design law —
*you can revoke a secret, but you can't un-tell it* — is the
protocol's honesty clause played for stakes.
**[Notegate](https://github.com/JAFairweather/notegate)** turned it
toward the *newsroom*: serverless tip intake where a tip line is a
keypair, sources are ephemeral keys with a 12-word phrase as their
only way back, proof-of-work is the spam toll, and the grant index
is the case docket.

**[Noir](https://github.com/JAFairweather/noir)**
([play it](https://jafairweather.github.io/noir/client/)) then asked
the unreasonable question: can the primitive carry
*everything*? A whole game — content, permissions, identity, agent
management, feedback, even payment pointers — with no other trust
system in the building? It can. Documents are scopes; discovery is a
grant; betrayal is a rotation; the AI game master is an Nvoy agent
whose entire authority is a revocable grant from its human master;
playtest feedback travels back as scopes signed by the master's own
key; and the newest step delivers entire *worlds* — a steampunk era as
pure data — over the same wire, gated by a mechanical fairness prover
before any of it may be played.

![Fig. 1 — The layer cake](https://raw.githubusercontent.com/JAFairweather/noir/main/docs/figures/fig1-layer-cake.png)

## The pattern worth stealing

Nothing in this stack was speculative infrastructure. **Each layer was
pulled into existence by the layer above it hitting a wall.** Contacts
needed liveness; documents needed scale; agents needed severability;
the game needed tables; tables needed delegation; generated worlds
needed a notary. When a protocol is small enough to vendor as one file
and honest enough to state its own limits, applications compose on it
the way the applications' *features* usually compose inside a single
product — except here, the portfolio's products interoperate with no
adapters at all. Nvoy's console manages Noir's game master without one
line of Noir-specific code, because "an agent holding a revocable
grant" is the same object in both worlds.

That's what protocol-as-fuel means. Not a platform with an SDK and a
partnerships team — a primitive with properties, and a family of
applications that are each, in the end, the same three lines:

```
receive the grants addressed to me
keep the newest per scope
dereference and decrypt the current truth
```

Everything else is what you choose to encrypt.
