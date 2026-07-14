# Deploying the Noir Director on your Hostinger VPS

A clean, step-by-step guide to running the Director (the AI game master)
as a container on the box you already pay for, behind one shared Caddy
front door — so `director.nave.pub`, your Claude bot, and the future
relay all live under one domain, one TLS terminator, one box.

> **The map.** One box, one Caddy, everything under `nave.pub`. No
> Cloudflare — DNS is at Hover, Caddy does the certs, and the static sites
> (the hub and the game client) are served straight off disk by the same
> Caddy that reverse-proxies the Director.
>
> ```
> Internet ──▶ Caddy (:443 on the VPS)
>                 ├─ nave.pub          ──▶ the hub        (static, off disk)
>                 ├─ noir.nave.pub     ──▶ the game client (static, off disk)
>                 ├─ director.nave.pub ──▶ Noir Director   (this container)
>                 ├─ luke.nave.pub     ──▶ OpenClaw / Luke (host :57419)
>                 └─ relay.nave.pub    ──▶ the relay        (later)
> ```

---

## Before you start

You'll need:
- SSH access to the Hostinger VPS (you have this).
- `nave.pub` with its DNS managed somewhere you can add records
  (Hover, where it's registered — no Cloudflare needed).
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

## 8. Expose Luke at `luke.nave.pub` — as a delegated agent

**Full guide: [`LUKE.md`](https://github.com/JAFairweather/luke/blob/main/LUKE.md)
in the `luke` repo** (Luke is its own service repo now). The short version:

Luke is your OpenClaw instance — an agent that can act on your box. We do
**not** proxy its Control UI straight onto a public address. Instead Luke
is split into two planes on `luke.nave.pub`:

- **Public plane** (`/`) — Luke's *card*: his npub, his mandate, and his
  delegation status (a revocable grant from you), plus `/health`. Read-only,
  safe to index. Served by the `luke` container, built from its own repo
  (synced to `deploy/sites/luke` by `sites.sh`).
- **Control plane** (`/cockpit*`) — the real OpenClaw Control UI on host
  `:57419`, reachable **only past a nostr-signed gate**: Caddy `forward_auth`
  asks `luke-service` `/gate/verify`, which opens only for a NIP-98 signature
  from your configured master npub. OpenClaw's own gateway auth stays on as
  the inner lock.

Three OpenClaw facts still hold: **HTTPS at the browser is mandatory** (its
device auth uses WebCrypto), Caddy provides it, and Caddy proxies the
WebSocket natively.

### Enable it

1. **Config:** the box syncs the luke repo with `bash sites.sh`; put its env
   at `luke/.env` (from `deploy/`: `cp sites/luke/.env.example ../luke/.env`),
   then set `LUKE_NSEC` (Luke's key), `LUKE_MASTER_NPUB` (**your** npub — the
   only key the gate admits), and `LUKE_MANDATE`.
2. **OpenClaw:** set `gateway.controlUi.allowedOrigins` to include
   `https://luke.nave.pub`, and keep its own gateway auth on.
3. **DNS:** the `luke` A record already points at the box (Phase 1).
4. **Bring Luke up** and enable the vhost:
   ```bash
   cd deploy && docker compose up -d --build luke
   # then uncomment the luke.nave.pub block in Caddyfile:
   docker compose up -d caddy
   ```
5. Visit `https://luke.nave.pub` — the card. Click **Enter the cockpit** →
   sign with your master key (Alby/nos2x) → OpenClaw's own auth → Luke.

The `caddy` service already carries `host.docker.internal:host-gateway`,
which is how it reaches OpenClaw on the host port.
