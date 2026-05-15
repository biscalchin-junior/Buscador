# 🛠️ Documentação Técnica: Buscador v2.0 Premium

## 1. Visão Geral
O **Buscador** é uma plataforma SaaS de monitoramento autônomo de preços e auditoria de mercado. O sistema utiliza uma arquitetura modular de scrapers para extrair dados em tempo real de grandes varejistas (Amazon, Mercado Livre, etc.) e consolidá-los em um dashboard analítico.

## 2. Stack Tecnológica
### Frontend
- **Framework**: React.js (Vite)
- **Estilização**: TailwindCSS v4 (Configuração CSS-first)
- **Animações**: Framer Motion
- **Gráficos**: Recharts
- **Ícones**: Lucide React

### Backend
- **Runtime**: Node.js
- **Database**: SQLite3 (Persistência local leve e rápida)
- **Scraping**: Playwright (Automação de navegador com bypass de bot)
- **Agendamento**: Node-Cron / Cron-Parser

## 3. Arquitetura do Sistema
O sistema é dividido em dois serviços principais:

### A. Backend (`/backend`)
- **`server.js`**: Ponto de entrada Express. Gerencia API REST e Server-Sent Events (SSE) para logs em tempo real.
- **`database.js`**: Gerenciador da camada de persistência. Define esquemas de tabelas para `products` e `price_history`.
- **`stores/`**: Diretório modular contendo lógica específica para cada varejista (ex: `amazon.js`). Cada módulo é responsável pela extração limpa dos dados via seletores CSS e metadados JSON-LD.

### B. Frontend (`/frontend`)
- **`App.jsx`**: Componente central que gerencia o estado global, autenticação administrativa e roteamento de sub-componentes (`Hero`, `DashboardContent`, `MetricsGrid`).
- **`index.css`**: Design system customizado utilizando as novas diretrizes do Tailwind v4 (`@theme`, `@utility`).

## 4. Fluxo de Auditoria (Scraping)
1. **Input**: O usuário fornece uma URL.
2. **Identificação**: O sistema detecta a loja baseada no domínio.
3. **Execução**: O Playwright abre uma instância (headless por padrão) e navega até a página.
4. **Extração**: O scraper específico da loja extrai: Título, Preço Atual, Preço Antigo, Imagem, Vendedor e Disponibilidade.
5. **Persistência**: Os dados são salvos no SQLite. Se o produto já existe, um novo registro é adicionado ao histórico de preços para gerar o gráfico de tendência.

## 5. Endpoints Principais da API
- `POST /api/audit`: Inicia auditoria de uma ou mais URLs.
- `GET /api/history`: Retorna a lista de produtos monitorados (com filtro de lixeira).
- `POST /api/settings/cron`: Configura o intervalo de atualização automática.
- `GET /api/logs/stream`: Canal SSE para streaming de logs do sistema para o frontend.

## 6. Configuração de Desenvolvimento
### Pré-requisitos
- Node.js v18+
- Git

### Instalação
1. Clone o repositório.
2. No backend: `npm install`
3. No frontend: `npm install`

### Execução
- Backend: `node server.js`
- Frontend: `npm run dev` (Vite roda na porta 8080 por padrão)

---
*Documentação gerada automaticamente para a versão 2.0.0 (Premium SaaS Update)*
