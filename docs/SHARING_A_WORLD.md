# Seeing & Sharing a World

Short version of the two questions this answers:

> **"If I create a world, do I automatically see it?"** — No. Authoring a file
> in `docs/worlds/` does not put it on a table. One command does.
>
> **"How are worlds shared?"** — Two ways: onto *your* table (local), or granted
> to a *friend's* table over the wire. Both below.

## Why a world file isn't automatically visible

You author a world in `docs/worlds/*.json`. The **runtime never reads that
folder.** The client's case-select is built from `director.houseCard.worlds`,
and the Director gets those from either:

- **`house.json`** — a local file the Director reads (its `worlds` array), or
- a **granted house** delivered over the wire (`resolveHouse`).

So `docs/worlds/` is where you *write* a world; `house.json` (or a grant) is
where the game *reads* one. `scripts/publish-world.mjs` is the bridge between
them — and it validates first, so a world a player can't solve never reaches a
table.

## Put it on my table (local)

```
node scripts/publish-world.mjs docs/worlds/my-era.json
```

Runs the gate (SCHEMA + NOTARY), then merges the pack into `house.json`'s
`worlds`. Restart the Director (`npm run gm`) and it appears on the case-select
card next to the built-in eras. Re-running replaces the entry in place — safe to
publish the same world twice.

## Share it with a friend's table (grant)

```
node scripts/publish-world.mjs docs/worlds/my-era.json \
     --grant <their-director-pubkey-hex> \
     --relay wss://relay.example \
     --key <your-master-nsec-hex|path>
```

Same gate, then `publishWorld` grants the era to their Director over the wire.
The trust rule holds by construction: **only a world granted by the table's
master seats their table; a world from a stranger is decrypted and ignored** —
the same rule that governs the private notes. `--relay` falls back to
`BUZZ_RELAY_URL`, `--key` to `NOIR_MASTER_KEY`; the key must be the table master
key, not a player key.

## One world is many cases

However a world reaches a table, it's deterministic *per seed*: each new game
draws a fresh seed, so the same era yields a new culprit and a new arrangement
every night. Author once; the table replays it indefinitely.

## The shape, if you're curious

A `house.worlds` entry **is the full pack** (the same object `resolveHouse`
delivers over the wire): its top-level `id/label/title/blurb` render the card,
and the whole pack feeds `generateWorldCase`. You don't assemble that by hand —
`publish-world.mjs` writes it for you. 🕯️
