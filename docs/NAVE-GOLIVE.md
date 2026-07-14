# Taking the Nave live — the full runbook

Everything to light up `nave.pub` end to end: the hub, the game client,
the Director, and Luke — **one domain, one box, one front door.** No
Cloudflare, no Pages: DNS lives at Hover, and a single Caddy on the VPS
terminates HTTPS for every subdomain and serves the static sites straight
off disk. Do the phases in order; each has a clear "done when."

**Where things stand as this is written**
- ✅ DNS at Hover — apex `@`, wildcard `*`, `director`, `luke`, `noir`
  all A-record to `187.77.13.232` (the VPS).
- ✅ `director.nave.pub` — the Director, live on the VPS.
- ✅ The hub (`nave/`) and the game client (`client/`) — built, in the
  repo, and wired into Caddy to serve off the box (this runbook deploys
  them).
- ⬜ Push the Caddy change to the box (Phase 2) · Luke (Phase 4).

---

## Why no Cloudflare

The only thing Cloudflare would have bought us is apex flattening — a way
to point the root `nave.pub` at Cloudflare Pages, which can't take a plain
A record. But we're not on Pages. We serve the hub from our own box, and a
root **A record** is exactly what Hover *can* do. So the whole Cloudflare
detour disappears: Hover holds the records, the VPS holds the sites, Caddy
holds the certs. One less account, one less moving part, one less place
your traffic is inspected.

---

## Phase 1 — DNS (already done, for reference)

All at **Hover**, all plain A records to the VPS. Nothing proxied,
nothing to flatten — Caddy does Let's Encrypt directly, so every name must
resolve straight to the box.

| Type | Name | Value | Purpose |
|---|---|---|---|
| A | `@` | `187.77.13.232` | the hub at the apex `nave.pub` |
| A | `*` | `187.77.13.232` | catch-all — any future subdomain just works |
| A | `director` | `187.77.13.232` | the Director API |
| A | `noir` | `187.77.13.232` | the game client |
| A | `luke` | `187.77.13.232` | OpenClaw (Phase 4) |

The wildcard `*` means you never have to touch Hover again to add a room —
a new subdomain resolves the moment you add its Caddy block.

**Done when:** `dig +short nave.pub` and `dig +short noir.nave.pub` both
return `187.77.13.232`.

---

## Phase 2 — Deploy the hub + game (one pull, one rebuild)

The box already runs the Director behind Caddy. This step teaches that
same Caddy to serve two more names — the hub and the game — as **static
files off the box**. The wiring is already in the repo:

- `deploy/Caddyfile` — `nave.pub` (root `/srv/nave`) and `noir.nave.pub`
  (root `/srv/site`, redirecting `/` → `/client/`).
- `deploy/docker-compose.yml` — the Caddy container mounts the **public**
  dirs read-only: `nave/`, `client/`, `lib/`, `gm/`, `shared/`, `eras/`,
  `sw.js`. **`deploy/` is deliberately not mounted** — the `.env` with
  your Anthropic key and Director nsec never enters the web container.

On the box:

```bash
cd /root/noir && git pull
cd deploy && docker compose up -d --build
```

Caddy notices the two new vhosts, fetches a Let's Encrypt cert for each
(seconds, since DNS already resolves), and starts serving. The Director
container is untouched by the rebuild unless its code changed.

**Done when:**
- `https://nave.pub` shows the Nave (compass rose, the app grid).
- `https://noir.nave.pub` lands on the game — and because the client
  auto-detects `director.nave.pub` when served from `*.nave.pub`, it
  engages **The Fairweather Table** with nothing pasted, NEW ALBION in the
  picker.

*(The Director already allow-lists `https://noir.nave.pub` in its `.env`,
so the game's cross-origin calls to `director.nave.pub` pass.)*

---

## Phase 2b — The apps, each at its own `<app>.nave.pub`

The N-apps ship as static clients. To serve them from the box (so every app
lives under your own domain, not `github.io`), `deploy/sites.sh` syncs each
app's repo into `deploy/sites/<name>`, Caddy mounts that read-only at
`/srv/apps`, and one vhost per subdomain serves it (repo root, so each app's
sibling imports resolve). Caddy issues a cert per subdomain automatically.

On the box:

```bash
cd /root/noir && git pull
cd deploy && bash sites.sh          # clones nvelope, nontact, notegate,
                                    # ntrigue, nvoy, nherit, nscope
docker compose up -d --build caddy  # picks up the mounts + new vhosts
```

**Done when:** `https://nvelope.nave.pub`, `https://nontact.nave.pub`,
`https://notegate.nave.pub`, `https://ntrigue.nave.pub`,
`https://nvoy.nave.pub`, `https://nherit.nave.pub`, and
`https://nscope.nave.pub` (the protocol page) all load — and the hub's app
cards, which now point at these subdomains, open them.

**To update an app later:** re-run `bash sites.sh` (it fast-forwards each to
its latest `main`), then `docker compose up -d caddy`. The `github.io`
deployments still exist and keep working as a fallback.

*(Certs mint on first request. With 7 new names at once you may briefly hit
Let's Encrypt's rate limit; Caddy retries and the ZeroSSL fallback covers
the rest — they all come up within a few minutes.)*

---

## Phase 3 — Confirm the Director accepts the client origin

On the VPS, `deploy/.env` already has:
```
NOIR_ALLOWED_ORIGINS=https://noir.nave.pub,https://jafairweather.github.io
```
Nothing to change now. Once you retire the github.io site, drop that entry
and `docker compose up -d` to re-read `.env`.

---

## Phase 4 — Luke at `luke.nave.pub`

Follow **deploy/DEPLOY.md §8** — the OpenClaw-correct exposure: HTTPS via
Caddy (required by OpenClaw's device auth), OpenClaw's own gateway auth as
the lock, `gateway.controlUi.allowedOrigins = https://luke.nave.pub`, and
the `luke.nave.pub` Caddy block uncommented. The `luke` A record already
exists (Phase 1), so it's: set the origin in OpenClaw, uncomment the
block, `docker compose up -d`.

---

## Phase 5 — Verify the whole front

- `https://nave.pub` — the hub, every card linking out.
- `https://noir.nave.pub` — the game, auto-engaging the hosted table.
- `https://director.nave.pub/health` — `ok:true`, `houseSource:"granted"`.
- `https://luke.nave.pub` — OpenClaw's auth gate, then Luke.

---

## Growing the list (the enchilada keeps cooking)

The hub is built to grow, not to say "seven." To add the next app —
whether it's a new N-app or a new expression of an existing one:

1. **A card** in `nave/index.html`: copy any `.card` block, give it a
   `--accent` color, a seal SVG, a name, a one-liner + tag, and its
   links. (The seal system is just a ring + a line-art glyph in the
   accent — match the weight of the others.)
2. **A room**, if it needs one: for a static app, drop it in a folder and
   add a read-only mount + a `file_server` vhost in Caddy; for a service,
   put it on the `nave` Docker network and add a `reverse_proxy` vhost.
   The wildcard `*` A record means **no Hover change is ever needed** —
   the subdomain already resolves.
3. `docker compose up -d` on the box, and flip the card link from "coming
   soon" to the live URL.

That's the whole pattern: one primitive, a room per idea, all off the same
Nave, all on one box you own.
