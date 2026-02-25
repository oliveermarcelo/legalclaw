# 📁 Estrutura do Projeto LegalClaw

```
legal-ai-assistant/
│
├── 📄 README.md                      # Documentação principal
├── 📄 package.json                   # Dependências Node.js
├── 📄 .env.example                   # Template de variáveis
├── 📄 .gitignore                     # Arquivos ignorados
├── 📄 Dockerfile                     # Container da aplicação
├── 📄 docker-compose.yml             # Orquestração de containers
├── 🔧 install.sh                     # Script de instalação
│
├── 📂 src/                           # Código fonte principal
│   ├── index.js                      # Entrada da aplicação
│   ├── 📂 models/                    # Modelos de dados
│   ├── 📂 controllers/               # Controladores da API
│   ├── 📂 services/                  # Lógica de negócio
│   └── 📂 utils/                     # Utilitários
│
├── 📂 core/                          # Componentes core do sistema
│   │
│   ├── 📂 openclaw-setup/            # Configuração OpenClaw
│   │   ├── config.json
│   │   └── prompts/
│   │
│   ├── 📂 skills/                    # Skills customizadas
│   │   ├── contract-analyzer.js      # ✅ Análise de contratos
│   │   ├── diario-monitor.js         # ✅ Monitor diários oficiais
│   │   ├── deadline-manager.js       # ✅ Gestão de prazos
│   │   ├── jurisprudence-search.js   # 🔲 Pesquisa jurisprudência
│   │   └── document-generator.js     # 🔲 Gerador de documentos
│   │
│   └── 📂 integrations/              # Integrações externas
│       ├── whatsapp.js               # ✅ WhatsApp (Twilio)
│       ├── telegram.js               # ✅ Telegram Bot
│       ├── email.js                  # 🔲 Email (SMTP)
│       ├── calendar.js               # 🔲 Google Calendar
│       └── legal-software.js         # 🔲 Projuris, ADVBOX, etc
│
├── 📂 services/                      # Microsserviços especializados
│   │
│   ├── 📂 diario-monitor/            # Monitor de diários
│   │   ├── index.js
│   │   ├── parsers/
│   │   │   ├── dou-parser.js
│   │   │   ├── doe-parser.js
│   │   │   └── dom-parser.js
│   │   └── config.json
│   │
│   ├── 📂 contract-analyzer/         # Analisador de contratos
│   │   ├── index.js
│   │   ├── templates/
│   │   └── risk-analyzer.js
│   │
│   ├── 📂 deadline-manager/          # Gerenciador de prazos
│   │   ├── index.js
│   │   ├── calendar.js
│   │   └── alerts.js
│   │
│   └── 📂 jurisprudence/             # Pesquisa jurisprudência
│       ├── index.js
│       ├── scrapers/
│       │   ├── stf-scraper.js
│       │   ├── stj-scraper.js
│       │   └── tj-scraper.js
│       └── parser.js
│
├── 📂 api/                           # API REST (opcional)
│   ├── package.json
│   ├── server.js
│   ├── 📂 routes/
│   ├── 📂 middleware/
│   └── 📂 controllers/
│
├── 📂 dashboard/                     # Interface web
│   ├── package.json
│   ├── next.config.js
│   ├── 📂 pages/
│   ├── 📂 components/
│   ├── 📂 styles/
│   └── 📂 public/
│
├── 📂 infra/                         # Infraestrutura
│   │
│   ├── 📂 docker/                    # Configurações Docker
│   │   ├── Dockerfile.api
│   │   ├── Dockerfile.dashboard
│   │   └── docker-compose.prod.yml
│   │
│   ├── 📂 cloud/                     # Deploy cloud
│   │   ├── aws/
│   │   │   ├── terraform/
│   │   │   └── cloudformation/
│   │   └── heroku/
│   │       └── Procfile
│   │
│   ├── 📂 monitoring/                # Monitoramento
│   │   ├── datadog.yaml
│   │   ├── sentry.js
│   │   └── prometheus.yml
│   │
│   └── 📂 nginx/                     # Reverse proxy
│       ├── nginx.conf
│       └── ssl/
│
├── 📂 scripts/                       # Scripts utilitários
│   ├── setup.js                      # Setup inicial
│   ├── install-skills.js             # Instalar skills
│   ├── deploy.js                     # Deploy automatizado
│   ├── backup.js                     # Backup de dados
│   └── migrate.js                    # Migrações de banco
│
├── 📂 docs/                          # Documentação
│   ├── README.md
│   ├── QUICK_START.md                # ✅ Guia de início rápido
│   ├── BUSINESS_PLAN.md              # ✅ Plano de negócios
│   ├── INSTALLATION.md               # 🔲 Guia de instalação
│   ├── API.md                        # 🔲 Documentação da API
│   ├── INTEGRATIONS.md               # 🔲 Guia de integrações
│   ├── SKILLS.md                     # 🔲 Como criar skills
│   ├── TROUBLESHOOTING.md            # 🔲 Solução de problemas
│   ├── CONTRIBUTING.md               # 🔲 Como contribuir
│   └── CHANGELOG.md                  # 🔲 Histórico de mudanças
│
├── 📂 tests/                         # Testes
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── 📂 data/                          # Dados locais (gitignored)
│   ├── contracts/
│   ├── documents/
│   └── cache/
│
└── 📂 logs/                          # Logs (gitignored)
    ├── error.log
    ├── combined.log
    └── access.log

```

