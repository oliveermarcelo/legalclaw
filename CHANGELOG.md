# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Planejado
- Pesquisa de jurisprudência (STF/STJ)
- Gerador de petições
- Dashboard web
- Mobile app

## [1.0.0] - 2026-02-09

### Adicionado
- ✨ Análise de contratos com IA
  - Identificação de partes e objeto
  - Análise de cláusulas críticas
  - Avaliação de riscos
  - Verificação de compliance (LGPD)
  
- 📰 Monitor de diários oficiais
  - DOU (Diário Oficial da União)
  - DOE (Diários Estaduais)
  - DOM (Diários Municipais)
  - Alertas automáticos via WhatsApp/Telegram
  
- ⏰ Gestão de prazos processuais
  - Cálculo automático de prazos (dias úteis)
  - Calendário de feriados brasileiros
  - Alertas proativos (7, 3, 1 dia)
  - Suporte a diferentes tribunais
  
- 📱 Integrações
  - WhatsApp via Twilio
  - Telegram Bot completo
  - API REST documentada
  
- 🐳 Infraestrutura
  - Docker e Docker Compose
  - Configuração para Portainer
  - PostgreSQL + Redis
  - Nginx reverse proxy
  
- 📚 Documentação
  - Guia de início rápido
  - Deploy no Portainer (passo-a-passo)
  - Plano de negócios completo
  - Checklist de deploy
  
- 🔧 DevOps
  - Health checks
  - Logs estruturados
  - Backup automático
  - CI/CD preparado

### Segurança
- Autenticação JWT
- Criptografia de dados sensíveis
- Rate limiting
- CORS configurado
- Validação de entrada

## [0.9.0] - 2026-02-01

### Adicionado
- Estrutura base do projeto
- Sistema de skills customizadas
- Integração com OpenClaw
- Testes iniciais

---

## Tipos de Mudanças

- `Adicionado` para novas funcionalidades
- `Modificado` para mudanças em funcionalidades existentes
- `Depreciado` para funcionalidades que serão removidas
- `Removido` para funcionalidades removidas
- `Corrigido` para correção de bugs
- `Segurança` para vulnerabilidades

---

[Unreleased]: https://github.com/seu-usuario/legalclaw/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/seu-usuario/legalclaw/releases/tag/v1.0.0
[0.9.0]: https://github.com/seu-usuario/legalclaw/releases/tag/v0.9.0
