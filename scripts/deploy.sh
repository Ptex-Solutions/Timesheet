#!/usr/bin/env bash
# Runs on the VPS as `deploy`. It is the forced command of the GitHub Actions
# SSH key, so that key can do nothing but this. Arg (SSH_ORIGINAL_COMMAND):
# the commit sha to deploy.
#
# Wrapped in main() so bash parses the whole file before `git reset` rewrites it.
main() {
  set -euo pipefail
  local sha="${1:-${SSH_ORIGINAL_COMMAND:-}}"
  [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "usage: deploy.sh <40-char commit sha>" >&2; exit 2; }

  cd /opt/timesheet/app
  exec 9>/opt/timesheet/.deploy.lock
  flock 9

  git fetch -q origin main
  git merge-base --is-ancestor "$sha" origin/main || { echo "$sha is not on origin/main" >&2; exit 3; }
  git reset -q --hard "$sha"

  docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
  docker image prune -f >/dev/null
  echo "Deployed $sha"
}
main "$@"
