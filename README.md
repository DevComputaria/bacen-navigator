# BACEN Navigator 🏦

Um navegador visual de normativas do Banco Central do Brasil, inspirado no [MITRE ATT&CK Navigator](https://github.com/mitre/attack-navigator).

![BACEN Navigator](https://img.shields.io/badge/version-1.0-blue)
![Normativas](https://img.shields.io/badge/normativas-287-green)
![Ano](https://img.shields.io/badge/ano-2025-orange)

## 📋 Sobre

O BACEN Navigator é uma ferramenta de visualização interativa para explorar e navegar pelas normativas do Banco Central do Brasil publicadas em 2025. A interface permite visualizar, filtrar e pesquisar normativas de forma intuitiva.

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
python -m http.server 8080
```

Acesse: <http://localhost:8080>

### Opção 2: Servidor Local (Node.js)

```bash
cd bacen-navigator
npx serve
```

### Opção 3: Live Server (VS Code)

Instale a extensão "Live Server" e clique com botão direito no `index.html` → "Open with Live Server"

## 📁 Estrutura do Projeto

```text
bacen-navigator/
├── index.html          # Estrutura HTML principal
├── styles.css          # Estilos CSS
├── app.js              # Lógica JavaScript
├── normativas_2025.json # Dados das normativas
└── README.md           # Este arquivo
```

## 🎨 Tipos de Normativas

| Tipo | Cor | Descrição |
|------|-----|-----------|
| **Resolução CMN** | 🟢 Verde | Conselho Monetário Nacional |
| **Resolução BCB** | 🔵 Azul | Banco Central do Brasil |
| **Instrução Normativa BCB** | 🟣 Roxo | Instruções normativas do BCB |

## 📊 Estatísticas (2025)

- **Total de normativas**: 187
- **Resoluções CMN**: ~60
- **Resoluções BCB**: ~50
- **Instruções Normativas BCB**: ~77

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

### Atualizar dados

Para atualizar os dados com novas normativas, execute o script de extração:

```bash
python extrair_normativas.py
```

Depois copie o arquivo gerado para a pasta do navegador:

```bash
cp normativas_2025.json bacen-navigator/
```

## 📄 Licença

Este projeto é fornecido "como está" para fins educacionais e de referência.

## 🙏 Inspiração

Este projeto foi inspirado no excelente [MITRE ATT&CK Navigator](https://github.com/mitre/attack-navigator), adaptando o conceito de navegação em matriz para o contexto de normativas regulatórias.

---

Desenvolvido com ❤️ para facilitar o acesso às normativas do Banco Central do Brasil.
