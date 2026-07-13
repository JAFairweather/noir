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

## 8. Expose Luke (the Claude bot) at `luke.nave.pub` — behind a lock

Luke is the `openclaw` container (`ghcr.io/hostinger/hvps-openclaw`),
listening on host port **57419**. **Read this whole section before
exposing it.**

### The one real caution

Luke is an *agent that can act on your VPS*. A public URL to an
unauthenticated agent is a remote-control panel for your whole box —
the single most dangerous thing you can put on the open internet. So the
rule here is absolute: **never expose Luke without a lock.** The kit
defaults to keeping the door shut (the `luke.nave.pub` block in
`Caddyfile` ships commented out) precisely so you can't do it by
accident.

Basic auth (below) is the *minimum* acceptable lock. Consider it the
floor, not best-in-class:
- It's a single shared password over TLS — fine for a personal tool,
  weak for anything sensitive.
- Stronger options, in ascending order: an IP allowlist in Caddy
  (`@allowed remote_ip <your-ip>`), a bunker/SSO in front, or — most
  on-brand for this stack — a nostr-signed auth check. Tell me how
  locked-down you want Luke and I'll build the stronger version.

### Enable it (basic auth floor)

1. **Confirm Luke actually serves HTTP on 57419** and that public access
   is intended. (`curl -s localhost:57419` on the box — do you get a web
   UI or an API? If it's not HTTP, this proxy won't work and we pick a
   different exposure.)
2. **Generate a password hash:**
   ```bash
   docker run --rm caddy:2-alpine caddy hash-password --plaintext 'YOUR-STRONG-PASSWORD'
   ```
3. **Edit `deploy/Caddyfile`** — uncomment the `luke.nave.pub` block and
   paste the hash after `luke `. (An incomplete `basic_auth` block will
   stop Caddy and take `director.nave.pub` down with it, so only
   uncomment once the hash is in.)
4. **DNS:** add an A record at Hover — `luke` → `187.77.13.232`.
5. **Reload Caddy:**
   ```bash
   cd deploy && docker compose up -d
   ```
6. Visit `https://luke.nave.pub` — you should get a browser auth prompt,
   then Luke.

The `caddy` service already carries `host.docker.internal:host-gateway`
(added in the compose file), which is how it reaches Luke on the host
port from inside its container.

Send me the recon output and I'll tailor §1 and §4 to exactly what's on
your box.
