# 🚀 Guia: Subir para o GitHub

Este guia mostra como fazer o primeiro push do LegalClaw para o GitHub.

## 📋 Pré-requisitos

- [ ] Conta no GitHub criada
- [ ] Git instalado localmente
- [ ] SSH configurado (recomendado) ou HTTPS

## 🔑 Configurar SSH (Recomendado)

### 1. Gerar chave SSH (se não tiver)

```bash
# Gerar nova chave SSH
ssh-keygen -t ed25519 -C "seu-email@example.com"

# Pressione Enter para aceitar local padrão
# Defina uma senha (opcional, mas recomendado)

# Iniciar ssh-agent
eval "$(ssh-agent -s)"

# Adicionar chave ao ssh-agent
ssh-add ~/.ssh/id_ed25519
```

### 2. Adicionar chave ao GitHub

```bash
# Copiar chave pública
cat ~/.ssh/id_ed25519.pub
# Copie o output (começa com ssh-ed25519...)
```

1. GitHub → Settings → SSH and GPG keys → New SSH key
2. Cole a chave pública
3. Clique em "Add SSH key"

### 3. Testar conexão

```bash
ssh -T git@github.com
# Deve retornar: Hi seu-usuario! You've successfully authenticated...
```

## 📦 Criar Repositório no GitHub

### Via Interface Web

1. GitHub → **+** (canto superior direito) → **New repository**
2. Nome: `legalclaw` (ou `legal-ai-assistant`)
3. Descrição: `🏛️ Assistente Jurídico com IA - WhatsApp + Telegram + OpenClaw`
4. **Público** ou **Privado** (sua escolha)
5. **NÃO** inicialize com README, .gitignore ou license
6. Clique em **Create repository**

### Via CLI (gh)

```bash
# Instalar GitHub CLI
# macOS: brew install gh
# Linux: https://github.com/cli/cli#installation

# Login
gh auth login

# Criar repo
gh repo create legalclaw --public --description "🏛️ Assistente Jurídico com IA"
```

## 🎯 Primeiro Push

### 1. Entrar no diretório do projeto

```bash
cd /path/to/legal-ai-assistant
```

### 2. Inicializar Git (se ainda não foi)

```bash
# Verificar se já foi inicializado
git status

# Se não foi, inicializar
git init
```

### 3. Adicionar arquivos

```bash
# Verificar status
git status

# Adicionar todos os arquivos
git add .

# Verificar o que foi staged
git status
```

### 4. Primeiro commit

```bash
git commit -m "feat: versão inicial do LegalClaw

- Análise de contratos com IA
- Monitor de diários oficiais (DOU/DOE/DOM)
- Gestão de prazos processuais
- Integrações WhatsApp e Telegram
- Deploy com Docker e Portainer
- Documentação completa"
```

### 5. Adicionar remote

**Com SSH (Recomendado)**:
```bash
git remote add origin git@github.com:seu-usuario/legalclaw.git
```

**Com HTTPS**:
```bash
git remote add origin https://github.com/seu-usuario/legalclaw.git
```

### 6. Verificar remote

```bash
git remote -v
# Deve mostrar:
# origin  git@github.com:seu-usuario/legalclaw.git (fetch)
# origin  git@github.com:seu-usuario/legalclaw.git (push)
```

### 7. Renomear branch para main

```bash
git branch -M main
```

### 8. Push!

```bash
git push -u origin main

# Se der erro de autenticação com HTTPS:
# GitHub não aceita mais senha, use token ou SSH
```

## ✅ Verificar no GitHub

1. Acesse: `https://github.com/seu-usuario/legalclaw`
2. Veja todos os arquivos
3. README.md deve estar renderizado
4. Verifique se .env NÃO está lá (está no .gitignore)

## 🔄 Fluxo de Trabalho Diário

### Fazer mudanças

```bash
# 1. Verificar status
git status

# 2. Ver mudanças
git diff

# 3. Adicionar arquivos modificados
git add .
# ou específicos:
git add src/index.js

# 4. Commit
git commit -m "fix: corrige cálculo de prazos"

# 5. Push
git push
```

