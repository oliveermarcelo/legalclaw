#!/usr/bin/env bash
set -euo pipefail

STACK_NAME="${1:-drlex}"
BASE_URL="${2:-https://drlex.wapify.com.br}"
TARGET_REF="${3:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
FRONTEND_SYNC_DIR="/var/data/drlex/frontend"

cd "${APP_DIR}"

echo "[rollback] stack=${STACK_NAME} base_url=${BASE_URL}"
echo "[rollback] app_dir=${APP_DIR}"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "[error] ${APP_DIR} nao eh um repositorio git"
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "[error] repositorio com alteracoes locais. commit/stash antes do rollback."
  exit 1
fi

git fetch origin --tags

if [[ -z "${TARGET_REF}" ]]; then
  if [[ -f "${APP_DIR}/.deploy/last-stable-commit" ]]; then
    TARGET_REF="$(cat "${APP_DIR}/.deploy/last-stable-commit")"
    echo "[rollback] using .deploy/last-stable-commit=${TARGET_REF}"
  elif git rev-parse --verify --quiet "stable^{commit}" >/dev/null; then
    TARGET_REF="stable"
    echo "[rollback] using git tag stable"
  else
    TARGET_REF="HEAD~1"
    echo "[rollback] no stable marker found, fallback=${TARGET_REF}"
  fi
fi

if ! git rev-parse --verify --quiet "${TARGET_REF}^{commit}" >/dev/null; then
  echo "[error] referencia invalida: ${TARGET_REF}"
  exit 1
fi

current_commit="$(git rev-parse --short HEAD)"
target_commit="$(git rev-parse --short "${TARGET_REF}")"
echo "[rollback] current=${current_commit} target=${target_commit}"

git checkout "${TARGET_REF}"

echo "[rollback] rebuilding frontend artifacts"
docker service scale "${STACK_NAME}_drlex_frontend=0" || true
sleep 5

rsync -a --delete --exclude node_modules --exclude .next "${APP_DIR}/frontend/" "${FRONTEND_SYNC_DIR}/"
rm -rf "${FRONTEND_SYNC_DIR}/node_modules" "${FRONTEND_SYNC_DIR}/.next"
docker run --rm -v "${FRONTEND_SYNC_DIR}:/app" -w /app node:18-alpine sh -lc "npm install --include=dev && npm run build"

echo "[rollback] deploying stack"
docker stack deploy -c "${APP_DIR}/portainer-stack.yml" "${STACK_NAME}"
docker service scale "${STACK_NAME}_drlex_frontend=1"
docker service update --force --detach=false "${STACK_NAME}_drlex_api"
docker service update --force --detach=false "${STACK_NAME}_drlex_worker"
docker service update --force --detach=false "${STACK_NAME}_drlex_frontend"

echo "[rollback] running post-deploy checks"
bash "${APP_DIR}/scripts/post-deploy-check.sh" "${STACK_NAME}" "${BASE_URL}"

echo "[done] rollback concluido para ${target_commit}"
echo "[note] repositorio esta em detached HEAD no commit ${target_commit}"
echo "[note] para voltar ao fluxo normal:"
echo "       git checkout main && git pull --ff-only origin main"
