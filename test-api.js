/**
 * Smoke tests for Music + Vibes API routes.
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
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const body =
    res.headers.get('content-type')?.includes('json') && res.status !== 204
      ? await res.json()
      : null;
  return { status: res.status, body };
}

async function run() {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  console.log('[test-api] Running smoke tests...\n');

  let r = await request('GET', '/api/health');
  assert(r.status === 200, `health: ${r.status}`);
  console.log('  GET /api/health -> 200');

  r = await request('GET', '/api/capabilities');
  assert(r.status === 200 && r.body.routes?.length > 0, `capabilities: ${r.status}`);
  assert(r.body.documentation?.capabilities === '/api/capabilities', 'capabilities doc link');
  console.log(`  GET /api/capabilities -> 200 (${r.body.routeCount} routes)`);

  r = await request('GET', '/api/search');
  assert(r.status === 400, `search no q: ${r.status}`);
  console.log('  GET /api/search (no q) -> 400');

  r = await request('GET', '/api/search?q=daft+punk&type=track');
  assert(r.status === 200 && r.body.tracks, `search: ${r.status}`);
  console.log('  GET /api/search -> 200');

  r = await request('GET', '/api/discover/new-releases?limit=5');
  assert(r.status === 200 && Array.isArray(r.body.items), `new-releases: ${r.status}`);
  console.log('  GET /api/discover/new-releases -> 200');

  r = await request('GET', '/api/charts/albums?limit=5');
  assert(r.status === 200 && r.body.items, `charts albums: ${r.status}`);
  console.log('  GET /api/charts/albums -> 200');

  r = await request('GET', '/api/genres');
  assert(r.status === 200 && r.body.items?.length > 0, `genres: ${r.status}`);
  console.log('  GET /api/genres -> 200');

  r = await request('GET', '/api/charts/tracks?limit=3');
  assert(r.status === 200, `charts tracks: ${r.status}`);
  console.log('  GET /api/charts/tracks -> 200');

  r = await request('POST', '/api/cache/clear');
  assert(r.status === 401, `cache no auth: ${r.status}`);
  r = await request('POST', '/api/cache/clear', {
    headers: { Authorization: 'Bearer test-admin-token' },
  });
  assert(r.status === 200, `cache clear: ${r.status}`);
  console.log('  POST /api/cache/clear -> 200');

  r = await request('GET', '/auth/login');
  assert(r.status === 404 || r.status === 405, `auth get: ${r.status}`);
  r = await request('POST', '/auth/login', {
    body: {},
  });
  assert(
    r.status === 400 || r.status === 503 || r.status === 401,
    `auth login without supabase: ${r.status}`
  );
  console.log('  POST /auth/login -> handled');

  r = await request('GET', '/feed/trending/reviews');
  assert(
    r.status === 200 || r.status === 503,
    `trending reviews: ${r.status}`
  );
  console.log('  GET /feed/trending/reviews -> ok');

  console.log('\n[test-api] All smoke tests passed.');
}

async function teardown() {
  if (server) await new Promise((resolve) => server.close(resolve));
  const cache = await import('./src/services/cache.js');
  try {
    await cache.close();
  } catch {
    /* ignore */
  }
}

run()
  .then(teardown)
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error('\n[test-api] FAILED:', err.message);
    await teardown();
    process.exit(1);
  });
