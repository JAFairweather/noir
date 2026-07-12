#!/usr/bin/env bash
# director.sh — sync to the latest Director, run it, and keep it running.
#
#   npm run director
#
# Pulls the newest build, then supervises the desk: when the panel's
# UPDATE → RESTART button asks (exit code 75), pull again and relaunch.
set -u
cd "$(dirname "$0")/.."
git pull --ff-only || echo "(pull failed — running the build already here)"
while :; do
  node gm/director-service.mjs
  code=$?
  if [ "$code" = "75" ]; then
    echo "— desk asked for an update restart —"
    git pull --ff-only || true
    continue
  fi
  exit "$code"
done
