# Cryptographic Boundary Conditions for World Models

*How to let a language model build worlds without letting it cheat:
hard constraints imposed as committed skeleton, generative freedom
everywhere in between.*

---

There is a problem waiting at the intersection of generative AI and
games, and it is not hallucination. It is *authority*. The moment a
language model narrates an interactive world, it holds two jobs that
must never be held by the same untrusted party: it describes the world,
and it adjudicates it. A model that knows the mystery's solution will
leak it — in vocabulary, in pacing, in which door it lingers on. A
model that decides outcomes on the fly cannot be fair, because fairness
is a property of *commitments kept*, and an improviser commits to
nothing. Ask any tabletop player about a GM who fudges dice.

The usual fixes are prompt-shaped: "never reveal the culprit." Prompt
promises are policy, and policy begs. We built something harder, in a
playable mystery game called [Noir](https://github.com/JAFairweather/noir), and the principle generalizes to
any generative world model:

**Impose the physics cryptographically. Free the flesh linguistically.
And put a mechanical notary at the door between them.**

## Splitting the world

A Noir case is two artifacts with different epistemic status.

The **skeleton** is physics: who did it, which evidence clears whom,
what unlocks what, what can be destroyed, what the accusation costs.
It is generated deterministically, serialized canonically, salted, and
hashed — and that hash is published in the game master's public
profile **before the first document is dealt**. The player holds the
commitment from minute zero. When the case ends, the revealed solution
either matches the sealed hash or the table is caught cheating. No
appeal to reputation; arithmetic.

The **flesh** is language: every sentence of every document, every
room's smell, every witness's cadence. This is where the generative
model lives — and it lives there under an information architecture,
not a promise. The narrator receives, on every call, only a *context
pack*: the documents the player has actually earned, the open leads,
the last few lines of transcript. It has never held the solution, the
case graph, or an unearned page. Scoped ignorance beats aligned
intent: the model cannot leak what it does not know, and its purple
prose cannot alter an outcome the deterministic engine already decided.

## The notary

Commitment solves *cheating*. It does not solve *incompetence* — a
generated world can be committed to and still be unwinnable, unfair,
or self-spoiling. So between the author (any author) and the table
stands a verifier that refuses unproven worlds. Before a single
document is dealt, the case must pass, mechanically:

1. **Structure** — the engine can play it; every edge points at a real
   scope; a walkthrough exists.
2. **Fairness** — archetype-specific clauses. For a deduction web: the
   culprit appears on all three evidence lists; every innocent is
   affirmatively cleared by one; no document names the killer before
   the accusation.
3. **Solvability** — the walkthrough is *replayed through the real
   engine* on a throwaway in-memory relay, and must reach the epilogue
   at zero cost with every document opened. Not a static lint — an
   actual playthrough by machine.
4. **Commitment integrity** — the sealed hash parses, is salted, and
   binds this culprit to this case.

Pass, and the transcript's first line tells the player so, hash prefix
included. Fail, and there is no deal. Our test suite includes sabotaged
worlds — a truncated proof line, a forged culprit — and proves the door
stays shut.

![Fig. 6 — One deal, notarized](https://raw.githubusercontent.com/JAFairweather/noir/main/docs/figures/fig6-notarized-deal.png)

The consequence is an inversion of the trust model that we think is
the whole future of generative content: **once the door exists, the
author's trustworthiness is irrelevant.** Hand-written by a human,
assembled from templates, or proposed end-to-end by a model
hallucinating at temperature 1.0 — every world faces the same replay,
the same clauses, the same seal. Generate freely; ratify mechanically.
The author can be wrong. The deal cannot.

## Worlds as delegated data

Because the physics is portable, the flesh becomes *cargo*. We just
shipped the first proof: an entire era — a steampunk 2040 of
dirigibles, digital newsprint, and steam velocipedes — authored as a
few kilobytes of structured data (names, rooms, phrases, a registry of
dead airships that doubles as a cipher, a voice), published as an
encrypted scope under its author's cryptographic identity, and
*granted* to the game's AI director over nostr using revocable data
delegation ([Nvoy](https://github.com/JAFairweather/nvoy)). The director's next poll found a new world in its
hands; the engine dressed its proven skeleton in it; the notary
replayed it and sealed it; and the client offered it beside the
built-in eras. A genre traveled the same wire as a contact card — and
can be revoked the same way, by rotating a key.

The ladder from here is explicit. Rung two: new *archetypes* — new
skeleton shapes, each obligated to bring its own fairness clauses to
the notary. Rung three: the model proposes skeleton and flesh alike,
and the notary replays, refuses, or seals. The constraint system never
loosens as the generator gets stronger; that is the design's entire
posture. Capability grows inside a fixed constitution.

![Fig. 8 — The world-builder ladder](https://raw.githubusercontent.com/JAFairweather/noir/main/docs/figures/fig8-world-builder-ladder.png)

## Why this generalizes

Nothing above is mystery-specific. Any generative world model that
must be *fair* — an economy, a competitive scenario generator, an
education simulator, a procedurally-dealt tournament — decomposes the
same way:

- **Commit** the consequential structure before exposure, under a
  salted hash the audience holds from the start.
- **Starve** the generative layer: give it only what the audience has
  legitimately seen. Ignorance is cheaper than alignment and fails
  louder.
- **Notarize** every candidate world with proofs that replay the
  actual rules, not lint that approximates them.
- **Deliver** worlds as signed, revocable data, so authorship carries
  identity and distribution carries consent.

Boundary conditions in physics don't tell the fluid where to swirl —
they tell it where the walls are, and the turbulence between the walls
is where all the beauty happens. That is the right relationship
between cryptography and creativity in generative systems: the model
gets the turbulence. The walls get the math.

---

*Working code, all public: [Noir](https://github.com/JAFairweather/noir)
([play it](https://jafairweather.github.io/noir/client/)),
[Nvoy](https://github.com/JAFairweather/nvoy), and
[the NIP-DA protocol](https://github.com/JAFairweather/nostr-scoped-data-grants).*
