// Minimal HTTP server that pretends to be ntfy.sh for the test suite.
// Listens on 127.0.0.1 with an ephemeral port (or one you choose), records
// every incoming request into a shared array, and lets tests inspect or
// reset that array via tiny admin endpoints.
//
// start({ port = 0 }) -> Promise<{ url, port, records, reset, close }>
//
// A simple boolean-flag mutex (`busy`) is held across the operations that
// touch `records` so concurrent requests do not interleave with /__records
// reads or /__reset clears.

import { createServer } from 'node:http';

export function start({ port = 0 } = {}) {
  const records = [];
  let busy = false;

  async function withLock(fn) {
    while (busy) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    busy = true;
    try {
      return await fn();
    } finally {
      busy = false;
    }
  }

  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString('utf8');
    const reqUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);

    if (req.method === 'GET' && reqUrl.pathname === '/__records') {
      const snapshot = await withLock(() => records.slice());
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(snapshot));
      return;
    }

    if (req.method === 'GET' && reqUrl.pathname === '/__reset') {
      await withLock(() => {
        records.length = 0;
      });
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('reset');
      return;
    }

    const record = {
      method: req.method,
      path: `${reqUrl.pathname}${reqUrl.search}`,
      headers: req.headers,
      body,
    };
    const fail = reqUrl.searchParams.has('fail');
    const status = fail ? 500 : 200;

    await withLock(() => {
      records.push(record);
    });

    res.writeHead(status, {
      'Content-Type': 'text/plain',
      Connection: 'close',
    });
    res.end(fail ? 'fail' : 'ok');
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const addr = server.address();
      const handle = {
        url: `http://127.0.0.1:${addr.port}`,
        port: addr.port,
        records,
        async reset() {
          await withLock(() => {
            records.length = 0;
          });
        },
        close() {
          if (typeof server.closeAllConnections === 'function') {
            server.closeAllConnections();
          }
          return new Promise((r) => server.close(() => r()));
        },
      };
      resolve(handle);
    });
  });
}
