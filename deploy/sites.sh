#!/usr/bin/env bash
# Pull each app's static site onto the box so Caddy can serve it from
# <app>.nave.pub. Clones (or fast-forwards) each repo into deploy/sites/<name>,
# which the caddy container mounts read-only at /srv/apps. Run on the box:
#
#   bash deploy/sites.sh && docker compose up -d caddy
#
# Re-run any time to update the served sites to each repo's latest main.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p sites

# subdomain : github repo (default branch = main for all)
apps=(
  "nave:nave.pub"                 # the apex hub — the Nave system repo
  "nvelope:nvelope"
  "nontact:nontact"
  "notegate:notegate"
  "ntrigue:ntrigue"
  "nvoy:nvoy"
  "nherit:nherit"
  "nscope:nostr-scoped-data-grants"
  "luke:luke"                     # a service (built + proxied), not file-served
)

for pair in "${apps[@]}"; do
  name="${pair%%:*}"; repo="${pair##*:}"; dir="sites/$name"
  if [ -d "$dir/.git" ]; then
    echo "↻ $name — refreshing"
    git -C "$dir" fetch --depth 1 origin main
    git -C "$dir" reset --hard origin/main
  else
    echo "＋ $name — cloning $repo"
    git clone --depth 1 "https://github.com/JAFairweather/$repo" "$dir"
  fi
done

# --- Luke's secrets: decrypt SOPS ciphertext → the env the compose reads --
# The committed sites/luke/secrets.enc.env is decrypted with the box's age
# key into ../luke/.env (gitignored, root-only). Guarded: if SOPS or the
# encrypted file isn't set up yet, this is a no-op and the stack still
# comes up (compose's luke env_file is required:false). See luke/SECRETS.md.
if [ -f sites/luke/secrets.enc.env ] && command -v sops >/dev/null 2>&1; then
  mkdir -p ../luke
  if sops --input-type dotenv --output-type dotenv -d sites/luke/secrets.enc.env > ../luke/.env; then
    chmod 600 ../luke/.env
    echo "🔓 luke secrets decrypted → ../luke/.env"
  else
    echo "⚠ luke secrets present but decrypt FAILED (age key missing?) — luke will run without env"
  fi
else
  echo "· luke secrets: SOPS/enc file not set up yet — skipping (see luke/SECRETS.md)"
fi

echo
echo "done. served roots are in deploy/sites/. now reload Caddy:"
echo "  docker compose up -d caddy"
