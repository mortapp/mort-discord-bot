const http = require('http');
const { runtimeConfig } = require('../config/runtime');

function wsStatusName(status) {
  return ({ 0: 'ready', 1: 'connecting', 2: 'reconnecting', 3: 'idle', 4: 'nearly', 5: 'disconnected' }[status] ?? 'unknown');
}

function healthPayload(client, startedAt, ready) {
  const { version } = runtimeConfig();
  return {
    ok: ready,
    name: 'Mort',
    version,
    discord: client.isReady?.() ? 'ready' : wsStatusName(client.ws?.status),
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    guildCount: client.guilds?.cache?.size || 0,
    commandCount: client.commands?.size || 0
  };
}

function startHealthServer(client, { isShuttingDown = () => false, onError = null } = {}) {
  const { port } = runtimeConfig();
  if (!port) return null;
  const startedAt = Date.now();
  const sockets = new Set();

  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const ready = Boolean(client.isReady?.()) && !isShuttingDown();
    if (!['/health', '/ready', '/', '/status'].includes(pathname)) {
      res.writeHead(404, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(JSON.stringify({ ok: false, error: 'Not found' }));
    }
    const isReadinessProbe = pathname === '/ready';
    const statusCode = isReadinessProbe && !ready ? 503 : 200;
    const payload = healthPayload(client, startedAt, isReadinessProbe ? ready : true);
    res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(payload));
  });

  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  server.on('error', (error) => {
    console.error('[Mort] Health server error:', error?.message || error);
    onError?.(error);
  });
  server.on('close', () => sockets.clear());
  server.closeActiveConnections = () => {
    server.closeIdleConnections?.();
    for (const socket of sockets) socket.destroy();
  };
  server.listen(port, '0.0.0.0', () => console.log(`Mort health server listening on port ${port}`));
  return server;
}

module.exports = { startHealthServer, healthPayload, wsStatusName };
