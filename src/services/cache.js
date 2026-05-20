import { LRUCache } from 'lru-cache';
import { config } from '../config.js';

const memoryOnly = config.cacheMemoryOnly;

const lruOptions = {
  max: 1000,
  ttl: 1000 * 60 * 60,
};
const memoryCache = new LRUCache(lruOptions);

/** @type {import('sqlite3').Database | null} */
let db = null;

async function initSqlite() {
  if (memoryOnly || db) return;

  const sqlite3 = (await import('sqlite3')).default;
  const dbPath = config.cacheDbPath;

  console.log(`[Cache] Initializing SQLite database at: ${dbPath}`);

  await new Promise((resolve, reject) => {
    const database = new sqlite3.Database(dbPath, (err) => {
      if (err) reject(err);
      else resolve();
    });
    db = database;
  });

  await new Promise((resolve, reject) => {
    db.run('PRAGMA journal_mode = WAL;', (err) => {
      if (err) reject(err);
      else {
        console.log('[Cache] SQLite WAL mode enabled.');
        resolve();
      }
    });
  });

  await new Promise((resolve, reject) => {
    db.run(
      `CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        value TEXT,
        expires_at INTEGER
      )`,
      (err) => {
        if (err) reject(err);
        else {
          console.log('[Cache] Persistent cache table ready.');
          resolve();
        }
      }
    );
  });
}

const sqliteReady = memoryOnly
  ? Promise.resolve().then(() => {
      console.log('[Cache] Memory-only mode (CACHE_MEMORY_ONLY) — SQLite disabled.');
    })
  : initSqlite().catch((err) => {
      console.error('[Cache] SQLite init failed, falling back to memory-only:', err.message);
    });

/**
 * @param {string} key
 * @returns {Promise<any>}
 */
export function get(key) {
  return sqliteReady.then(
    () =>
      new Promise((resolve) => {
        if (memoryCache.has(key)) {
          const val = memoryCache.get(key);
          console.log(`[Cache] Memory HIT for key: ${key}`);
          return resolve(val);
        }

        if (!db) {
          console.log(`[Cache] MISS for key: ${key}`);
          return resolve(null);
        }

        db.get('SELECT value, expires_at FROM cache WHERE key = ?', [key], (err, row) => {
          if (err) {
            console.error(`[Cache] SQLite read error for key ${key}:`, err);
            return resolve(null);
          }

          if (!row) {
            console.log(`[Cache] MISS for key: ${key}`);
            return resolve(null);
          }

          const now = Date.now();
          if (row.expires_at && now > row.expires_at) {
            db.run('DELETE FROM cache WHERE key = ?', [key]);
            return resolve(null);
          }

          try {
            const parsedValue = JSON.parse(row.value);
            const remainingTtl = row.expires_at ? row.expires_at - now : 1000 * 60 * 60;
            memoryCache.set(key, parsedValue, { ttl: remainingTtl });
            console.log(`[Cache] SQLite HIT for key: ${key}`);
            resolve(parsedValue);
          } catch (parseErr) {
            console.error(`[Cache] Error parsing cached value for key ${key}:`, parseErr);
            resolve(null);
          }
        });
      })
  );
}

/**
 * @param {string} key
 * @param {any} value
 * @param {number} ttlMs
 * @returns {Promise<boolean>}
 */
export function set(key, value, ttlMs = 1000 * 60 * 60 * 24) {
  return sqliteReady.then(
    () =>
      new Promise((resolve) => {
        memoryCache.set(key, value, { ttl: ttlMs });

        if (!db) {
          console.log(`[Cache] Cached key (memory only): ${key}`);
          return resolve(true);
        }

        const expiresAt = Date.now() + ttlMs;
        const serializedValue = JSON.stringify(value);

        db.run(
          'INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES (?, ?, ?)',
          [key, serializedValue, expiresAt],
          (err) => {
            if (err) {
              console.error(`[Cache] SQLite set error for key ${key}:`, err);
              return resolve(false);
            }
            console.log(`[Cache] Cached key: ${key} (TTL: ${Math.round(ttlMs / 1000)}s)`);
            resolve(true);
          }
        );
      })
  );
}

/**
 * @param {string} key
 * @returns {Promise<boolean>}
 */
export function del(key) {
  return sqliteReady.then(
    () =>
      new Promise((resolve) => {
        memoryCache.delete(key);
        if (!db) return resolve(true);

        db.run('DELETE FROM cache WHERE key = ?', [key], (err) => {
          if (err) {
            console.error(`[Cache] SQLite delete error for key ${key}:`, err);
            return resolve(false);
          }
          resolve(true);
        });
      })
  );
}

/**
 * @returns {Promise<boolean>}
 */
export function clear() {
  return sqliteReady.then(
    () =>
      new Promise((resolve) => {
        memoryCache.clear();
        if (!db) {
          console.log('[Cache] Memory cache cleared.');
          return resolve(true);
        }

        db.run('DELETE FROM cache', [], (err) => {
          if (err) {
            console.error('[Cache] SQLite clear error:', err);
            return resolve(false);
          }
          console.log('[Cache] Cache cleared completely.');
          resolve(true);
        });
      })
  );
}

/**
 * @returns {Promise<boolean>}
 */
export function ping() {
  return sqliteReady.then(
    () =>
      new Promise((resolve) => {
        if (!db) return resolve(true);
        db.get('SELECT 1 AS ok', [], (err) => resolve(!err));
      })
  );
}

/**
 * @returns {Promise<void>}
 */
export function close() {
  return sqliteReady.then(
    () =>
      new Promise((resolve, reject) => {
        if (!db) return resolve();
        db.close((err) => {
          if (err) return reject(err);
          console.log('[Cache] Database connection closed.');
          resolve();
        });
      })
  );
}
