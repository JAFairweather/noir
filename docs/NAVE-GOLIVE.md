# Taking the Nave live — the full runbook

Everything to light up `nave.pub` end to end: the hub, the game client,
the Director, and Luke — one domain, one box for the dynamic parts,
Cloudflare Pages for the static ones. Do the phases in order; each has a
clear "done when."

**Where things stand as this is written**
- ✅ `director.nave.pub` — the Director, live on the VPS (A record at Hover).
- ✅ The Nave hub (`nave/index.html`) and the game client (`client/`) —
  built, in the repo, ready to deploy.
- ⬜ Everything below.

---

## Phase 1 — Move `nave.pub` DNS to Cloudflare (registration stays at Hover)

The apex `nave.pub` must serve the hub from Cloudflare Pages, and Hover
can't point a root domain at Pages (no ALIAS/flattening). Cloudflare's
DNS does flatten the apex. You are **not transferring the domain** — just
changing which nameservers answer for it.

1. Create a free Cloudflare account → **Add a site** → `nave.pub` →
   choose the **Free** plan.
2. Cloudflare scans your existing Hover records and shows two
   **nameservers** (e.g. `xavier.ns.cloudflare.com` / `dana.ns…`).
3. In **Hover → nave.pub → the domain's nameserver setting**, replace
   Hover's nameservers with the two Cloudflare gave you.
4. **Re-create the record you already have** in Cloudflare so it doesn't
   drop during the switch: `A  director  187.77.13.232  (DNS only / grey
   cloud)`.
5. Wait for Cloudflare to show the domain **Active** (minutes to a few
   hours). `dig +short director.nave.pub` should still return the VPS IP.

**Done when:** Cloudflare says `nave.pub` is Active and `director.nave.pub`
still resolves.

---

## Phase 2 — The DNS records (in Cloudflare now)

Two kinds. The **VPS A records** you add by hand; the **Pages records**
Cloudflare creates automatically when you attach a custom domain to a
Pages project (Phase 3) — don't add those manually.

Add by hand (all **DNS only / grey cloud** so Caddy can do Let's Encrypt):

| Type | Name | Value | Purpose |
|---|---|---|---|
| A | `director` | `187.77.13.232` | the Director (already there) |
| A | `luke` | `187.77.13.232` | OpenClaw (Phase 5) |
| A | `relay` | `187.77.13.232` | the relay (later) |

The apex `nave.pub`, `www`, and `noir` are added as **custom domains on
Pages projects** in Phase 3, which auto-writes their (flattened) records.

---

## Phase 3 — Cloudflare Pages: two projects, one repo

Both deploy from the `JAFairweather/noir` repo, `main` branch, **no build
command**. They differ only in output directory and custom domain.

### 3a. The hub → `nave.pub`

- **Create project** → connect the `noir` repo.
- Build command: *(empty)* · **Build output directory:** `nave`
- Deploy, then **Custom domains → add `nave.pub`** and **`www.nave.pub`**.
  Cloudflare writes the apex (flattened) + www records for you.

**Done when:** `https://nave.pub` shows the Nave.

### 3b. The game client → `noir.nave.pub`

The client imports sibling folders (`../lib`, `../gm`, `../eras`), so this
project serves the **repo root**, and a `_redirects` file (already in the
repo) sends `/` → `/client/`.

- **Create a second project** → same `noir` repo.
- Build command: *(empty)* · **Build output directory:** `/` (repo root)
- Deploy, then **Custom domains → add `noir.nave.pub`**.

**Done when:** `https://noir.nave.pub` lands on the game, and — because
the client auto-detects `director.nave.pub` when served from `*.nave.pub`
— it engages **The Fairweather Table** with nothing pasted, NEW ALBION
in the picker.

*(The Director already allow-lists `https://noir.nave.pub` in its `.env`,
so cross-origin calls from the game to `director.nave.pub` pass.)*

---

## Phase 4 — Confirm the Director accepts the new client origin

On the VPS, `deploy/.env` already has:
```
NOIR_ALLOWED_ORIGINS=https://noir.nave.pub,https://jafairweather.github.io
```
Nothing to change. (Once you retire the github.io site, drop that entry
and `docker compose up -d`.)

---

## Phase 5 — Luke at `luke.nave.pub`

Follow **deploy/DEPLOY.md §8** — the OpenClaw-correct exposure: HTTPS via
Caddy (required by OpenClaw's device auth), OpenClaw's own gateway auth as
the lock, `gateway.controlUi.allowedOrigins = https://luke.nave.pub`, and
the `luke.nave.pub` Caddy block uncommented. The `luke` A record from
Phase 2 must exist first.

---

## Phase 6 — Verify the whole front

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
2. **A subdomain**: a Cloudflare Pages project (static app) or an A record
   + Caddy vhost (if it runs on the VPS).
3. Flip its card link from a "coming soon" note to the live URL.

That's the whole pattern: one primitive, a room per idea, all off the
same Nave.
