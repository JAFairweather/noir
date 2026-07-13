# NIP-DA Ecosystem Hub — Work Plan (v2 · current build)

**Goal:** Consolidate the entire NIP-DA ecosystem — a central hub, all
five NIP-DA apps (Nontact, Nvelope, Notegate, Nvoy, Nherit), both games
(Noir, Ntrigue), and the NIP-DA spec/PR references — under a single
domain, with Noir as the pilot deployment.

**What changed since v1 of this plan:** v1 was drafted without knowing
the current build state and without knowing that "the Director" is
already a proper noun inside Noir. This version corrects both. The
headline correction is that **the ecosystem is not a plan — it is
seven shipped, public repositories plus a submitted protocol PR.**
This is no longer a build project; it is a *publishing* project. That
shortens the critical path dramatically and changes the framing of
every phase below.

**Secondary goal (unchanged, and more true than ever):** the hub is the
community-traction asset. NIP-DA today is a PR and two implementations
with no living showcase. A single canonical URL where anyone can *use*
NIP-DA apps and point a client at a reference deployment is the
strongest argument that the protocol is real. Build the hub as the
front door to the ecosystem, because it is — and, per §2, as the front
door to *you*.

---

## 0. Key decisions to lock before any building

### 0.1 Domain

- **.ed is not registerable** (not in the DNS root; .edu is restricted
  to accredited US institutions). Crossed off.
- **Recommended open TLDs** for a Nostr dev hub: `.dev` / `.app`
  (auto-HTTPS via HSTS preload), `.pub` (thematically perfect —
  pub/sub, and the speakeasy motif), `.xyz`, `.social`, `.build`.
- **Cost:** ~$10–40/yr.

### 0.2 URL architecture — subdomains vs. paths

**Recommendation: subdomains for apps, root for the hub. This is now
decided, not open — two things we built this session prove it.**

| | Subdomains (`noir.hub.tld`) | Paths (`hub.tld/noir`) |
|---|---|---|
| Web origin | Separate per app | One shared origin |
| localStorage / IndexedDB | Isolated per app | Shared — apps read each other's data |
| **NIP-07 signer permission** | Granted per app | Granted once, shared across all apps |
| Service-worker scope | Clean, one per origin | Path-scoping contention between PWAs |
| Independent deploys | Yes | Shared routing = single point of failure |

**Two field proofs from the Noir build:**

1. **NIP-07 permission is origin-scoped, and Noir now depends on that.**
   Author mode (the ability to tune a table) is gated to the house
   master's npub via the signed-in NIP-07 identity. Under a shared
   path origin, a signer grant to one app would leak across all of
   them — which would quietly defeat the isolation that Nherit's legacy
   vault, Nvelope, and Notegate specifically require.
2. **Service-worker scope matters.** Noir's service worker was just
   hardened (genuinely network-first, cache-swept on activate,
   `updateViaCache:'none'`) after a stale-cache bug blanked the page.
   Path-scoped SW contention would make that class of failure permanent
   *and* cross-app. Subdomains give each app a clean SW origin.

**NIP-05:** `name@domain` identifiers resolve from
`/.well-known/nostr.json` at the **root** regardless of subdomains, so
one identity file at the root covers the whole suite. Subdomains cost
nothing here.

### 0.3 Hosting target

**Recommendation: Cloudflare Pages for the static apps + a runtime host
(Fly.io or the Hostinger VPS) for the two things that are genuinely
server-side.**

Most of the ecosystem is static SPAs talking directly to relays — grants
are just encrypted nostr events, so no backend is required. **Two
exceptions, and one of them is the pilot:**

- **Noir's Director** (the AI game master) is a Node HTTP service that
  holds the Anthropic API key and the agent's nsec. It is *not* static.
  Noir's game *client* is static and goes on Pages perfectly; its
  Director needs a runtime host. **This means the pilot validates both
  hosting lanes at once — treat that as a feature, not a snag.**
- **A dedicated relay** (Phase 5) is the other server workload.

Reserve the VPS for exactly those two. Don't put static apps on it —
Pages is less fragile and less work.

### 0.4 Repo structure

**Monorepo** is the better fit: there is one shared protocol library
(`nipxx.mjs`) already vendored identically into every app, plus shared
design tokens once §5 lands. Cloudflare Pages can point separate
projects at subdirectories of one repo. (Today the apps are polyrepos;
a monorepo migration is optional and can follow launch — do not block
the rollout on it.)

