# 🚀 Como rodar o Buscador.ai em outro PC

Para abrir este projeto em um novo computador, siga os passos abaixo:

## 1. Pré-requisitos
*   Ter o **Node.js** instalado (versão 18 ou superior).
*   Ter o **Git** instalado.

## 2. Clonar o Repositório
Se você ainda não clonou, abra o terminal e use:
```bash
git clone https://github.com/biscalchin-junior/Buscador.git
cd Buscador
git checkout desenvolvimento
```

## 3. Instalar Dependências
Você precisa instalar as bibliotecas tanto no backend quanto no frontend:

**No Backend:**
```bash
cd backend
npm install
```

**No Frontend:**
```bash
cd ../frontend
npm install
```

## 4. Rodar o Projeto
Abra dois terminais (um para cada parte):

**Terminal 1 (Backend):**
```bash
cd backend
npm start
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

## 5. Banco de Dados (SQLite)
O arquivo `database.db` no backend contém todos os produtos e histórico. Se você quiser levar seus dados atuais, copie o arquivo `backend/database.db` para o novo PC. Se não copiar, o sistema criará um banco novo e vazio automaticamente.

---
**Dica**: O site agora está em modo **Brutalista Minimalista** (Preto e Branco total). Se precisar de qualquer ajuste, eu (Antigravity) estou aqui para ajudar!
