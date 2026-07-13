# Decisions — spec §13, resolved 2026-07-11

Answers from the human (James). These close the spec's open questions;
change them here first if they change.

## 1. GM hosting — **both**

Local-first `npx noir-gm` for developers (bring your own Anthropic key),
hosted service for players later. One codebase, one seam: the GM process is
identical; only who runs it and whose API key it burns differs. Hosted is
the natural business layer (cases-as-a-service), not a fork.

## 2. Image backend — **FLUX to start; animated line-art world is the destination**

- **Now (M4):** `generateScene(brief, era)` backed by FLUX (Replicate/fal).
  The deterministic duotone post-process in `client/art.mjs` remains
  mandatory — never ship raw model output — so backend swaps are invisible
  to the player.
- **Long-term direction (v2+):** beautiful, monochromatic, almost line-art
  imagery **animating as the story is told**. The intended architecture: a
  **procedural line-draw engine, driven by FLUX stills** — stills act as
  keyframes; the engine extracts/edges them into line work and evolves the
  drawing frame-to-frame between keyframes as the narrative streams. The
  expensive model stays out of the render loop; the line aesthetic stays
  deterministic and ours (same principle as the duotone pass).
- **Stepping stones:** (1) **M3** ships FLUX stills + deterministic Ken
  Burns motion (pan/zoom/settle) in the client, alongside the Director —
  the story animates from the first AI-driven case; (2) **after M3**, spike
  the line-draw engine: edge extraction → stroke vectorization → stroke
  interpolation between consecutive stills. M4 then carries the rest of the
  imagery milestone (encrypted Blossom delivery, photo-analysis puzzles,
  drum/image reveal choreography) plus whatever the spike proves out.
- **Design consequence today:** keep `generateScene` stateless and
  brief-driven, but structure scene briefs as evolving *scene state*
  (location, actors, time, weather, focus) rather than one-shot prompts —
  successive keyframes must be *coherent evolutions*, not unrelated shots,
  or the line interpolation has nothing to draw between. Static images are
  a degradation path, not the architecture.

## 3. Tradecraft view — **yes, as a toggle**

Notebook toggle, off by default. When on: kind numbers, event IDs, `d`
tags, generations, wrap traffic. The fiction stays clean for players; the
best NIP-DA demo ever for the nostr-dev audience is one switch away.

## 4. Case length — **60–90 minutes**

Film-length, one sitting, one case. Casegen targets ~8–15 scopes, 4–6
puzzles, 2–4 red herrings per the spec. The async-friendly notebook still
lets a case span evenings, but it's *designed* to close in one.

## 5. First Director era — **Berlin 1938**

Richest spy grammar, and M1 shipped its bible plus a hand-authored case to
tune against. The sensitivity hard lines in `eras/berlin-1938.md` are
acceptance criteria for Director output, enforced by the M3 prompt-policy
test suite (spec §12), not aspirations.

## 6. Soundtrack — **original score in 19-TET** (added post-spec)

