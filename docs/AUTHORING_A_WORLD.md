# Authoring a World

*An era is data.* (DECISIONS §17)

Noir's engine doesn't know about Berlin or New Albion. It knows about a
**counting-house murder**: an institution that keeps records, a victim who
kept the count, and a killer hiding inside the paperwork. Fill that skeleton
with names, rooms, a ledger, and a voice, and you get a fair, solvable,
atmospheric case out the other end — no code.

You write a **world pack**: one JSON file in `docs/worlds/`. The pack author
writes a world, never a mechanism.

---

## Quickstart

1. Copy an existing pack:
   ```
   cp docs/worlds/new-albion-2040.json docs/worlds/my-era.json
   ```
2. Edit the fields (see **The schema** below). Keep the shape; change the world.
3. Prove it before you ship:
   ```
   node scripts/validate-world.mjs docs/worlds/my-era.json
   ```
   Green on all three gates (**SCHEMA · NOTARY · PLAY**) means it's shippable.
   Any `✗` names exactly what to fix.

That's the whole loop: **copy → edit → validate.**

---

## The counting-house skeleton

Every Noir case is the same machine wearing a different coat. When you author,
you're casting these roles in your setting:

| The machine | Berlin 1938 | New Albion 2040 | Your era |
|---|---|---|---|
| an institution that keeps records | the embassy visa section | the Consolidated Mooring Trust | `company` |
| a victim who kept the count | the courier | the tally-master | `victimRole` + `victims` |
| **three lists** that together name the killer | roster · key book · particulars | watch rolls · bond-room key ledger · company particulars | `listNames` |
| a **cipher** hidden in a table of named things | ship names / intercepts | the airship ledger A–Z | `words` + `ledger` |
| informants who talk | Adler at Josty | Mrs. Tregarth, Oduya | `informants` |
| red herrings who don't | — | Spragg, Lumb (each with a real alibi) | `herrings` |
| physical **tells** | — | left-handed on the winch; brass badge | `details` |
| the murder in **three beats** | — | rides up · is met · one walks down | `beats` |
| a **voice** | — | Verne's machinery, le Carré's people | `tuning` + `openingLines` |

**The fair-play spine:** four suspects hold the inside of the institution.
Three trails (the three lists) each *clear* one suspect; the killer is the one
name standing on all three. That's why the accusation is an argument — you cite
the papers that put your suspect where the others can't have been.

---

## The schema

All fields live under the top-level `world` object. The validator
(`validateWorldPack`) enforces every rule below; here they are in plain terms,
with the Mooring Ledger as the worked example.

### Identity
| Field | Rule | Example |
|---|---|---|
| `id` | lowercase, `[a-z0-9-]`, ≥3 chars — becomes the case id | `"new-albion-2040"` |
| `label` | the case-select headline, >2 chars | `"NEW ALBION 2040"` |
| `title` | the case's name | `"The Mooring Ledger"` |
| `blurb` | one-line hook for the card | `"The high field loses its tally-master…"` |
| `style` | `{ "map": …, "scene": … }` — client rendering hints (`map`: e.g. `lattice`; `scene`: e.g. `street`) | `{ "map": "lattice", "scene": "street" }` |
| `tuning` | array of voice notes for the AI Director (used only when a Director is attached) | *"Steam and print: every scene smells of coal, oil, ink, or rain on hot iron."* |

### The institution
| Field | Rule | Example |
|---|---|---|
| `company` | the record-keeping institution | `"the Consolidated Mooring Trust"` |
| `victimRole` | who the victim was | `"tally-master of the high mooring field"` |
| `site` | where they were found | `"the foot of the north mooring mast"` |
| `doc` | the bonded document type | `"bonded lading chits"` |
| `room` | the records room | `"the bond room"` |
| `lodging` | the victim's lodging (a searchable scene) | `"the gasworks boarding house"` |
| `watchName` | the surveillance/patrol log | `"the aerodrome patrol log"` |