### Criar nova feature

```bash
# 1. Criar branch
git checkout -b feature/pesquisa-jurisprudencia

# 2. Trabalhar normalmente...
git add .
git commit -m "feat: adiciona pesquisa STF"

# 3. Push da branch
git push -u origin feature/pesquisa-jurisprudencia

# 4. No GitHub, abrir Pull Request

# 5. Após merge, voltar para main
git checkout main
git pull

# 6. Deletar branch local (opcional)
git branch -d feature/pesquisa-jurisprudencia
```

## 🏷️ Criar Releases

### Via GitHub Interface

1. GitHub → Releases → Create a new release
2. Tag: `v1.0.0`
3. Title: `v1.0.0 - Primeira Release`
4. Descrição: Copie do CHANGELOG.md
5. Publish release

### Via Git CLI

```bash
# 1. Criar tag
git tag -a v1.0.0 -m "Release v1.0.0"

# 2. Push tag
git push origin v1.0.0

# 3. No GitHub, vai aparecer em Releases
```

## 🔒 Proteger Secrets

### Nunca commite:
- [ ] `.env` (arquivo de ambiente)
- [ ] `node_modules/` (dependências)
- [ ] Arquivos de log
- [ ] API keys
- [ ] Senhas

### .gitignore já protege:
✅ `.env`
✅ `node_modules/`
✅ `logs/`
✅ `*.key`
✅ `*.pem`

### Se commitou por acidente:

```bash
# Remover do histórico (CUIDADO!)
git rm --cached .env
git commit -m "remove .env do repositório"
git push

# Rotacionar API keys imediatamente!
```

## 📝 Atualizar README

Não esqueça de atualizar:
- [ ] Seu nome de usuário nas URLs
- [ ] Links para Discord/Slack
- [ ] Badges de status
- [ ] Screenshots (adicione depois)

## 🤝 Colaboradores

### Adicionar colaboradores

1. GitHub → Settings → Collaborators
2. Add people
3. Digite username do GitHub
4. Enviar convite

### Aceitar contribuições

1. Pull Requests → Review
2. Aprovar ou pedir mudanças
3. Merge

## 🐛 Troubleshooting

### "Permission denied (publickey)"

```bash
# Verificar chave SSH
ssh -T git@github.com

# Re-adicionar chave
ssh-add ~/.ssh/id_ed25519
```

### "Repository not found"

```bash
# Verificar remote
git remote -v

# Corrigir se necessário
git remote set-url origin git@github.com:USUARIO-CORRETO/legalclaw.git
```

### "Rejected (non-fast-forward)"

```bash
# Pull primeiro
git pull origin main

# Resolver conflitos se houver
# Depois push
git push
```

### Arquivo grande demais

```bash
# GitHub limite: 100MB

# Usar Git LFS para arquivos grandes
git lfs track "*.pdf"
git add .gitattributes
git commit -m "add Git LFS"
```

## 📚 Recursos

- [GitHub Docs](https://docs.github.com)
- [Pro Git Book](https://git-scm.com/book/pt-br/v2)
- [GitHub Learning Lab](https://lab.github.com)
- [Conventional Commits](https://www.conventionalcommits.org)

## ✅ Checklist Final

- [ ] Repositório criado no GitHub
- [ ] Remote configurado
- [ ] .gitignore funcionando
- [ ] Primeiro commit feito
- [ ] Push bem-sucedido
- [ ] README renderizando corretamente
- [ ] Sem secrets commitados
- [ ] LICENSE adicionado
- [ ] CONTRIBUTING.md adicionado
- [ ] CHANGELOG.md adicionado

---

## 🎉 Pronto!

Seu projeto está no GitHub! Agora você pode:

1. ⭐ Pedir para amigos darem estrela
2. 📢 Compartilhar nas redes sociais
3. 🐛 Abrir issues para tarefas futuras
4. 🤝 Aceitar contribuições
5. 📦 Criar releases

**Parabéns! 🚀**
