import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { photoToDataUrl } from '../../src/index.js';
import { ThaiIdCardMonitor } from '../../src/pcsc/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

const PORT = Number(process.env.PORT || 3000);

// Connected SSE clients
const sseClients = new Set<http.ServerResponse>();

function broadcast(event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Initialize PC/SC Monitor
const monitor = new ThaiIdCardMonitor({
  photo: true,
  autoRead: true,
});

let latestCardData: unknown = null;

monitor.on('reader', (readerName) => {
  console.log(`🔌 Card reader detected: ${readerName}`);
  broadcast('reader', { reader: readerName, readers: monitor.readers });
});

monitor.on('reader-removed', (readerName) => {
  console.log(`❌ Card reader removed: ${readerName}`);
  broadcast('reader-removed', { reader: readerName, readers: monitor.readers });
});

monitor.on('card-inserted', ({ reader }) => {
  console.log(`💳 Card inserted in [${reader}]`);
  latestCardData = null;
  broadcast('card-inserted', { reader, timestamp: Date.now() });
});

monitor.on('card-removed', ({ reader }) => {
  console.log(`👋 Card removed from [${reader}]`);
  latestCardData = null;
  broadcast('card-removed', { reader, timestamp: Date.now() });
});

monitor.on('data', ({ reader, data }) => {
  console.log(`✅ Read Thai ID Card successfully: ${data.nameTh.full} (${data.citizenId})`);
  const photoUrl = data.photo ? photoToDataUrl(data.photo) : null;
  const cardPayload = {
    ...data,
    photoUrl,
    photo: undefined, // Don't send raw byte array over SSE to save bandwidth
  };
  latestCardData = cardPayload;
  broadcast('card-data', { reader, data: cardPayload });
});

monitor.on('error', ({ reader, error }) => {
  console.error(`⚠️ Monitor Error [${reader ?? 'system'}]:`, error.message);
  broadcast('error', { reader, message: error.message });
});

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  // CORS headers for local development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // SSE endpoint
  if (url.pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });

    sseClients.add(res);

    // Initial state packet
    const initPayload = {
      readers: monitor.readers,
      latestCardData,
    };
    res.write(`event: init\ndata: ${JSON.stringify(initPayload)}\n\n`);

    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  // Status endpoint
  if (url.pathname === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'online',
        readers: monitor.readers,
        hasCardData: !!latestCardData,
      }),
    );
    return;
  }

  // Trigger manual read endpoint
  if (url.pathname === '/api/read' && req.method === 'POST') {
    const readerName = monitor.readers[0];
    if (!readerName) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No smartcard reader attached' }));
      return;
    }
    broadcast('card-inserted', { reader: readerName, timestamp: Date.now() });
    monitor
      .read(readerName, { photo: true })
      .then((data) => {
        const photoUrl = data.photo ? photoToDataUrl(data.photo) : null;
        const cardPayload = { ...data, photoUrl, photo: undefined };
        latestCardData = cardPayload;
        broadcast('card-data', { reader: readerName, data: cardPayload });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: cardPayload }));
      })
      .catch((err) => {
        broadcast('error', { reader: readerName, message: err.message });
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      });
    return;
  }

  // Serve static files
  let filePath = '';
  if (url.pathname === '/' || url.pathname === '/index.html') {
    filePath = path.join(__dirname, 'index.html');
  } else if (url.pathname.startsWith('/dist/')) {
    filePath = path.join(rootDir, url.pathname);
  } else {
    filePath = path.join(__dirname, url.pathname);
  }

  // Prevent path traversal
  const safePath = path.resolve(filePath);
  if (!safePath.startsWith(rootDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(safePath).pipe(res);
  });
});

async function start() {
  try {
    await monitor.start();
    console.log('✅ PC/SC Card Monitor initialized');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('⚠️ PC/SC hardware monitor not available (simulation mode will still work):', msg);
  }

  server.listen(PORT, () => {
    console.log('\n======================================================');
    console.log('🇹🇭 Thai National ID Card — Local Browser Demo');
    console.log(`🌐 Local Web UI: http://localhost:${PORT}`);
    console.log('⚡ Open the URL above in Chrome, Edge, or Firefox');
    console.log('======================================================\n');
  });
}

function cleanup() {
  console.log('\n🛑 Shutting down server...');
  monitor.stop();
  for (const client of sseClients) {
    client.end();
  }
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

start().catch(console.error);
