# Deploying the Noir Director on your Hostinger VPS

A clean, step-by-step guide to running the Director (the AI game master)
as a container on the box you already pay for, behind one shared Caddy
front door — so `director.nave.pub`, your Claude bot, and the future
relay all live under one domain, one TLS terminator, one box.

> **The map.** The game *client* is static and lives on Cloudflare Pages
> at `noir.nave.pub`. This kit is the *Director API* at
> `director.nave.pub`. Two subdomains, two hosts, one domain.
>
> ```
> Internet ──▶ Caddy (:443 on the VPS)
>                 ├─ director.nave.pub ──▶ Noir Director  (this container)
>                 ├─ bot.nave.pub      ──▶ your Claude bot (add later)
>                 └─ relay.nave.pub    ──▶ the relay        (Phase 5)
> ```

---

## Before you start

You'll need:
- SSH access to the Hostinger VPS (you have this).
- `nave.pub` with its DNS managed somewhere you can add records
  (Cloudflare, per the ecosystem plan).
- Two secrets from your local machine:
  - the contents of your local **`.director-key`** (`cat .director-key`
    in your noir folder) — the SAME key keeps your house, notes, and
    worlds attached to the hosted agent;
  - your **`ANTHROPIC_API_KEY`**.

**Step 0 — run the recon first.** Copy `deploy/recon.sh` to the box and
run it (`bash recon.sh`, or `sudo bash recon.sh` for more detail), then
paste the output back. It's read-only and prints no secrets. It tells us
the one thing that decides your path: **whether something already owns
port 443** (§4).

---

## 1. Point DNS at the box

In your DNS provider, add an **A record**:

| Type | Name | Value | Proxy |
|---|---|---|---|
| A | `director` | *your VPS public IP* | DNS only (grey cloud) |

(The recon script prints the public IP; or find it in Hostinger hPanel.)

**If you use Cloudflare, set the record to "DNS only" (grey cloud), not
"Proxied" (orange), at least for first setup** — Caddy needs to complete
the Let's Encrypt challenge directly. You can turn on Cloudflare
proxying later if you want, but then Cloudflare handles the cert and you
switch Caddy to internal TLS; keep it simple and grey to start.

Give DNS a few minutes. Check with: `dig +short director.nave.pub`
(should return your VPS IP).

---

## 2. Get the files onto the box

Simplest is to clone the repo on the VPS:

```bash
git clone https://github.com/JAFairweather/noir.git
cd noir/deploy
```

(Later updates are just `git pull` + a rebuild — see §6.)

---

## 3. Configure `.env`

```bash
cp .env.example .env
nano .env        # or your editor of choice
```

Fill in:
- `NOIR_DIRECTOR_NSEC` = the 64-hex string from your local `.director-key`
  (or an `nsec1…`). **This is what keeps the hosted Director as the same
  agent your nvoy grants already point at.**
- `ANTHROPIC_API_KEY` = your key.
- `NOIR_RELAYS` = the same relays your nvoy console publishes to.
- `NOIR_ALLOWED_ORIGINS` = leave as-is (`noir.nave.pub` + `github.io`)
  until the client moves, then drop the github.io entry.