## 📊 Status de Implementação

### ✅ Implementado (MVP)
- Estrutura base do projeto
- Skills principais:
  - Análise de contratos
  - Monitor de diários oficiais
  - Gestão de prazos
- Integrações:
  - WhatsApp (Twilio)
  - Telegram Bot
- Sistema principal (orquestração)
- Documentação:
  - README
  - Plano de negócios
  - Guia de início rápido
- Docker setup
- Scripts de instalação

### 🔲 Próximas Implementações

#### Fase 1 (Semana 1-2)
- [ ] Skill: Pesquisa de jurisprudência
- [ ] Skill: Gerador de documentos
- [ ] Database setup (PostgreSQL + Prisma)
- [ ] Testes unitários básicos
- [ ] Landing page

#### Fase 2 (Semana 3-4)
- [ ] Dashboard web (Next.js)
- [ ] API REST completa
- [ ] Autenticação JWT
- [ ] Sistema de billing (Stripe)
- [ ] Admin panel

#### Fase 3 (Mês 2)
- [ ] Integrações com software jurídico
- [ ] Multi-tenancy
- [ ] Analytics
- [ ] Email marketing automation
- [ ] Mobile apps (React Native)

## 🎯 Arquivos Principais

### Configuração
```
.env.example          # Template de variáveis de ambiente
package.json          # Dependências e scripts
docker-compose.yml    # Orquestração de containers
```

### Core
```
src/index.js                          # Entrada principal
core/skills/contract-analyzer.js      # Análise de contratos
core/skills/diario-monitor.js         # Monitor diários
core/skills/deadline-manager.js       # Gestão prazos
core/integrations/whatsapp.js         # WhatsApp
core/integrations/telegram.js         # Telegram
```

### Documentação
```
README.md                    # Visão geral
docs/QUICK_START.md         # Início rápido
docs/BUSINESS_PLAN.md       # Plano de negócios
```

## 📦 Tecnologias

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express, Fastify
- **Database**: PostgreSQL, Redis
- **ORM**: Prisma
- **Queue**: Bull

### IA & Automação
- **LLM**: Anthropic Claude 4.5
- **Framework**: OpenClaw
- **Parsing**: Cheerio, pdf-parse
- **Cron**: node-cron

### Messaging
- **WhatsApp**: Twilio
- **Telegram**: Telegraf
- **Email**: Nodemailer

### Frontend (Dashboard)
- **Framework**: Next.js 14
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui
- **State**: Zustand
- **Forms**: React Hook Form

### DevOps
- **Containers**: Docker, Docker Compose
- **CI/CD**: GitHub Actions
- **Hosting**: AWS, Heroku, Vercel
- **Monitoring**: Sentry, Datadog

### Security
- **Auth**: JWT, bcrypt
- **Encryption**: crypto
- **Rate Limiting**: express-rate-limit
- **CORS**: cors

## 🔧 Scripts Disponíveis

```bash
npm start              # Inicia aplicação
npm run dev            # Modo desenvolvimento
npm run build          # Build para produção
npm test               # Roda testes
npm run lint           # Linter
npm run setup          # Setup inicial
npm run deploy         # Deploy automatizado
```

## 🚀 Como Começar

1. **Clone e instale**:
   ```bash
   git clone repo
   cd legal-ai-assistant
   ./install.sh
   ```

2. **Configure**:
   ```bash
   cp .env.example .env
   nano .env
   ```

3. **Inicie**:
   ```bash
   npm start
   # ou
   docker-compose up
   ```

4. **Teste**:
   ```bash
   curl http://localhost:3000/health
   ```

## 📚 Mais Informações

- 📖 [Guia Completo](./docs/QUICK_START.md)
- 💼 [Plano de Negócios](./docs/BUSINESS_PLAN.md)
- 🐛 [Issues](https://github.com/seu-usuario/legal-ai-assistant/issues)

---

**Legenda**: ✅ Implementado | 🔲 Planejado | 🔄 Em desenvolvimento
