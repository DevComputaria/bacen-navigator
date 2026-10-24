# BACEN Navigator 🏦

Um navegador visual de normativas do Banco Central do Brasil, inspirado no [MITRE ATT&CK Navigator](https://github.com/mitre/attack-navigator). Os dados resumidos e os textos integrais são atualizados automaticamente a partir das APIs oficiais do BCB.

![BACEN Navigator](https://img.shields.io/badge/version-1.0-blue)
![Anos](https://img.shields.io/badge/anos-2025--2026-orange)

## 📋 Sobre

O BACEN Navigator é uma ferramenta de visualização interativa para explorar e navegar pelas normativas do Banco Central do Brasil. A interface permite visualizar, filtrar, pesquisar e consultar o texto detalhado das normativas.

## ✨ Funcionalidades

### Visualizações

- **📊 Matriz**: Visualização em grid organizada por tipo de normativa e mês
- **📋 Lista**: Tabela com todas as normativas ordenadas por data
- **📅 Timeline**: Visualização cronológica das normativas

### Filtros

- 🔍 **Busca por texto**: Pesquise no nome e descrição
- 📌 **Tipo de normativa**: Resolução CMN, Resolução BCB, Instrução Normativa BCB
- 📆 **Mês**: Filtre por mês de publicação

### Interações

- 🖱️ Clique em uma célula para ver detalhes
- 👆 Hover para ver resumo rápido
- 🔗 Links diretos para as normativas no site do BCB
- 📥 Exportação dos dados filtrados em JSON

## 🚀 Como Usar

### Opção 1: Servidor Local (Python)

```bash
cd bacen-navigator
python3 scripts/build_site.py
python3 -m http.server 8080 --directory dist
```

Acesse: <http://localhost:8080>

### Opção 2: Servidor Local (Node.js)

```bash
cd bacen-navigator
npx serve dist
```

### Opção 3: Live Server (VS Code)

Gere `dist` com `python3 scripts/build_site.py` e abra `dist/index.html` com a extensão Live Server.

## 📁 Estrutura do Projeto

```text
bacen-navigator/
├── src/                 # Aplicação e índices resumidos
├── docs/                # Textos completos, índice e snapshots do feed
├── scripts/             # Conversão, extração, validação e build
├── tests/               # Testes automatizados do pipeline
└── .github/workflows/   # Atualização automática e publicação
```

## 🎨 Tipos de Normativas

| Tipo | Cor | Descrição |
|------|-----|-----------|
| **Resolução CMN** | 🟢 Verde | Conselho Monetário Nacional |
| **Resolução BCB** | 🔵 Azul | Banco Central do Brasil |
| **Instrução Normativa BCB** | 🟣 Roxo | Instruções normativas do BCB |
| **Resolução Conjunta** | 🟠 Laranja | Normas publicadas conjuntamente |
| **Outros** | ⚪ Cinza | Demais tipos encontrados no feed |

## 📊 Estatísticas (2025)

- **Total de normativas**: 287

## 🛠️ Tecnologias

- HTML5
- CSS3 (CSS Variables, Flexbox, Grid)
- JavaScript ES6+ (Vanilla JS)
- Font Awesome (ícones)
- Google Fonts (Roboto)

## 📝 Fonte dos Dados

Os dados são extraídos dos feeds RSS do Banco Central do Brasil:

- URL Base: <https://www.bcb.gov.br/>
- Categoria: Normativos

## 🔧 Desenvolvimento

### Atualizar e validar dados

O workflow `Update Bacen Data` executa quatro vezes ao dia. Para executar localmente após baixar um snapshot do feed:

```bash
python3 scripts/convert_bacen_feed.py \
  --year 2026 \
  --input-dir docs/feed/2026 \
  --output src/normativas_2026.json

python3 scripts/extract_bacen_texts.py \
  src/normativas_2025.json src/normativas_2026.json \
  --output-dir docs --refresh-days 45
```

Valide o conjunto e monte o artefato publicado:

```bash
python3 scripts/validate_bacen_data.py \
  src/normativas_2025.json src/normativas_2026.json \
  --feed-dir docs/feed/2026 --docs-dir docs
python3 scripts/build_site.py
```

## 📄 Licença

Este projeto é fornecido "como está" para fins educacionais e de referência.

## 🙏 Inspiração

Este projeto foi inspirado no excelente [MITRE ATT&CK Navigator](https://github.com/mitre/attack-navigator), adaptando o conceito de navegação em matriz para o contexto de normativas regulatórias.

---

Desenvolvido com ❤️ para facilitar o acesso às normativas do Banco Central do Brasil.
