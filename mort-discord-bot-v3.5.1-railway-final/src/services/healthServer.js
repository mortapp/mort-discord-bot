const http = require('http');

// Started once at process boot (see src/index.js) rather than inside the
// Discord `ready` handler. Railway's healthcheck hits this endpoint during
// deploy before Discord has necessarily finished its handshake, and again
// any time the gateway is reconnecting -- if the server only existed after
// `ready`, a slow/flaky Discord connection would fail the platform
// healthcheck and cause an unnecessary restart loop. Binding immediately
// means the endpoint is always up; the payload just reflects whatever the
// current Discord connection state is.
function startHealthServer(client) {
  const port = Number(process.env.PORT || process.env.HEALTH_PORT || 0);
  if (!port) return null;

  const startedAt = Date.now();

  // discord.js WebSocket status codes: 0 = READY, 1 = CONNECTING,
  // 2 = RECONNECTING, 3 = IDLE, 4 = NEARLY, 5 = DISCONNECTED.
  const wsStatusName = (status) => ({
    0: 'ready',
    1: 'connecting',
    2: 'reconnecting',
    3: 'idle',
    4: 'nearly',
    5: 'disconnected'
  }[status] ?? 'unknown');

  const server = http.createServer((req, res) => {
    if (req.url !== '/health' && req.url !== '/' && req.url !== '/status') {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Not found' }));
      return;
    }

    const isReady = Boolean(client.isReady?.());
    // Never expose IDs, tokens, or user-identifying data on the public
    // health endpoint -- only aggregate, non-sensitive operational status.
    const payload = {
      ok: true,
      name: 'Mort',
      version: process.env.npm_package_version || '3.5.0',
      discord: isReady ? 'ready' : wsStatusName(client.ws?.status),
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      guildCount: client.guilds?.cache?.size || 0,
      commandCount: client.commands?.size || 0
    };

    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(payload));
  });

  server.on('error', (error) => {
    console.error('[Mort] Health server error:', error?.message || error);
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`Mort health server listening on port ${port}`);
  });

  return server;
}

module.exports = { startHealthServer };
