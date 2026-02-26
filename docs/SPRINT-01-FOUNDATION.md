# Sprint 01 - Foundation

Duracao sugerida: 7 dias corridos.

## Meta da Sprint

Estabilizar producao e criar base operacional para evolucao das features core sem regressao.

## Backlog da Sprint

### Track A - Infra e Deploy

- [ ] Padronizar deploy com build unico antes do start.
- [ ] Garantir que `portainer-stack.yml` e `frontend/portainer-stack.yml` estejam sincronizados.
- [ ] Definir fluxo oficial de rollback (script automatico + fallback manual).
- [ ] Documentar runbook de recovery (`502`, restart loop, cache quebrado).

### Track B - Saude e Observabilidade

- [ ] Expandir `/health` para DB + Redis + status de IA.
- [ ] Normalizar logs de erro para facilitar debug em Swarm.
- [ ] Criar checklist de validacao apos deploy.

### Track C - Qualidade do Core Atual

- [ ] Validar busca de diarios com payload `query` e `keyword`.
- [ ] Revisar calculo de prazos com casos de data limite.
- [ ] Revisar fluxo de login para evitar estado de loading preso.

## Criterios de Aceite

- [ ] Frontend sobe sem ciclo de build em runtime.
- [ ] Sem `Bad Gateway` intermitente por 72h.
- [ ] `/health` retorna visibilidade real dos servicos.
- [ ] Build do frontend concluindo em ambiente limpo.

## Validacao Operacional (fim da sprint)

```bash
docker service ls | grep drlex
docker service ps --no-trunc drlex_drlex_frontend | head -n 20
docker service logs --tail 120 drlex_drlex_frontend
curl -s https://drlex.wapify.com.br/health | jq .
```

## Riscos

- Divergencia entre `/var/data/drlex/app/frontend` e `/var/data/drlex/frontend`.
- Cache antigo em `.next` e `node_modules`.
- Secrets de integracoes ausentes (IA, Evolution, Telegram).
