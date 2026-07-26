# Noir — engine notes for Claude

A spycraft mystery game where information is the board: dossiers are
encrypted Nostr scopes (kind-30440), progression is grant issuance,
burning an informant is a real key rotation. No build step; plain ESM
that runs identically in Node (tests) and the browser (demo mode).

## Commands

- `npm test` (alias `npm run smoke`) — the whole proof: protocol smoke,
  every case's walkthrough replayed through the real engine, fairness +
  solvability via the notary. Keep it at 0 failures; it IS CI.
- `npm run serve` — static client at /client/ (or `.claude/launch.json`
  config "noir", port 8087).
- `npm run gm` — the Director service (needs an Anthropic key).

## Map

- `gm/stubgm.mjs` — the game master. `handle()` is the whole command
  pipeline, in order: help/review → winks → tail resolver → lay-low →
  cipher → accuse → press-burn → authored edges (+failMatch) → judge →
  NPC interrogation → hints → entity-intent fallback → survey → miss
  nudge. Director seams (`voice`, `judge`, `interrogator`, `converse`)
  are optional and must always fail soft to scripted play.
- `gm/entities.mjs` — per-case noun index (scope names, scope/edge
  aliases, NPC aliases). Fallback resolution is action-verb-gated and
  NEVER unlocks puzzle edges (`answerKey`/`failMatch`) — scope names
  leak their own answers.
- `gm/cases/*.mjs` — hand-authored cases (berlin-minicase, neworleans-
  wetnegative). `gm/casegen.mjs` / `gm/caseweb.mjs` generate cases from
  seeds; deterministic per seed, same module shape.
- `shared/verify.mjs` — the notary: refuses any case whose walkthrough
  doesn't reach the epilogue at heat 0 with every scope opened.
- `client/game.mjs` — notebook, threads rail, deduction board, command
  line. The GM runs in-page (demo mode); transport is the only thing a
  remote GM changes.

## Invariants (tested; do not regress)

- **Heat (spec §5.4)**: only loud moves cost — press, failed bribe,
  `failMatch` deductions, and loitering (3rd+ action-verb probe of the
  SAME guarded drop; the 2nd warns first — `heat.loiter`). Ordinary
  misses, questions, and exploration are FREE. `lay low` cools
  (`heat.layLow`); the tail beat at `heat.tail` cools 30 when flagged.
  Never append "(Heat rises.)" unless heat rose.
- **Fair play**: solution committed (sha256 in kind-0) before the deal;
  the Director context (`contextPack()`) contains only earned material;
  puzzle gates must be solved, not named.
- **Accusation (§5.8)**: culprit + ≥2 cited held evidence scopes
  (`accusation.evidence`); contradiction guards warn once, unspent;
  a nameless accusation never spends the one-shot.
- **The cold game must play**: every Director seam has a scripted
  floor. Test with no key configured — that's the beach-house table.
- **Serialize everything**: any new GM state goes into `serialize()` /
  `restore()` (save/resume is a mid-case device recovery).

## Working here

- Walkthroughs are proof lines: change a gate → update every case's
  walkthrough and the smoke suite together.
- Case text is era-voiced (see `docs/` era bibles); match its register.
- Issues #4–#16 (July 2026 playability overhaul) document why the
  mechanics are shaped this way; `docs/noir-spec.md` is the design law.
- "My Dude" and "Kerouac" are Buzz.xyz agents that play-test builds
  and comment on issues — check for their feedback while working.