- `ACME_EMAIL` = your real email (Let's Encrypt sends expiry notices).

`.env` is gitignored — it never leaves the box.

---

## 4. Bring it up — pick your path from the recon

### Path A — nothing owns port 443 yet (the kit brings its own Caddy)

This is the default and the cleanest. From `noir/deploy`:

```bash
docker compose up -d --build
docker compose logs -f director
```

Caddy claims 80/443 and issues the cert automatically once DNS resolves.

### Path B — something already terminates HTTPS on the box

If the recon shows an existing proxy on 443 (e.g. your Claude bot runs
behind Caddy/Traefik/nginx already), **don't run a second Caddy** — two
can't share 443. Instead:

1. Start only the Director (no Caddy):
   ```bash
   docker compose up -d --build director
   ```
2. Add `director.nave.pub` as a vhost to your existing proxy, pointing at
   the Director container. Send me the recon and I'll write the exact
   snippet for whatever proxy you have (Caddy label, nginx `server{}`,
   Traefik router, or a Coolify/Dokploy "new resource"). With Coolify or
   Dokploy this is a UI step — point a new service at the container and
   it does the TLS for you; skip Caddy entirely.

Either path ends the same way: the Director reachable at
`https://director.nave.pub`.

---

## 5. Verify

```bash
curl -s https://director.nave.pub/health | head
```

You should see JSON with `ok:true`, your agent `npub`, the house name,
and (once the grant resolves) your delegated `worlds`. The container
logs should print the boot banner and, within ~2 minutes,
**"house held by grant from npub1…"**.

Then, in the game (today at `jafairweather.github.io/noir/client/`, soon
at `noir.nave.pub`): open GEAR → the DIRECTOR box → paste
`https://director.nave.pub` → ENGAGE. It should read **"engaged — The
Fairweather Table."** Once the client is live at `noir.nave.pub` it will
find `director.nave.pub` automatically — no pasting.

---

## 6. Updating the Director

The container runs the built image, so you update by rebuilding it — the
desk's UPDATE button (a `git pull`) is a no-op in a container.

```bash
cd noir && git pull
cd deploy && docker compose up -d --build director
```

Zero-downtime isn't needed here; the rebuild swaps the container in a
second or two, and the game fails soft to scripted prose during any blip.

---

## 7. Adding your Claude bot and the relay (the consolidation payoff)

Once the Director works, folding in the rest is small:

1. Put the other service on the **`nave`** Docker network (so Caddy can
   reach it by container name), or note its `host:port`.
2. Add a block to `Caddyfile`:
   ```
   bot.nave.pub {
       reverse_proxy <container-name>:<port>
   }
   ```
3. Add the matching DNS A record (`bot` → VPS IP).
4. `docker compose restart caddy` (or reload).

That's the whole story: one box, one front door, every project under
`nave.pub`.

---

## 8. Expose Luke (OpenClaw) at `luke.nave.pub` — the OpenClaw way

Luke is the `openclaw` container — a self-hosted AI-assistant gateway.
It serves a **Control UI over a WebSocket** on host port **57419**.
Exposing it correctly means honoring three facts about OpenClaw:

- **HTTPS at the browser is mandatory.** OpenClaw's device auth uses the
  WebCrypto API, which browsers refuse over plain HTTP off localhost. So
  a TLS front door isn't hardening — it's required. Caddy provides it;
  the internal hop to 57419 stays plain HTTP, which is fine.
- **OpenClaw brings its own auth.** The gateway ships with token/password
  auth on by default. That — not a Caddy basic-auth wrapper — is Luke's
  lock. (Basic auth would fight OpenClaw's WebSocket device-auth. Don't.)
- **Caddy proxies WebSockets natively.** No special config.

### The one real caution

Luke is an *agent that can act on your box* (browser automation, skills,
your messaging channels). Treat its front door seriously: keep OpenClaw's
gateway auth on, pin `allowedOrigins`, and if you want, add an IP
allowlist. The `luke.nave.pub` block in `Caddyfile` ships **commented
out** so you enable it deliberately.

### Enable it

1. **Confirm OpenClaw's gateway auth is ON** and note its token/password
   (in the OpenClaw Control UI / onboarding — it's on by default). This
   is the lock; don't disable it.
2. **Set the allowed origin.** In OpenClaw's config, set
   `gateway.controlUi.allowedOrigins` to include `https://luke.nave.pub`
   (full origin). This tells the Control UI to accept your new public
   address. (Hostinger's template exposes the config via the panel /
   the Control UI settings.)
3. **DNS:** add an A record at Hover — `luke` → `187.77.13.232`.
4. **Enable the vhost:** in `deploy/Caddyfile`, uncomment the
   `luke.nave.pub { … }` block (optionally uncomment the IP-allowlist
   lines and set your own IP for an extra outer wall). Then:
   ```bash
   cd deploy && docker compose up -d
   ```
5. Visit `https://luke.nave.pub` — Caddy issues the cert, and OpenClaw's
   own auth gate meets you. Log in with the gateway token/password.

The `caddy` service already carries `host.docker.internal:host-gateway`
(in the compose file), which is how it reaches Luke on the host port.

### If you want it locked down harder

Basic-single-password isn't the ceiling. In ascending order: an **IP
allowlist** (only your IP reaches Luke — the commented lines in the
Caddyfile), **OpenClaw's trusted-proxy auth mode** (Caddy injects an
identity header OpenClaw trusts), or a **nostr-signed gate** (prove
you're Luke's master with your key — the same pattern as Noir's author
mode, and the most on-brand for this stack). Tell me which and I'll
build it.