### 0.5 Inventory — CURRENT (this replaces the v1 table of question marks)

Every app below is **shipped and public**. This is the single biggest
correction to v1.

| Artifact | Type | Build state | Notes |
|---|---|---|---|
| NIP-DA spec / PR #2411 | Protocol | Submitted | TS + Go implementations, live interop. Link from the hub. |
| **Noir** | Game | **Live pilot** | jafairweather.github.io/noir/client/ — functional, 151-check suite. Static client + server-side Director. First to move to a subdomain. |
| **Nontact** | App | **Shipped** | Contact-card manager; the address book as an emergent view. |
| **Nvelope** | App | **Shipped** | Live document sharing; Blossom encrypted-blob pattern. |
| **Nvoy** | App | **Shipped** | Scoped delegation to agents; MCP server + delegator console. Noir's Director is a live Nvoy consumer. |
| **Nherit** | App | **Shipped** | Family break-glass legacy vault. (v1 said "spec not written" — that is wrong; it is a working app.) |
| **Ntrigue** | Game | **Shipped** | v0 phones-only party game of secrets & blackmail. |
| **Notegate** | App | **Shipped** | v1 feature-complete serverless tip intake (PoW gate, gift wrap). |
| **The Hub** | Ecosystem index | To build | §2. NOT called "the Director" — see §0.6. |

### 0.6 Naming — resolve the "Director" collision NOW

v1 called the hub landing page "the Director." **That name is already
taken inside the ecosystem.** In Noir, *the Director* is the AI game
master — a live Nvoy-delegated agent with its own npub, its own control
desk, and a role in the protocol story. Two different "Directors," one
of them an actual protocol actor, will confuse every reader, diagram,
and article.

**Decision, locked: the hub is _North_.** "Director" stays reserved for
Noir's game agent.

**North** is the right name for a reason deeper than the N-family fit:
*Identity = Freedom* is a direction, not a destination, and North is the
thing you steer by. The hub is the fixed point the whole ecosystem
orients to — the reference relay, the reference apps, the reference
identity. The tagline writes itself: **"Find your North."** / **"True
North for your data."** (Considered and set aside: _Nexus_ — accurate
but generic; _Nave_ — the speakeasy motif, but too oblique for a front
door.)

---

## 1. Foundation / infrastructure

1. **Register the domain** through Cloudflare (registrar + nameservers
   in one place, at-cost).
2. **DNS zone** in Cloudflare: root binding for the hub, per-app CNAMEs
   for subdomains (or a wildcard).
3. **Wildcard SSL** — automatic with Cloudflare; verify HSTS (mandatory
   on `.dev`/`.app`).
4. **/.well-known/nostr.json** at the root — NIP-05 identities for the
   ecosystem (`_@hub.tld`, optionally per-app). Small static file or a
   Worker.
5. **Design system** — shared tokens + wordmark so every app and the
   hub feel like one ecosystem. See §5.2 (iconography) and §5.3 (the
   Alby sign-on) — both are now explicit deliverables, not afterthoughts.
6. **CI/CD baseline** — connect a repo to Cloudflare Pages; confirm a
   trivial commit auto-deploys.

**Exit criteria:** domain live, SSL green, hello-world auto-deploys,
NIP-05 resolves.

---

## 2. North — the hub (and your front door)

Ship this early: it's the anchor everything links to, and it is a
personal-brand asset as much as an ecosystem one. **North is two things
at once: the reference index of the NIP-DA ecosystem, and the canonical
page for James A. Fairweather's body of work on self-sovereign identity.**
Those aren't in tension — the throughline of every app *is* the personal
thesis: own your contacts, your documents, your estate, your secrets,
your table; no company can dispossess you. That thesis has a name.

### 2.1 The thesis — "Identity = Freedom"