### The three lists (the accusation spine)
| Field | Rule |
|---|---|
| `listNames` | `{ "rota", "keybook", "personnel" }` — all three required. These are the three trails; the killer stands on all three, each innocent is cleared by exactly one. |

### The motive
| Field | Rule | Example |
|---|---|---|
| `motiveKeyword` | the command word that opens the motive | `"AUDIT"` |
| `motiveDoc` | the document that proves it | `"the tally books"` |

### The cipher
| Field | Rule |
|---|---|
| `words` | array, ≥1. Each word is `[A-Z]{4,8}` **with no repeated letter** (`VAPOR` ok, `BRASS` not). One becomes the key that opens the stash. |
| `ledger` | an object keyed by single letters. **Must contain an entry for every letter that appears in every word.** Each entry is a themed one-liner (airship names, film titles, whatever your world counts). |
| `stashPlace` | where the decoded word leads — **must contain the literal `{WORD}`** | `"the deflation locker on the {WORD} berth"` |

> The cipher puzzle: the player reads your ledger, spots the key word, and types
> `decode <word>` to open the stash. The ledger is the fun — make its entries
> little stories.

### The people
| Field | Rule |
|---|---|
| `surnames` | array, **≥6** — the suspect/name pool |
| `roles` | array, **≥4** — suspect roles inside the institution |
| `victims` | array, ≥1 — candidate victim surnames (one is picked per seed) |
| `informants` | array, ≥1. Each: `{ name, role, venue, alias }` — people who talk when you find them |
| `herrings` | array, **≥2**. Each: `{ name, trade, clears }` — suspects who look guilty but whose `clears` is an airtight alibi |
| `details` | array, ≥1. Each: `{ phrase, column, counter }` — a physical tell, the board column it fills, and the fact that clears whoever it seems to implicate |

### The night
| Field | Rule | Example |
|---|---|---|
| `nights` | array, ≥1. Each is `[SHORT, LONG]` | `[["TUE", "TUESDAY"], …]` |
| `beats` | array, **exactly 3** — the murder in three moments. Use `{VICTIM}` as a placeholder. | *"{VICTIM} rides the funicular to the high field…"* |
| `openingLines` | array of lines — the cold open. `{VICTIM}` is substituted. | the New Albion intro |

---

## Determinism, and why one world is endless

`generateWorldCase(seed, pack)` is deterministic: the same pack + same seed
always builds the same case. **Change the seed and you get a different culprit
and a different arrangement of the same world** — so a single authored pack is
an unbounded supply of fresh, fair mysteries. The validator checks three seeds
by default (`--seeds omega,sigma,kappa`); pass your own to spot-check more.

---

## How a world reaches players

Two paths, and they're the whole point of the design:

1. **In the repo** — add the file to `docs/worlds/` and (optionally) register it
   so it appears on the case-select card by default.
2. **By wire (the grant mechanism)** — a table's master *grants* a world to the
   Director with `publishWorld` (see `shared/house.mjs`). Only a granted world
   reaches the Director; a stranger's world is decrypted and **ignored** — the
   same trust rule that governs the private notes. You can hand someone a whole
   era over Nostr, and no one else's era can seat your table.

---

## Before you ship

Run the validator. It is three gates, and it is strict on purpose:

- **SCHEMA** — every field present and well-formed.
- **NOTARY** — the generated case is *fair* (the commitment holds, no trail leaks
  the answer) and *solvable*, checked per seed.
- **PLAY** — the authored walkthrough is actually played to the epilogue at heat 0.

```
node scripts/validate-world.mjs docs/worlds/my-era.json
```

`SHIPPABLE` means a real player can solve it and the game never cheated them.
That's the promise the skeleton keeps for you — so you can spend your afternoon
on the ledger's little stories and the informant's turn of phrase, which is
where the game actually lives. 🕯️
