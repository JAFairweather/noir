#!/usr/bin/env bash
# Read-only recon for the Noir Director deploy. Makes NO changes to the box.
# Prints NO secrets (no env vars, no key files). Safe to run and paste back.
#
#   bash recon.sh              # basic
#   sudo bash recon.sh         # adds process names on ports 80/443 (better)

set -u
sec() { printf '\n========== %s ==========\n' "$1"; }

sec "OS / KERNEL"
uname -a 2>/dev/null
[ -f /etc/os-release ] && . /etc/os-release && echo "distro: ${PRETTY_NAME:-unknown}"

sec "PUBLIC IP  (this is what your DNS A records point at)"
curl -s --max-time 6 https://api.ipify.org 2>/dev/null && echo || \
  echo "(couldn't fetch — read it from Hostinger hPanel → your VPS)"

sec "DOCKER"
docker --version 2>/dev/null || echo "docker: NOT FOUND"
docker compose version 2>/dev/null || docker-compose --version 2>/dev/null || echo "compose plugin: NOT FOUND"

sec "RUNNING CONTAINERS  (names / images / ports only — no env, no secrets)"
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}' 2>/dev/null \
  || echo "(no docker access as this user; try: sudo bash recon.sh)"

sec "DOCKER NETWORKS"
docker network ls 2>/dev/null

sec "WHO OWNS PORTS 80 / 443  (is a reverse proxy already there?)"
{ ss -tlnp 2>/dev/null || ss -tln 2>/dev/null; } | grep -E ':(80|443)[[:space:]]' \
  || echo "nothing on 80/443 — the kit's own Caddy can safely take them"

sec "SYSTEM-LEVEL WEB SERVERS  (nginx / apache / caddy / traefik as services)"
found=""
for s in nginx apache2 httpd caddy traefik; do
  if systemctl is-active "$s" >/dev/null 2>&1; then echo "$s: ACTIVE"; found=1; fi
done
[ -z "$found" ] && echo "(none active as a system service)"

sec "CONTAINER-MANAGER FINGERPRINT"
docker ps --format '{{.Image}} {{.Names}}' 2>/dev/null \
  | grep -Ei 'coolify|dokploy|portainer|caprover|traefik|nginx.proxy|jwilder|swag' \
  || echo "(no obvious manager container — likely plain Docker or Hostinger's Docker Manager)"

sec "RESOURCES"
free -h 2>/dev/null | head -2
df -h / 2>/dev/null

sec "DONE"
echo "Paste everything above back to me. It contains no keys or env values."
