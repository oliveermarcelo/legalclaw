# ⚖️ DrLex — Assistente Jurídico com IA

**Dr. + Lex** (do latim *lex* = lei). Assistente jurídico inteligente para advogados e escritórios brasileiros.

Análise de contratos, gestão de prazos processuais, monitoramento de diários oficiais — tudo via WhatsApp, Telegram e API REST.

---

## 🚀 Funcionalidades

- **📄 Análise de Contratos** — Identifica cláusulas abusivas, riscos, cita artigos de lei e sugere correções
- **📅 Gestão de Prazos** — Cálculo automático em dias úteis (CPC), feriados nacionais, alertas automáticos
- **📰 Monitor de Diários Oficiais** — Varredura automática do DOU/DOE/DOM com alertas por palavra-chave
- **💬 WhatsApp** — Via Evolution API (WhatsApp real, sem sandbox)
- **🤖 Telegram** — Bot completo com comandos
- **🔌 API REST** — Integração com qualquer sistema

## 🏗️ Stack

| Componente | Tecnologia |
|---|---|
| Backend | Node.js 18 + Express |
| IA | Anthropic Claude (SDK direto) |
| Banco de dados | PostgreSQL 15 |
| Cache | Redis 7 |
| WhatsApp | Evolution API |
| Telegram | Telegraf |
| Deploy | Docker + Portainer |

## 📂 Estrutura

```
drlex/
├── src/
│   ├── index.js                  # Servidor Express + cron jobs
│   ├── config/
│   │   ├── index.js              # Configuração centralizada
│   │   └── migrate.js            # Migrações PostgreSQL
│   ├── services/
│   │   ├── ai.js                 # Anthropic Claude SDK direto
│   │   ├── contract-analyzer.js  # Análise de contratos
│   │   ├── deadline-manager.js   # Prazos processuais (dias úteis)
│   │   ├── diario-monitor.js     # Monitor DOU/DOE/DOM
│   │   └── chat-handler.js       # Roteador de mensagens
│   ├── integrations/
│   │   ├── evolution.js          # WhatsApp via Evolution API
│   │   └── telegram.js           # Bot Telegram
│   ├── routes/
│   │   ├── api.js                # Rotas REST
│   │   └── webhooks.js           # Webhooks da Evolution
│   └── utils/
│       └── logger.js             # Winston logger
├── docker-compose.yml
├── portainer-stack.yml
├── Dockerfile
└── .env.example
```

## ⚡ Deploy Rápido (Portainer)

1. Clone no servidor:
```bash
git clone https://github.com/oliveermarcelo/legalclaw.git /var/data/drlex/app
```

2. Configure as credenciais:
```bash
cp .env.example .env
nano .env  # Preencher ANTHROPIC_API_KEY, EVOLUTION_API_KEY, etc.
```

3. Descubra a rede da Evolution API:
```bash
bash discover-evolution.sh
```

4. No Portainer: **Stacks → Add Stack → Cole o `portainer-stack.yml`**

5. Teste:
```bash
curl http://localhost:3000/health
```

## 🔌 API Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Status dos serviços |
| POST | `/api/contracts/analyze` | Analisar contrato |
| POST | `/api/deadlines` | Criar prazo |
| POST | `/api/deadlines/calculate` | Calcular prazo (sem salvar) |
| GET | `/api/deadlines/tipos/cpc` | Prazos padrão do CPC |
| POST | `/api/diarios/search` | Buscar no DOU |
| POST | `/api/diarios/monitor` | Criar monitor |
| POST | `/api/chat` | Chat com IA |

## 💰 Planos

| Plano | Preço | Contratos | Diários |
|---|---|---|---|
| Solo | R$ 197/mês | 50/mês | DOU |
| Escritório | R$ 497/mês | 200/mês | DOU+DOE+DOM |
| Enterprise | R$ 1.997/mês | Ilimitado | Todos + API + White-label |

## 📜 Licença

Proprietário — Todos os direitos reservados.
