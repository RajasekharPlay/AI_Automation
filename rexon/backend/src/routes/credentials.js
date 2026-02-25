const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase');
const { encrypt, decrypt } = require('../lib/encryption');

// GET /api/credentials?project_id=xxx — list credentials (passwords masked)
router.get('/', async (req, res) => {
  try {
    const query = supabase.from('credentials').select(
      'id, project_id, name, base_url, otp_field, env_type, created_at, updated_at'
    ).order('created_at', { ascending: false });
    if (req.query.project_id) query.eq('project_id', req.query.project_id);
    const { data, error } = await query;
    if (error) throw error;
    // Mask: return username (decrypted), password always masked
    const masked = await Promise.all(data.map(async row => {
      const full = await supabase.from('credentials')
        .select('username_enc').eq('id', row.id).single();
      return {
        ...row,
        username: full.data?.username_enc ? decrypt(full.data.username_enc) : null,
        password: '••••••••'
      };
    }));
    res.json(masked);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/credentials/:id/raw — return decrypted (for runtime use only, not UI)
router.get('/:id/raw', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('credentials').select('*').eq('id', req.params.id).single();
    if (error) throw error;
    res.json({
      ...data,
      username: decrypt(data.username_enc),
      password: decrypt(data.password_enc)
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/credentials — create
router.post('/', async (req, res) => {
  try {
    const { project_id, name, base_url, username, password, otp_field, env_type } = req.body;
    if (!name || !base_url) return res.status(400).json({ error: 'name and base_url required' });
    const { data, error } = await supabase.from('credentials').insert({
      project_id,
      name,
      base_url,
      username_enc: encrypt(username),
      password_enc: encrypt(password),
      otp_field,
      env_type: env_type || 'dev'
    }).select('id, project_id, name, base_url, otp_field, env_type, created_at').single();
    if (error) throw error;
    res.json({ ...data, username, password: '••••••••' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/credentials/:id
router.patch('/:id', async (req, res) => {
  try {
    const { name, base_url, username, password, otp_field, env_type } = req.body;
    const updates = { updated_at: new Date() };
    if (name) updates.name = name;
    if (base_url) updates.base_url = base_url;
    if (username) updates.username_enc = encrypt(username);
    if (password) updates.password_enc = encrypt(password);
    if (otp_field !== undefined) updates.otp_field = otp_field;
    if (env_type) updates.env_type = env_type;
    const { data, error } = await supabase.from('credentials')
      .update(updates).eq('id', req.params.id)
      .select('id, project_id, name, base_url, otp_field, env_type, created_at').single();
    if (error) throw error;
    res.json({ ...data, password: '••••••••' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/credentials/:id
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('credentials').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
