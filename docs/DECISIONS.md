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

## 10. Director distribution — three doors, one game (added 2026-07-13)

The Director reaches players three ways, all behind one transport shape
(post(path, payload)), all failing soft to scripted prose:

1. **Zero-install (the landing page IS the installer):** Anthropic's API
   permits direct browser calls behind an explicit opt-in header. The
   notebook has a DIRECTOR box — paste an `sk-ant-…` key, press ENGAGE,
   and the Director wakes inside the page. The key lives only in that
   browser's localStorage and travels only to api.anthropic.com on the
   player's own account. client/browser-director.mjs mirrors the
   service's prompts (keep in sync).
2. **The local desk (developer's instrument):** `npm run director` —
   now a cross-platform Node supervisor (scripts/director.mjs; macOS /
   Windows / Linux) that pulls latest, runs the service, and relaunches
   on the desk's RESTART WITH UPDATE. Panel, commentary, update button.
3. **A sponsored table (hosted, James pays):** deploy the same service
   anywhere Node runs, set the keys, and hand players the URL — the
   same DIRECTOR box accepts a table address. Guardrails ship in the
   service, all off by default: NOIR_ALLOWED_ORIGINS (CORS allowlist),
   NOIR_RATE_LIMIT (per-IP per 5 min), NOIR_DAILY_CAP (calls per UTC
   day — the table 'closes for tonight' gracefully). Control endpoints
   (update/restart/stills) remain loopback-only always.

## 11. Lightning for the hosted Director — the retainer (added 2026-07-13, direction)

Someday-maybe made concrete enough to build when the time comes. The
sponsored table starts free (capped by NOIR_DAILY_CAP); when costs
justify, payment enters IN FICTION — the desk takes a retainer, per
case, flat. Never per-call: nickel-and-diming breaks the novel.

Three candidate rails, in rising order of thematic rightness:

1. **L402**: the table answers 402 Payment Required with a Lightning
   invoice; paying yields a token that authorizes the case. Standard,
   boring, works today with any wallet.
2. **NWC (Nostr Wallet Connect)**: the player connects a wallet once;
   starting a case zaps the table its retainer. Fits the nostr-native
   identity story (DECISIONS §7) — the same npub that holds your
   notebook pays your retainer.
3. **The retainer IS a NIP-DA grant** (the elegant one): payment buys a
   kind-440 grant from the table's npub — scope: one case at this
   table. The Director honors requests only from npubs holding a live
   retainer grant; welching burns it with a kind-441. The game's
   access-control protocol becomes its OWN paywall — cases-as-a-service
   (DECISIONS §1) implemented in the very primitive the game exists to
   demonstrate.

Pricing instinct: a LONG CASE costs the sponsor roughly a coffee in
model tokens; the retainer should feel like tipping a bartender, not
buying software — a few thousand sats, stated once, in period voice
('The desk takes its retainer in advance. The desk has been burned
before.'). Free tier stays forever: scripted prose is never paywalled,
and a player's own key (door 1) never touches the table.

## 12. What this is — the speakeasy (added 2026-07-13)

The goal, in the owner's words: a small corner of the internet people
DISCOVER, with the appeal of having found something genuinely unique —
the feeling of walking into the cool room the moment you arrive. Not a
venture; a place. Sponsored Director tokens are part of the door charge
the house covers.

Consequences, standing:
- **One exceptional case beats ten good ones.** The front-door case
  gets workshopped line by line. The instrument: MARGIN NOTES (author
  mode) — play the case exactly as the engine presents it, annotate the
  text as it flows (notes anchor to the document on screen), EXPORT as
  markdown for the workshop, and the freshest notes ride to the
  Director live as advisory style guidance. Feedback in, prose out,
  repeat for a round or two of gameplay per case.
- **The reader sets the pace.** Typing speed can never match every
  reader, so the scroll drives the typewriter: forward scroll at the
  frontier pulls text through the machine (the surge); backward,
  everything already typed stays typed — pages do not un-write
  themselves, same law as the pen's buildings. The ambient typist
  remains for readers who just watch.
- The pen backdrop stays and keeps getting refined.

## 13. Every table is a different room (added 2026-07-13)

A Director is not infrastructure; it is THE HOUSE. Each table carries
its own identity in `house.json`: the table's name, its motto, the
SCENARIOS it offers (the picker is built from the house card of
whatever table you are seated at), and its DIALOG TUNING — persistent
per-era voice notes that ride every voice, converse, and interrogation
call (advisory; the hard rules always win). GET /house serves the
card; /health carries the house name; the notebook status line reads
'TABLE: <name>' when seated.

The engine's era ids are the only constraint on what a table may
offer (client filters against SUPPORTED_ERAS). The Fairweather Table
runs four rooms: Berlin 1938 (Kerr-with-momentum), Paris 1954 (Camus),
New Orleans 1968 (Burke), the Meridian 1849 (McCarthy). Another
operator edits one JSON file and opens an entirely different room —
same game, different house, different voice. Margin-notes workshops
distill INTO house tuning: session notes that prove out graduate to
house.json.

## 14. The Director is an nvoy agent (added 2026-07-13)

The wild step, and the obvious one: the house master's house is not a
config file — it is a NIP-DA scope on the MASTER'S identity, granted
(kind-440) to the Director's own keypair. The Director is a delegated
agent running games on the master's behalf, and its authority IS the
grant. This is nvoy (github.com/JAFairweather/nvoy) exactly — same
wire (noir's libs were vendored from it), plus the nvoy terms
extension honored as compliance: `purpose` displays as the agent's
mandate, `expires_at` ends the engagement by itself.

- The service holds a persistent agent identity (.director-key /
  NOIR_DIRECTOR_NSEC); its npub prints in the boot banner and on the
  desk — that npub is what the master registers in the NVOY CONSOLE,
  which becomes the house-master's control room: author the house
  scope, grant it, watch the ledger, rotate on a schedule, revoke.
- Resolution order: granted house > house.json > unmarked table.
  Transport: NOIR_RELAYS (live, what the console uses) or a local
  events file. Re-dereferenced every two minutes: updates arrive by
  rotation-with-survivor, and revocation is LIVE — the desk logs
  NVOY_GRANT_REVOKED and the table stands unmarked by the next poll.
- Margin notes graduate the same way: granted house-notes scopes fold
  into the house tuning. The master's taste is data on the master's
  key, delegated like everything else.

Eight CI proofs: resolve, master attribution, terms/mandate, stranger
gets nothing, expiry self-enforces, notes fold in, rotation updates in
place, revocation unmakes the table.

## 15. The three keys of the table (added 2026-07-13, direction)

Answering "will I ever need the Director's nsec?" for good. Money
never goes to the Director; grants eventually come FROM it; nobody
ever logs in as it. The hierarchy:

1. **The master key (yours).** Owns the house scope, receives ALL
   payments (the table's kind-0 lightning address points at YOUR
   wallet — zaps land with you; the Director merely VERIFIES public
   zap receipts, custodying nothing), hires and fires the Director by
   grant. Lives in your wallet/extension. Never on a server.
2. **The table root key (the Director's stable npub).** The table's
   public identity: signs fair-play commitments, certifies per-case
   keys, carries the speakeasy's reputation. Back up the key file for
   continuity; manage it only ever from layer 1 (revoke the house
   grant — never 'log in'). Could later live in a NIP-46 bunker so
   the nsec never touches the cloud box at all.
3. **Per-case burner keys.** Publish worlds, grant scopes to players,
   rotate on burns — the noisy signing. Disposable by design (already
   the in-page pattern); the table root's certification makes a
   burner trustworthy in the hosted era.

Compromise at any layer is answered by the layer above: burner leaks,
the table certifies a new one; table box owned, the master revokes
the house; the master key never meets a server.

**The lightning-pointer question, resolved:** the Director necessarily
knows the master's NPUB (it is the grant's publisher — that is how the
agent knows whose house it runs; npubs are public identity, not
secrets). The master's LIGHTNING ADDRESS is a public payment pointer
(pay-only, never withdraw) and travels inside the house scope itself —
a `lud16` field the Director stamps into the table's kind-0. Delegated
in, updated by rotation, withdrawn by revocation, like everything
else. Privacy note: the table's lud16 is publicly visible; a master
who wants the house unlinked from their personal identity mints a
dedicated alias (the house gets its own till; the till empties into
the master's pocket). The NSEC still never crosses, for any flow.
