const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const net = require('net');
const { once } = require('events');
const { startHealthServer } = require('../src/services/healthServer');

async function freePort() {
  const probe = net.createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

function request(port, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: pathname }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body: JSON.parse(body) }));
    });
    req.on('error', reject);
  });
}

test('readiness endpoint returns 503 before Discord readiness and 200 afterward', async () => {
  const originalPort = process.env.PORT;
  const port = await freePort();
  process.env.PORT = String(port);
  let ready = false;
  const client = {
    isReady: () => ready,
    ws: { status: 1 },
    guilds: { cache: { size: 0 } },
    commands: { size: 0 }
  };
  const server = startHealthServer(client);
  await once(server, 'listening');
  try {
    const starting = await request(port, '/ready');
    assert.equal(starting.statusCode, 503);
    assert.equal(starting.body.ok, false);

    ready = true;
    const online = await request(port, '/ready');
    assert.equal(online.statusCode, 200);
    assert.equal(online.body.ok, true);

    const liveness = await request(port, '/health');
    assert.equal(liveness.statusCode, 200);
    assert.equal(liveness.body.ok, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (originalPort === undefined) delete process.env.PORT;
    else process.env.PORT = originalPort;
  }
});
