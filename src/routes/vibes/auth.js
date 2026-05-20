import { Router } from 'express';
import { getSupabaseAdmin, assertSupabase } from '../../services/supabase/client.js';
import { asyncHandler } from '../../utils/httpErrors.js';
import { ValidationError } from '../../errors.js';

const router = Router();

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    assertSupabase();
    const { email, password, username, displayName } = req.body || {};
    if (!email || !password || !username) {
      throw new ValidationError('email, password and username are required.');
    }

    const admin = getSupabaseAdmin();
    const { data: authData, error: authError } = await admin.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    if (authError) {
      return res.status(400).json({ error: authError.message, code: 'AUTH_ERROR' });
    }

    const userId = authData.user?.id;
    if (userId) {
      await admin.from('profiles').upsert({
        id: userId,
        username: String(username).toLowerCase(),
        display_name: displayName || username,
      });
    }

    res.status(201).json({
      user: authData.user,
      session: authData.session,
      meta: { status: 'ok' },
    });
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    assertSupabase();
    const { email, password } = req.body || {};
    if (!email || !password) {
      throw new ValidationError('email and password are required.');
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin.auth.signInWithPassword({ email, password });
    if (error) {
      return res.status(401).json({ error: error.message, code: 'AUTH_ERROR' });
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    res.json({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: data.user,
      profile,
      meta: { status: 'ok' },
    });
  })
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    res.json({ success: true, message: 'Logout on client: discard tokens.' });
  })
);

export default router;
