#!/usr/bin/env bash
set -euo pipefail

STACK_NAME="${1:-drlex}"
BASE_URL="${2:-https://drlex.wapify.com.br}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "[check] stack=${STACK_NAME} base_url=${BASE_URL}"

fetch_code() {
  local url="$1"
  curl -sS --max-time 8 -o /dev/null -w '%{http_code}' "${url}" || true
}

check_endpoint() {
  local url="$1"
  local expected="$2"
  local label="$3"
  local required="${4:-true}"
  local attempts="${5:-12}"
  local sleep_seconds="${6:-4}"
  local code=""

  for ((i = 1; i <= attempts; i++)); do
    code="$(fetch_code "${url}")"
    if [[ "${code}" == "${expected}" ]]; then
      echo "[ok] ${label} -> ${expected} (attempt ${i}/${attempts})"
      return 0
    fi
    echo "[warn] ${label} returned ${code:-000} (attempt ${i}/${attempts})"
    sleep "${sleep_seconds}"
  done

  if [[ "${required}" == "true" ]]; then
    echo "[error] ${label} did not return ${expected} after ${attempts} attempts"
    exit 1
  fi

  echo "[warn] ${label} did not return ${expected} after ${attempts} attempts"
  return 1
}

required_services=(
  "${STACK_NAME}_drlex_api"
  "${STACK_NAME}_drlex_frontend"
  "${STACK_NAME}_drlex_worker"
  "${STACK_NAME}_drlex_postgres"
  "${STACK_NAME}_drlex_redis"
)

echo "[check] validating service replicas"
for svc in "${required_services[@]}"; do
  replicas="$(docker service ls --format '{{.Name}} {{.Replicas}}' | awk -v s="$svc" '$1==s {print $2}')"
  if [[ -z "${replicas}" ]]; then
    echo "[error] service not found: ${svc}"
    exit 1
  fi
  if [[ "${replicas}" != "1/1" ]]; then
    echo "[error] unhealthy replicas for ${svc}: ${replicas}"
    exit 1
  fi
  echo "[ok] ${svc} replicas=${replicas}"
done

echo "[check] validating endpoints"
check_endpoint "${BASE_URL}/health/live" "200" "/health/live"
check_endpoint "${BASE_URL}/" "200" "/"
check_endpoint "${BASE_URL}/health" "200" "/health (deep)" "false" "8" "3" || true

echo "[check] recent logs summary"
docker service logs --tail 30 "${STACK_NAME}_drlex_frontend" | tail -n 10 || true
docker service logs --tail 30 "${STACK_NAME}_drlex_api" | tail -n 10 || true
docker service logs --tail 30 "${STACK_NAME}_drlex_worker" | tail -n 10 || true

if git -C "${APP_DIR}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  mkdir -p "${APP_DIR}/.deploy"
  stable_commit="$(git -C "${APP_DIR}" rev-parse HEAD)"
  echo "${stable_commit}" > "${APP_DIR}/.deploy/last-stable-commit"
  echo "[ok] recorded stable commit: ${stable_commit}"
fi

echo "[done] post-deploy check passed"
