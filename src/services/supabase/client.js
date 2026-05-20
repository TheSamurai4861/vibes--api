import { createClient } from '@supabase/supabase-js';
import { config } from '../../config.js';

let adminClient = null;

export function isSupabaseConfigured() {
  return config.supabaseConfigured;
}

export function assertSupabase() {
  if (!config.supabaseConfigured) {
    const err = new Error('Supabase is not configured');
    err.code = 'SUPABASE_NOT_CONFIGURED';
    throw err;
  }
}

export function getSupabaseAdmin() {
  assertSupabase();
  if (!adminClient) {
    adminClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return adminClient;
}

/**
 * @param {string} accessToken
 */
export function getSupabaseAsUser(accessToken) {
  assertSupabase();
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
