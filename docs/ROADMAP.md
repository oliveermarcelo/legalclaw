# Roadmap LegalClaw

Este documento define a sequencia de execucao para colocar o produto em operacao estavel, validar mercado e escalar features premium.

## Norte do Produto

- Modo seguro por padrao: IA sugere, humano aprova acoes criticas.
- Operacao confiavel em producao antes de acelerar novas features.
- Evolucao orientada por receita e retencao.

## Fase 0 - Fundacao (1 semana)

Objetivo: eliminar instabilidade operacional e padronizar deploy.

Entregas:
- Deploy estavel (frontend sem build no boot do container).
- Healthcheck ampliado (API, DB, Redis, status de IA).
- Observabilidade minima (logs por modulo e erros acionaveis).
- Documento operacional de deploy/recovery validado.

Criterio de aceite:
- 7 dias sem `Bad Gateway` intermitente por restart loop.
- `docker service ps` sem falhas recorrentes no frontend.

## Fase 1 - Core MVP (2 a 4 semanas)

Objetivo: consolidar os 4 pilares core do produto.

1. Monitor de Diarios Oficiais
- DOU estavel em producao.
- Estrutura preparada para conectores DOE/DOM por estado/municipio.
- Alertas deduplicados e historico rastreavel.

2. Analise Basica de Contratos
- Entrada por texto + PDF.
- Analise de clausulas criticas com score e recomendacao.
- Persistencia de resultado e auditoria.

3. Calendario de Prazos
- Calculo CPC com dias uteis.
- Base de feriados nacionais + extensao estadual/municipal.
- Alertas automáticos por canais configurados.

4. Base de Conhecimento (RAG)
- Ingestao de legislacao em pipeline versionado.
- Busca semantica com citacao de fonte.
- Resposta com rastreabilidade de origem.

Criterio de aceite:
- Fluxo ponta a ponta funcionando para usuarios reais sem intervencao manual.

## Fase 2 - Monetizacao e Validacao (2 semanas)

Objetivo: transformar uso em receita recorrente.

Planos:
- Tier 1 - R$ 197/mes
- Tier 2 - R$ 497/mes
- Enterprise - R$ 1.997+/mes

Entregas:
- Limites por plano aplicados no backend.
- Assinatura/cobranca/renovacao automatizadas.
- Upgrade/downgrade sem perda de dados.
- Painel de metricas de negocio (ativacao, retencao, margem por conta).

Criterio de aceite:
- Primeiros clientes pagantes ativos com cobranca automatica.

## Fase 3 - Diferenciacao Premium (4 a 8 semanas)

Objetivo: consolidar vantagem competitiva no mercado juridico.

Entregas:
- Compliance Dashboard.
- Gerador de Peticoes com templates.
- Analise de Jurisprudencia.
- Multi-jurisdicao (federal/estadual/municipal).
- Integracoes com Projuris, Astrea e ADVBOX.

Criterio de aceite:
- Clientes enterprise utilizando ao menos 2 modulos premium.

## Regras de Seguranca (Transversal)

- IA nao executa acao critica de forma autonoma.
- Operacoes criticas exigem aprovacao explicita.
- Trilha de auditoria para alteracoes e envios.
- Controle de acesso por perfil e plano.
- Governanca LGPD (retencao, minimizacao e exclusao).

## KPIs de Acompanhamento

- Disponibilidade do frontend/API.
- Taxa de erro por endpoint e por integracao.
- Tempo medio de resposta de IA.
- Custo de IA por cliente ativo.
- Conversao para plano pago e churn.
