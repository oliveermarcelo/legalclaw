#!/usr/bin/env bash
set -euo pipefail

STACK_NAME="${1:-drlex}"
BASE_URL="${2:-https://drlex.wapify.com.br}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "[check] stack=${STACK_NAME} base_url=${BASE_URL}"

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
health_code="$(curl -s -o /dev/null -w '%{http_code}' "${BASE_URL}/health")"
if [[ "${health_code}" != "200" ]]; then
  echo "[error] /health returned ${health_code}"
  exit 1
fi
echo "[ok] ${BASE_URL}/health -> 200"

home_code="$(curl -s -o /dev/null -w '%{http_code}' "${BASE_URL}/")"
if [[ "${home_code}" != "200" ]]; then
  echo "[error] / returned ${home_code}"
  exit 1
fi
echo "[ok] ${BASE_URL}/ -> 200"

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
