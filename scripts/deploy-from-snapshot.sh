#!/usr/bin/env bash
set -euo pipefail

STACK_NAME="${1:-drlex}"
REPO_URL="${2:-https://github.com/oliveermarcelo/legalclaw.git}"
BRANCH="${3:-main}"

APP_DIR="/var/data/drlex/app"
FRONTEND_DIR="/var/data/drlex/frontend"
RELEASES_DIR="/var/data/drlex/releases"
TS="$(date +%Y%m%d-%H%M%S)"
SNAPSHOT_DIR="${RELEASES_DIR}/release-${TS}"

echo "[deploy] stack=${STACK_NAME} branch=${BRANCH}"
echo "[deploy] snapshot=${SNAPSHOT_DIR}"

mkdir -p "${RELEASES_DIR}"
git clone --depth 1 --branch "${BRANCH}" "${REPO_URL}" "${SNAPSHOT_DIR}"
SNAPSHOT_COMMIT="$(git -C "${SNAPSHOT_DIR}" rev-parse --short HEAD)"
echo "[deploy] snapshot commit=${SNAPSHOT_COMMIT}"

# Evita conflito de escrita em node_modules durante update.
docker service scale "${STACK_NAME}_drlex_frontend=0" || true
sleep 5

echo "[deploy] syncing app files"
rsync -a --delete \
  --exclude '.git' \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude 'node_modules' \
  --exclude '.next' \
  "${SNAPSHOT_DIR}/" "${APP_DIR}/"

echo "[deploy] syncing frontend mount"
rsync -a --delete \
  --exclude '.git' \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude 'node_modules' \
  --exclude '.next' \
  "${APP_DIR}/frontend/" "${FRONTEND_DIR}/"

echo "[deploy] rebuilding frontend artifacts"
rm -rf "${FRONTEND_DIR}/node_modules" "${FRONTEND_DIR}/.next"
docker run --rm -v "${FRONTEND_DIR}:/app" -w /app node:18-alpine sh -lc "npm install --include=dev && npm run build"

echo "[deploy] deploying stack"
docker stack deploy -c "${APP_DIR}/portainer-stack.yml" "${STACK_NAME}"
docker service scale "${STACK_NAME}_drlex_frontend=1"
docker service update --force --detach=false "${STACK_NAME}_drlex_api"
docker service update --force --detach=false "${STACK_NAME}_drlex_worker"
docker service update --force --detach=false "${STACK_NAME}_drlex_frontend"

if [[ -f "${APP_DIR}/scripts/post-deploy-check.sh" ]]; then
  echo "[deploy] running post-deploy check"
  bash "${APP_DIR}/scripts/post-deploy-check.sh" "${STACK_NAME}" "https://drlex.wapify.com.br"
fi

echo "[done] deploy completed from snapshot commit ${SNAPSHOT_COMMIT}"
