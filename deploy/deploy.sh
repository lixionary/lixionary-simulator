#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "Usage: $0 IMAGE_REF [GHCR_USERNAME]" >&2
  echo "When GHCR_USERNAME is supplied, read the registry token from stdin." >&2
  exit 2
fi

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
exec 9>.deploy.lock
flock -w 120 9

export SIMULATOR_IMAGE="$1"
if [[ $# -eq 2 ]]; then
  DOCKER_CONFIG=$(mktemp -d)
  export DOCKER_CONFIG
  trap 'rm -rf -- "$DOCKER_CONFIG"' EXIT
  docker login ghcr.io --username "$2" --password-stdin
fi

compose=(docker compose --file compose.yaml)
previous_container=$("${compose[@]}" ps --all --quiet simulator)
previous_image=""
if [[ -n "$previous_container" ]]; then
  previous_image=$(docker inspect --format '{{.Config.Image}}' "$previous_container")
fi

# Reuse cached immutable digests for rollback; refresh tags and missing images.
# The VPS never builds source, and pull failures leave the running service intact.
if [[ "$SIMULATOR_IMAGE" != *@sha256:* ]] || ! docker image inspect "$SIMULATOR_IMAGE" > /dev/null 2>&1; then
  "${compose[@]}" pull simulator
fi

verify_pages() {
  local path
  for path in / /4g-lte/ /apparent-annual-motion/ /error-detection/ /osi/ /cpu/ /game-of-life/ /lens/ /gps-relativity/ /gravitational-lensing/ /semiconductor/ /thermodynamics/; do
    curl --fail --silent --show-error --max-time 10 "http://127.0.0.1:8590$path" --output /dev/null || return 1
  done
}

if "${compose[@]}" up --detach --no-build --pull never --wait --wait-timeout 60 && verify_pages; then
  printf 'SIMULATOR_IMAGE=%s\n' "$SIMULATOR_IMAGE" > .env.next
  mv -- .env.next .env
  "${compose[@]}" ps
else
  "${compose[@]}" logs --tail 100 simulator
  if [[ -n "$previous_image" ]]; then
    echo "Deployment failed; restoring $previous_image" >&2
    export SIMULATOR_IMAGE="$previous_image"
    "${compose[@]}" up --detach --no-build --pull never --wait --wait-timeout 60
  fi
  exit 1
fi
