const http = require('http');

function startHealthServer(client) {
  const port = Number(process.env.PORT || process.env.HEALTH_PORT || 0);
  if (!port) return null;

  const startedAt = Date.now();
  const server = http.createServer((req, res) => {
    const payload = {
      ok: true,
      bot: client.user?.tag || 'Mort',
      ready: Boolean(client.isReady?.()),
      guilds: client.guilds?.cache?.size || 0,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      version: '3.0.0'
    };

    if (req.url === '/health' || req.url === '/' || req.url === '/status') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(payload));
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Not found' }));
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`Mort health server listening on port ${port}`);
  });
  return server;
}

module.exports = { startHealthServer };