Kismet made law: the project was accidentally born in the 19TeamT repo
(19-tone equal temperament exploration), and the tuning is right for the
game — familiar shapes, wrong shadows; the score does for the ear what
duotone does for the eye. `client/audio.mjs` (the sax voice is ported from
19TeamT's synth).

- **Form:** long slow tones, generative, fully synthesized in-client
  (`f = ref × 2^(step/19)`, Web Audio, no samples, no assets). Deterministic
  per case seed — same themes on the same seed, never the same performance.
  Same skeleton/flesh split as prose and imagery.
- **Era instruments:** Berlin 1938 = **viola** (formant-filtered bowed
  saws). Meridian 1849 = **guitar** (Karplus-Strong strums). New Orleans
  1968 = **brass**, rooted in the 1910s funeral-dirge tradition — patience,
  swell, procession. Paris 1954 = **sax** in the cool-cellar idiom of the
  era's classic records: *idiom and instrumentation only — no melody is
  ever quoted.* Same rule as the literary touchstones: evoke, never
  reproduce.
- **Game-state hooks:** heat compresses the tempo and lifts the register
  (patience → pulse). A **burn stops the theme mid-phrase** — four seconds
  of true silence, then the room breathes again, quieter. The meter is
  something you hear.
- **It's a reading game:** the score is furniture — far under the drum,
  never competing with text. Off by default; one notebook toggle
  ("score (original 19-TET)").

## 7. Player identity — nostr-native sign-in (added post-spec)

Gameplay is *meant* to be part of your nostr identity: the notebook IS a
kind-10440 on your npub, achievements are grants you actually hold, and a
finished case is provable against the GM's commitment. Plan:

- **Demo mode (now):** a per-browser "field identity" (generated key,
  npub shown in the notebook). Right for a demo: zero friction, and there
  are no live relays yet for a real identity to matter on.
- **With live relays (M2):** three ways in — **NIP-07 extension**
  (Alby/nos2x; the signer interface in `lib/nipxx.mjs` and
  `shared/wrap.mjs` maps onto `window.nostr` directly, key never touches
  the page), **nsec/ncryptsec import** (NIP-49 at rest), or **field
  identity** for the cautious. The wrap layer is already signer-ready.
- **Practical caveat to test:** gift-wrap unwrapping calls the extension's
  nip44 decrypt per wrap — fine with a blanket permission grant, unplayable
  as one-prompt-per-event. If prompts are hostile in practice, default to a
  session key granted *by* the main identity (a NIP-DA grant, naturally)
  and let purists opt into raw NIP-07.
- **Recommendation stands:** don't use an identity you care about for
  throwaway runs; Noir is a game, not an opsec tool (SECURITY.md).

## 8. Case depth — toward the 200-page mystery (added post-playthrough)

The v1 cases are novellas; the target is a novel: a WEB of clues and
deductions, not a chain. Direction for casegen v3 and the Director era:

- **Deduction web, not corridor:** 15+ scopes per spec §4.2, with facts
  that cross-corroborate — no single scope names the culprit; the player
  assembles person × time × place × means from 3-4 independent document
  trails (the accusation endgame is already built for evidence chains).
- **Layered graph generation:** casegen grows from one template topology
  to composable motifs (a money trail, an alibi to break, a witness
  ladder, a document forgery) sampled per seed and cross-linked so each
  motif's answer feeds another's lock.
- **The map becomes a board:** locations gain adjacency and travel beats;
  leads pin to districts before they resolve to addresses. (Wireframe map
  shipped; markers already track visited/known.)
- **Deduction notebook:** let the player pin facts and draw connections;
  the accusation form asks for the chain (culprit + motive + supporting
  scope ids per spec §5.8) instead of one name.
- **The Director carries flesh at scale:** with 15+ scopes, hand-authored
  prose stops scaling — generated skeleton docs get Director re-fleshing
  at case start (spec §4.1's full intent), cached per case.

Sequencing: motif-based casegen first (testable offline, same walkthrough
proofs), then the deduction notebook UI, then Director re-fleshing.

**Progress:** `gm/caseweb.mjs` ships the first deduction-web topology
(both eras, `web:<era>:<seed>`, "THE LONG CASE" in the picker): four
suspects, three independent trails — the money, the paper, the witness —
each ending in a LIST (duty rota / key book / personnel particulars).
Each list clears exactly one different suspect; only the culprit stands
on all three; no scope names him. CI proves: 15+ scopes, walkthrough to
epilogue at heat 0, whole web opens, wrong two-list accusations fail,
determinism, and that the fairness invariants hold. Next: motif VARIETY
(swap which trail carries which predicate, alternate lock types per
seed), then the map-as-board, then the deduction notebook.

## 9. Long form only; the desk converses (added 2026-07-13)

Two decisions from the field:

- **Every offered case is a LONG CASE.** The picker lists exactly four
  webs, one per era — Berlin 1938 (Kerr with serial-adventure momentum),
  Paris 1954 (Camus writing noir), New Orleans 1968 (Burke), the
  Meridian 1849 (McCarthy). The short cases remain in the repo and CI
  as engine proofs, not offerings. FLUX imagery is deprioritized (the
  plate path stays, fail-soft) — the budget goes to words.
- **Free-form reports get a conversational Director.** When no
  mechanism matches a report, the engine hands it to /converse with the
  FULL earned context — every held document, open leads, heat, burned
  assets, transcript tail — and nothing unearned, so nothing can leak
  (spec §4.4 holds by construction). The Director answers in era voice,
  grounded in the file, never granting, never inventing; the scripted
  miss line remains the no-AI fallback, and misses still cost heat.
