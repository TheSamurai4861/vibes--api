import { Router } from 'express';
import { getSupabaseAdmin } from '../../services/supabase/client.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { asyncHandler, notFound } from '../../utils/httpErrors.js';
import { ValidationError } from '../../errors.js';

const router = Router();

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const admin = getSupabaseAdmin();
    const { data: memberships } = await admin
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', req.user.id);

    const ids = (memberships || []).map((m) => m.conversation_id);
    if (!ids.length) {
      return res.json({ items: [], meta: { status: 'ok' } });
    }

    const { data: conversations } = await admin
      .from('conversations')
      .select('*')
      .in('id', ids)
      .order('created_at', { ascending: false });

    res.json({ items: conversations || [], meta: { status: 'ok' } });
  })
);

router.get(
  '/:id/messages',
  requireAuth,
  asyncHandler(async (req, res) => {
    const admin = getSupabaseAdmin();
    const { data: member } = await admin
      .from('conversation_members')
      .select('conversation_id')
      .eq('conversation_id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();
    if (!member) throw notFound('Conversation not found.');

    const { data, error } = await admin
      .from('messages')
      .select('*, profiles!messages_sender_id_fkey(username, display_name, avatar_url)')
      .eq('conversation_id', req.params.id)
      .order('created_at', { ascending: true });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ items: data || [], meta: { status: 'ok' } });
  })
);

router.post(
  '/:id/messages',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { body } = req.body || {};
    if (!body) throw new ValidationError('body is required.');
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('messages')
      .insert({
        conversation_id: req.params.id,
        sender_id: req.user.id,
        body: String(body),
      })
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ message: data, meta: { status: 'ok' } });
  })
);

export default router;