Lead the hub with it. It is the human-readable version of the STACK.md
epigraph (*"the simplest open protocol for secure, distributed
applications built on provable trust"*). Every app is a proof of the
same sentence: when your identity is a keypair you hold and your
relationships are grants you can revoke, no platform owns you. That is
the freedom. Make this the hero section.

### 2.2 Protocol content (the "why NIP-DA is real" case)

- One-paragraph plain-language explainer: NIP-DA = Scoped Data Grants;
  private, live, revocable data over public relays; revocation is a key
  rotation, not a policy.
- The three primitives, briefly: the scope (30440), the grant (440-in-
  1059), the self-encrypted index (10440).
- Prominent links to **PR #2411**, the spec, and the TS + Go
  implementations.
- **Reuse existing assets:** `docs/STACK.md`, the three articles
  (`docs/articles/`), and the eight architectural figures
  (`docs/figures/`) are written and ready. The hub's "learn more"
  section is a link list into these, not new writing.

### 2.3 The app grid (with icons — see §5.2)

A card grid, each app with its icon, one-line description, its
protocol-property tag, and a link to its subdomain:

- **Noir** — the spycraft mystery over NIP-DA; the flagship demo.
- **Nontact** — your address book as an emergent view.
- **Nvelope** — live documents; revocation instead of expiring links.
- **Nvoy** — delegate data to agents; revoke in one keystroke.
- **Nherit** — a family break-glass legacy vault.
- **Ntrigue** — a party game of secrets and blackmail.
- **Notegate** — serverless newsroom tip intake.

Cards for anything not yet on its subdomain show a "coming soon" state
and flip to a live link as each app rolls out (§4).

### 2.4 James A. Fairweather — the person

A clearly-marked section (or a linked `/about`) gathering:

- **Substack** — the essays (Protocol as Fuel, Cryptographic Boundary
  Conditions, the Noir architecture, and what follows).
- **LinkedIn** — professional profile.
- **The JA Fairweather page** — personal site / bio.
- **"Identity = Freedom"** — the thesis page: the manifesto tying the
  ecosystem to the idea, and the reason a reader should care beyond the
  code.

*(Provide the exact URLs and I'll wire them in; placeholders stand in
until then.)*

### 2.5 Technical

Static, fast, excellent OG/Twitter card tags so it previews well when
shared on nostr and elsewhere. A live "featured demo" embed or
screenshot of Noir's tradecraft view makes an unusually strong hero —
it is the protocol's privacy claim rendered as something you can watch.

**Exit criteria:** `hub.tld` (North) live; indexes every project
(placeholders where apps aren't up yet); carries the protocol case and
the personal brand; shares cleanly.

---

## 3. Pilot deployment — Noir

Noir validates the entire pipeline — *both* hosting lanes — then that
process freezes into a reusable runbook.

1. **Static client:** Noir client → Cloudflare Pages project →
   `noir.hub.tld` → SSL verified.
2. **Hosted Director (the server lane):** the Director service →
   runtime host (Fly.io recommended for a clean single-command deploy,
   or the VPS). Set `NOIR_DIRECTOR_NSEC` to the existing agent key
   (same key = same agent; the house grant, notes, and delegated worlds
   follow the npub, not the box), `ANTHROPIC_API_KEY`, `NOIR_RELAYS`,
   and the public guardrails (`NOIR_ALLOWED_ORIGINS=https://noir.hub.tld`,
   `NOIR_RATE_LIMIT`, `NOIR_DAILY_CAP`). HTTPS in front.
3. **NIP-07 test:** connect Alby / nos2x, confirm the per-origin
   permission grant and the master-identity gate for author mode.
4. **Relay test:** confirm Noir's NIP-DA events read/write against the
   chosen relay(s); confirm a world pack granted via the Nvoy console
   reaches the hosted Director.
5. **PWA / service-worker check:** install, offline behavior, SW scope
   clean (the recent hardening should make this pass cleanly).
6. **Write the "App Onboarding Runbook"** from exactly these steps:
   repo → Pages project → subdomain CNAME → SSL → NIP-07 smoke test →
   relay smoke test → (server lane if any) → link from North.

**Exit criteria:** Noir live at `noir.hub.tld` — both client and hosted
Director — fully functional, with a documented runbook.

---

## 4. Roll out remaining apps

Apply the runbook. Sequence by readiness — and since everything is
already shipped, "readiness" now means "which subdomain do we point
first," not "which app do we finish."

1. The five NIP-DA apps + Ntrigue: each is a static SPA (Pages only, no
   server lane), so each is a fast copy of the runbook's static path.
2. For each: run the runbook, then flip its North card from placeholder
   to live link.
3. Nherit is shipped, so it is no longer the "ship last because
   unwritten" case — sequence it wherever convenient. If any app gets a
   real polish pass first, that's fine; nothing blocks nothing.

**Exit criteria:** every app live at its own subdomain and linked from
North.

---

## 5. Shared services & polish

### 5.1 Dedicated relay (recommended)

Stand up `relay.hub.tld` on the VPS (Docker) so the suite's grant events
have a canonical home and interop demos always work. This materially
strengthens the traction story: anyone can point *any* NIP-DA-aware
client at your reference relay.

### 5.2 Iconography — the app-icon system (NEW, explicit deliverable)

Every app gets a real identity so the suite feels designed, not
assembled:

- **A per-app icon** used three ways: the browser favicon, the PWA
  install icon (192/512 maskable), and the North app-grid card icon.
- **One visual system across all eight** (the seven apps + North):
  shared grid, stroke weight, and a shared palette with a per-app accent
  — so a Nontact icon and a Noir icon are visibly siblings. The
  "N-monogram in a consistent frame, one accent color per app" pattern
  is the cheapest way to get coherence.
- **Reuse what exists:** Noir already has an emoji/wordmark language and
  a gold-on-ink palette; that can seed the system. The
  `scripts/figures.mjs` approach (diagrams as code) is a good model —
  consider generating the icon set from one small script so it stays
  consistent and regenerable.

### 5.3 Alby as the signature sign-on (NEW, explicit deliverable)

A shared, branded "connect" experience across every app — the signature
onboarding moment.

- **Featured provider: Alby.** The sign-on is Alby-forward — "Sign in
  with Alby" as the primary, branded call to action, consistent on
  every app's entry screen.
- **Open underneath: NIP-07.** The mechanism stays the open standard —
  any NIP-07 signer (Alby, nos2x, a bunker) works, because binding hard
  to one vendor would contradict the whole "open protocol" thesis. Alby
  is the *recommended, branded* signer, not the *only* one. Frame it as
  "Sign in with Nostr — get Alby" so newcomers have a one-click path and
  purists keep their choice.
- **Shared component, separate grants.** A single reusable sign-on
  component gives the suite one look; remember that subdomains mean each
  origin still authorizes independently (§0.2). That is correct and
  desirable — one visual language, per-app consent.

### 5.4 Suite navigation, analytics, backups

- Lightweight shared header linking back to North from every app.
- Cloudflare Web Analytics (privacy-friendly, free); uptime monitor on
  the relay.
- Backups for relay data and repos.

---

## 6. Launch & community

- Announce North on nostr, tied to PR #2411 — lead with "here's the
  whole ecosystem, live, and here's the protocol underneath it."
- **The launch content already exists.** The three articles and eight
  figures are written. Publish them on the Substack, cross-post to
  nostr, and point each at the relevant live app. Noir's tradecraft
  view and the Notary ("physics by commitment") are the two most
  novel, most shareable demos in the whole suite — lead the technical
  audience with those.
- North becomes the thing you point skeptical reviewers and potential
  integrators (the Notedeck conversation) to: a working reference
  ecosystem, not a spec.

---

## Cross-cutting notes

- **Web hub vs. native clients are separate channels.** The subdomain
  hub distributes web apps. Native-client integration (Nontact-style
  contact management inside Notedeck) is a *different* path — Rust,
  in-client — and doesn't compete with the hub. Both can be true; the
  hub is the showcase, native integration is the endgame.
- **Cost:** domain ~$10–40/yr; Cloudflare Pages ~$0; the Director and
  relay run on a runtime host you largely already pay for. Marginal
  cost near zero. The one variable cost is the hosted Director's model
  spend — which is exactly what `NOIR_DAILY_CAP` and (eventually) the
  Lightning retainer exist to bound.
- **Security:** the sensitive-data apps (Nherit, Nvelope, Notegate) are
  the reason subdomain isolation is worth it. Keep their origins clean;
  never share storage with a game origin.
- **Risk to watch (v1 said this and it remains the truest line here):**
  the pattern of losing interest once the hard unknown is solved. The
  hard parts — architecture (§0), the pilot's dual-lane deploy (§3) —
  are decided or nearly so. Phases 4–6 are repetition and publishing.
  The runbook (§3.6) exists specifically to make that repetition
  low-friction so the rollout actually finishes. **You have already
  built the hard thing seven times; do not let the easy thing —
  pointing DNS and writing cards — be where it stalls.**
