import { LRUCache } from 'lru-cache';
import sqlite3 from 'sqlite3';
import { config } from '../config.js';

const dbPath = config.cacheDbPath;

console.log(`[Cache] Initializing SQLite database at: ${dbPath}`);

// Setup sqlite3 database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('[Cache] Error opening SQLite database:', err);
  }
});

// Configure WAL mode for high performance and create the schema
db.serialize(() => {
  db.run("PRAGMA journal_mode = WAL;", (err) => {
    if (err) {
      console.error('[Cache] Error enabling WAL mode:', err);
    } else {
      console.log('[Cache] SQLite WAL (Write-Ahead Logging) mode enabled.');
    }
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS cache (
      key TEXT PRIMARY KEY,
      value TEXT,
      expires_at INTEGER
    )
  `, (err) => {
    if (err) {
      console.error('[Cache] Error creating cache table:', err);
    } else {
      console.log('[Cache] Persistent cache table ready.');
    }
  });
});

// Setup LRU cache for fast in-memory access
// Configured to store up to 1000 items, with a default 1-hour TTL
const lruOptions = {
  max: 1000,
  ttl: 1000 * 60 * 60, // 1 hour default
};
const memoryCache = new LRUCache(lruOptions);

/**
 * Gets an item from the cache (hybrid: LRU -> SQLite).
 * 
 * @param {string} key - The cache key.
 * @returns {Promise<any>} The cached value or null if not found/expired.
 */
export function get(key) {
  return new Promise((resolve) => {
    // 1. Try In-Memory LRU Cache
    if (memoryCache.has(key)) {
      const val = memoryCache.get(key);
      console.log(`[Cache] Memory HIT for key: ${key}`);
      return resolve(val);
    }

    // 2. Try SQLite Persistent Cache
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
        console.log(`[Cache] Expired SQLite key found: ${key}. Evicting.`);
        // Delete expired entry asynchronously
        db.run('DELETE FROM cache WHERE key = ?', [key], (delErr) => {
          if (delErr) console.error(`[Cache] Failed to evict expired key ${key}:`, delErr);
        });
        return resolve(null);
      }

      try {
        const parsedValue = JSON.parse(row.value);
        // Calculate remaining TTL for memory cache insertion
        const remainingTtl = row.expires_at ? row.expires_at - now : 1000 * 60 * 60;
        
        // Populate LRU cache for future immediate hits
        memoryCache.set(key, parsedValue, { ttl: remainingTtl });
        console.log(`[Cache] SQLite HIT for key: ${key} (stored in LRU, TTL: ${Math.round(remainingTtl / 1000)}s)`);
        resolve(parsedValue);
      } catch (parseErr) {
        console.error(`[Cache] Error parsing cached value for key ${key}:`, parseErr);
        resolve(null);
      }
    });
  });
}

/**
 * Sets an item in the cache (both LRU and SQLite).
 * 
 * @param {string} key - The cache key.
 * @param {any} value - The value to cache.
 * @param {number} ttlMs - Time to live in milliseconds. Defaults to 24 hours.
 * @returns {Promise<boolean>} Resolves to true on success.
 */
export function set(key, value, ttlMs = 1000 * 60 * 60 * 24) {
  return new Promise((resolve) => {
    const expiresAt = Date.now() + ttlMs;
    const serializedValue = JSON.stringify(value);

    // 1. Write to LRU
    memoryCache.set(key, value, { ttl: ttlMs });

    // 2. Write to SQLite
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
  });
}

/**
 * Deletes an item from both LRU and SQLite.
 * 
 * @param {string} key - The cache key.
 * @returns {Promise<boolean>}
 */
export function del(key) {
  return new Promise((resolve) => {
    memoryCache.delete(key);
    db.run('DELETE FROM cache WHERE key = ?', [key], (err) => {
      if (err) {
        console.error(`[Cache] SQLite delete error for key ${key}:`, err);
        return resolve(false);
      }
      console.log(`[Cache] Deleted key: ${key}`);
      resolve(true);
    });
  });
}

/**
 * Clears both LRU and SQLite tables.
 * 
 * @returns {Promise<boolean>}
 */
export function clear() {
  return new Promise((resolve) => {
    memoryCache.clear();
    db.run('DELETE FROM cache', [], (err) => {
      if (err) {
        console.error('[Cache] SQLite clear error:', err);
        return resolve(false);
      }
      console.log('[Cache] Cache cleared completely.');
      resolve(true);
    });
  });
}

/**
 * Health check: verifies SQLite responds.
 * @returns {Promise<boolean>}
 */
export function ping() {
  return new Promise((resolve) => {
    db.get('SELECT 1 AS ok', [], (err) => {
      resolve(!err);
    });
  });
}

/**
 * Closes the SQLite connection gracefully.
 * @returns {Promise<void>}
 */
export function close() {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        console.error('[Cache] Error closing database:', err);
        return reject(err);
      }
      console.log('[Cache] Database connection closed.');
      resolve();
    });
  });
}
