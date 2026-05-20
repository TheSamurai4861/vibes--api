/**
 * Lightweight HTTP smoke tests for production endpoints.
 * Run: npm test
 */

process.env.CACHE_DB_PATH = ':memory:';
process.env.ADMIN_TOKEN = 'test-admin-token';
process.env.CORS_ORIGIN = '*';

const { app } = await import('./server.js');

let server;
let baseUrl;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(method, path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: options.headers,
  });
  const body = res.headers.get('content-type')?.includes('json')
    ? await res.json()
    : null;
  return { status: res.status, body };
}

async function run() {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;

  console.log('[test-api] Running smoke tests...\n');

  const health = await request('GET', '/api/health');
  assert(health.status === 200, `health: expected 200, got ${health.status}`);
  assert(health.body?.status === 'ok', 'health: expected status ok');
  console.log('  GET /api/health -> 200 ok');

  const searchBad = await request('GET', '/api/search');
  assert(searchBad.status === 400, `search without q: expected 400, got ${searchBad.status}`);
  assert(searchBad.body?.code === 'VALIDATION_ERROR', 'search without q: expected VALIDATION_ERROR');
  console.log('  GET /api/search (no q) -> 400 VALIDATION_ERROR');

  const searchOk = await request('GET', '/api/search?q=daft+punk&type=track');
  assert(searchOk.status === 200, `search: expected 200, got ${searchOk.status}`);
  assert(searchOk.body?.meta?.status === 'ok', 'search: expected meta.status ok');
  assert(Array.isArray(searchOk.body?.tracks), 'search: expected tracks array');
  console.log('  GET /api/search?q=daft+punk -> 200 with tracks');

  const cacheNoAuth = await request('POST', '/api/cache/clear');
  assert(cacheNoAuth.status === 401, `cache clear no token: expected 401, got ${cacheNoAuth.status}`);
  console.log('  POST /api/cache/clear (no token) -> 401');

  const cacheAuth = await request('POST', '/api/cache/clear', {
    headers: { Authorization: 'Bearer test-admin-token' },
  });
  assert(cacheAuth.status === 200, `cache clear with token: expected 200, got ${cacheAuth.status}`);
  assert(cacheAuth.body?.success === true, 'cache clear: expected success true');
  console.log('  POST /api/cache/clear (valid token) -> 200');

  console.log('\n[test-api] All smoke tests passed.');
}

async function teardown() {
  if (server) await new Promise((resolve) => server.close(resolve));
  const cache = await import('./src/services/cache.js');
  try {
    await cache.close();
  } catch {
    /* ignore if already closed */
  }
}

run()
  .then(async () => {
    await teardown();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('\n[test-api] FAILED:', err.message);
    await teardown();
    process.exit(1);
  });
