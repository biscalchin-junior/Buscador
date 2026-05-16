# 🚀 Guia de Inicialização e Desenvolvimento (Buscador)

Este arquivo foi criado para orientar o **Antigravity** e o desenvolvedor ao rodar este projeto em uma nova máquina.

## 🛠️ Como Iniciar o Sistema
1. **Backend**:
   - Entre na pasta `backend`.
   - Rode `npm install` (caso seja a primeira vez).
   - Rode `npm start`.
2. **Frontend**:
   - Entre na pasta `frontend`.
   - Rode `npm install`.
   - Rode `npm run dev`.

## 📌 Contexto das Últimas Implementações
O sistema foi atualizado para uma arquitetura de **Dashboard Isolado**.
- **Privacidade**: Cada usuário (incluindo o Admin) só vê no seu Dashboard os produtos que ele pessoalmente adicionou.
- **Lixeira Privada**: O que um usuário deleta vai para a lixeira **dele**, sem afetar os outros.
- **SuperAdmin**: Possui um painel exclusivo (`/superadmin`) para monitorar estatísticas globais, erros e gerenciar usuários. Agora inclui contagem de produtos por usuário.
- **Limpeza Automática**: Existe um cron job que limpa itens da lixeira após X dias (configurável no Painel Admin).
- **MSRP/Parcelado**: O sistema monitora mudanças no "Preço De" e calcula taxas de acréscimo no parcelamento com tolerância de 0.10%.
- **Social Proof**: A home agora exibe um contador público de produtos monitorados.

## 🤖 Orientações para o Antigravity
Ao abrir este projeto:
1. Verifique sempre o arquivo `backend/auditor.db` para entender o estado dos dados.
2. O sistema de monitoramento de CPU foi otimizado para Windows usando o `process.cpuUsage()`.
3. Para limpar o banco de dados e começar do zero, utilize o script `backend/cleanup.js`.
4. As rotas públicas estão em `/api/public/...`.
5. Mantenha sempre a estética **Brutalista/Premium** (preto e branco, bordas sólidas, tipografia uppercase) ao editar o frontend.

---
*Assinado: Antigravity AI*
