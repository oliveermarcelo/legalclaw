# Runbook de Recovery - Produção

Guia operacional para recuperar rapidamente instabilidade no stack `drlex`.

## 1) Checagem rapida

```bash
docker service ls | grep drlex
docker service ps --no-trunc drlex_drlex_frontend | head -n 20
docker service logs --tail 80 drlex_drlex_frontend
curl -Ik https://drlex.wapify.com.br/health
```

## 2) Fluxo padrao de redeploy (sem risco)

```bash
cd /var/data/drlex/app
git fetch origin
git checkout main
git pull --ff-only origin main

docker service scale drlex_drlex_frontend=0
sleep 5

rsync -a --delete --exclude node_modules --exclude .next /var/data/drlex/app/frontend/ /var/data/drlex/frontend/
rm -rf /var/data/drlex/frontend/node_modules /var/data/drlex/frontend/.next

docker run --rm -v /var/data/drlex/frontend:/app -w /app node:18-alpine sh -lc "npm install --include=dev && npm run build"

docker stack deploy -c /var/data/drlex/app/portainer-stack.yml drlex
docker service scale drlex_drlex_frontend=1
docker service update --force --detach=false drlex_drlex_frontend
```

## 3) Validacao pos-deploy

```bash
bash /var/data/drlex/app/scripts/post-deploy-check.sh drlex https://drlex.wapify.com.br
```

## 4) Sintomas e causa provavel

- `502 Bad Gateway` intermitente:
  - frontend reiniciando ou sem build pronto.
- `Could not find a production build in .next`:
  - `npm run start` sem build previo.
- `Cannot find module 'tailwindcss'`:
  - dependencias de dev nao instaladas durante build.
- `ENOTEMPTY ... node_modules`:
  - conflito de escrita durante restart, limpar volume e refazer build.

## 5) Rollback rapido

```bash
cd /var/data/drlex/app
git log --oneline -n 5
git checkout <commit_estavel>
docker stack deploy -c /var/data/drlex/app/portainer-stack.yml drlex
docker service update --force --detach=false drlex_drlex_frontend
```

Depois do incidente, retornar para `main` e corrigir a causa.
