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

echo
echo "done. served roots are in deploy/sites/. now reload Caddy:"
echo "  docker compose up -d caddy"
