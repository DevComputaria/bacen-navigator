# Git Flow

Este projeto utiliza [Git Flow](https://nvie.com/posts/a-successful-git-branching-model/) para gerenciamento de branches.

## Estrutura de Branches

| Branch | Descrição |
|--------|-----------|
| `main` | Código em produção, sempre estável |
| `develop` | Branch de desenvolvimento, integração de features |
| `feature/*` | Novas funcionalidades |
| `bugfix/*` | Correções de bugs em develop |
| `release/*` | Preparação para nova versão |
| `hotfix/*` | Correções urgentes em produção |

## Comandos Básicos

### Iniciar uma nova feature

```bash
git flow feature start nome-da-feature
# trabalhe na feature...
git flow feature finish nome-da-feature
```

### Iniciar um bugfix

```bash
git flow bugfix start nome-do-bug
# corrija o bug...
git flow bugfix finish nome-do-bug
```

### Criar uma release

```bash
git flow release start 1.1.0
# ajustes finais, atualizar CHANGELOG...
git flow release finish 1.1.0
```

### Hotfix em produção

```bash
git flow hotfix start 1.0.1
# corrija o problema urgente...
git flow hotfix finish 1.0.1
```

## Convenção de Nomes

- **Features**: `feature/adicionar-filtro-ano`
- **Bugfixes**: `bugfix/corrigir-tooltip-mobile`
- **Releases**: `release/1.1.0`
- **Hotfixes**: `hotfix/1.0.1`

## Fluxo de Trabalho

```
main ─────●─────────────────●─────────────● (releases)
          │                 ↑             ↑
          │                 │             │
develop ──●──●──●──●──●─────●──●──●───────● 
              │     ↑       │     ↑
              │     │       │     │
feature/*     ●─────●       │     │
                            │     │
release/*                   ●─────●
```
