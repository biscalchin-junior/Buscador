# 📋 Manual de Operações: Sistema Buscador v2.0

**Modelo**: Monitor de Preços Autônomo  
**Versão**: 2.0.0 (Premium SaaS)  
**Status**: Operacional  

---

## 1. SEGURANÇA E ACESSO
### 1.1 Autenticação Administrativa
O acesso às funções de auditoria e exclusão é restrito ao nível administrativo. 
- **Padrão de Fábrica**: `admin` / `admin123`.
- **Recomendação**: Não compartilhe suas chaves de acesso.

### 1.2 Integridade de Dados
O sistema realiza backups automáticos da base de dados SQLite (`prices.db`) a cada alteração significativa. Em caso de falha de energia, o banco de dados se recuperará automaticamente no próximo boot.

## 2. PROCEDIMENTOS OPERACIONAIS
### 2.1 Auditoria em Tempo Real
Para realizar uma auditoria:
1. Verifique se a conexão com a internet está estável.
2. Insira as URLs de destino.
3. Observe o **Indicador de Progresso** no painel lateral. Não interrompa o processo enquanto o status estiver "Processando".

### 2.2 Gerenciamento de Erros
- **Ícone Vermelho (Falha)**: Indica que a loja bloqueou o acesso temporariamente ou a URL é inválida. Aguarde 5 minutos antes de tentar novamente.
- **Preço R$ 0,00**: O produto pode estar indisponível ou fora de estoque no site de origem.

## 3. ESPECIFICAÇÕES TÉCNICAS
### 3.1 Limites do Sistema
- **Máximo de URLs Simultâneas**: 500 itens.
- **Frequência de Varredura**: Mínimo de 15 minutos entre varreduras globais para evitar bloqueios de IP (Shadowban).

### 3.2 Manutenção
- **Limpeza de Logs**: O sistema mantém logs dos últimos 200 eventos. Logs antigos são rotacionados automaticamente para economizar espaço em disco.
- **Lixeira**: Itens na lixeira não consomem recursos de processamento mas permanecem no banco de dados. Para remoção definitiva, utilize o comando SQL direto (apenas usuários avançados).

## 4. RESOLUÇÃO DE PROBLEMAS (FAQ)
| Problema | Causa Provável | Solução |
| :--- | :--- | :--- |
| Site não abre | Servidor Frontend desligado | Execute `npm run dev` no terminal. |
| Preços não atualizam | Servidor Backend travado | Reinicie o processo `node server.js`. |
| Imagem não aparece | Cache do navegador | Pressione `Ctrl + F5` para limpar o cache. |

---
*Este manual deve ser consultado em caso de dúvidas operacionais ou falhas sistêmicas.*
