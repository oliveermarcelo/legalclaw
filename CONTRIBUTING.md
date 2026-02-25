# 🤝 Contribuindo para o LegalClaw

Obrigado por considerar contribuir com o LegalClaw! Este documento fornece diretrizes para contribuir com o projeto.

## 📋 Código de Conduta

Este projeto adere a um código de conduta. Ao participar, você concorda em seguir essas diretrizes:

- Seja respeitoso e inclusivo
- Aceite críticas construtivas
- Foque no que é melhor para a comunidade
- Mostre empatia com outros membros

## 🚀 Como Contribuir

### Reportar Bugs

Encontrou um bug? Abra uma [issue](https://github.com/seu-usuario/legalclaw/issues) com:

- **Título claro** descrevendo o problema
- **Descrição detalhada** com passos para reproduzir
- **Comportamento esperado** vs **comportamento atual**
- **Screenshots** se aplicável
- **Informações do ambiente** (OS, Node.js version, etc)

### Sugerir Features

Tem uma ideia? Abra uma issue com:

- **Descrição da feature**
- **Problema que resolve**
- **Alternativas consideradas**
- **Contexto adicional**

### Pull Requests

1. **Fork** o repositório
2. **Clone** seu fork: `git clone https://github.com/seu-usuario/legalclaw.git`
3. **Crie uma branch**: `git checkout -b feature/MinhaFeature`
4. **Faça commits** descritivos: `git commit -m "feat: adiciona análise de jurisprudência"`
5. **Push** para sua branch: `git push origin feature/MinhaFeature`
6. Abra um **Pull Request**

### Commits

Seguimos [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: adiciona nova funcionalidade
fix: corrige bug
docs: atualiza documentação
style: formatação de código
refactor: refatoração sem mudança de funcionalidade
test: adiciona ou corrige testes
chore: tarefas de manutenção
```

Exemplos:
```bash
git commit -m "feat: adiciona pesquisa de jurisprudência STF"
git commit -m "fix: corrige cálculo de prazos em feriados"
git commit -m "docs: atualiza guia de instalação"
```

## 🏗️ Estrutura do Projeto

```
legal-ai-assistant/
├── src/                # Código fonte principal
├── core/               # Skills e integrações
│   ├── skills/         # Skills customizadas
│   └── integrations/   # WhatsApp, Telegram, etc
├── services/           # Microsserviços
├── docs/               # Documentação
└── tests/              # Testes
```

## 🧪 Testes

Sempre adicione testes para novas funcionalidades:

```bash
# Rodar testes
npm test

# Testes específicos
npm test -- skills/contract-analyzer.test.js

# Coverage
npm run test:coverage
```

## 📝 Documentação

Atualize a documentação quando necessário:

- README.md para mudanças na API
- docs/ para guias e tutoriais
- Comentários no código para lógica complexa

## 🎨 Estilo de Código

Usamos ESLint e Prettier:

```bash
# Verificar estilo
npm run lint

# Corrigir automaticamente
npm run lint:fix

# Formatar código
npm run format
```

## 🔍 Revisão de Código

Pull Requests são revisados para:

- ✅ Testes passando
- ✅ Código bem documentado
- ✅ Segue padrões do projeto
- ✅ Sem conflitos de merge

## 📦 Publicando Releases

Apenas mantenedores podem publicar releases:

1. Atualizar versão em `package.json`
2. Atualizar CHANGELOG.md
3. Tag: `git tag v1.0.0`
4. Push: `git push --tags`
5. GitHub Actions cria release

## 💡 Áreas que Precisam de Ajuda

### Prioritárias
- [ ] Testes automatizados
- [ ] Documentação em inglês
- [ ] Pesquisa de jurisprudência (STF/STJ)
- [ ] Dashboard web

### Melhorias
- [ ] Performance e otimização
- [ ] Novos parsers de diários oficiais
- [ ] Integrações com software jurídico
- [ ] Templates de documentos

### Ideias Futuras
- [ ] Multi-idioma (ES, EN)
- [ ] Mobile app nativo
- [ ] IA de voz
- [ ] Marketplace de skills

## 🏆 Reconhecimento

Contribuidores são reconhecidos em:

- README.md (seção Contributors)
- Releases notes
- Hall of Fame no site

## 📞 Precisa de Ajuda?

- 💬 [Discord](https://discord.gg/legalclaw)
- 📧 Email: dev@legalclaw.com.br
- 📖 [Documentação](docs/)

---

**Obrigado por contribuir! 🙏**
