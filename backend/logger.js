let sseClients = [];

function addClient(client) {
    sseClients.push(client);
}

function removeClient(client) {
    sseClients = sseClients.filter(c => c !== client);
}

function emitLog(msg, type = 'info') {
  const logEntry = {
    id: Date.now(),
    time: new Date().toLocaleTimeString('pt-BR'),
    msg,
    type // 'info', 'success', 'error', 'warn', 'data'
  };
  console.log(`[LOG:${type}] ${msg}`);
  sseClients.forEach(client => {
    try {
        client.write(`data: ${JSON.stringify(logEntry)}\n\n`);
    } catch (e) {}
  });
}

module.exports = {
    addClient,
    removeClient,
    emitLog
};
