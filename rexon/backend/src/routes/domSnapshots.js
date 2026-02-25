const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase');

// GET /api/dom-snapshots?project_id=xxx
router.get('/', async (req, res) => {
  try {
    const query = supabase.from('dom_snapshots')
      .select('id, project_id, domain, page_count, created_at')
      .order('created_at', { ascending: false });
    if (req.query.project_id) query.eq('project_id', req.query.project_id);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/dom-snapshots/:id — full snapshot with dom_map_json
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('dom_snapshots').select('*').eq('id', req.params.id).single();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/dom-snapshots — store a crawl result
router.post('/', async (req, res) => {
  try {
    const { project_id, domain, dom_map_json } = req.body;
    if (!domain || !dom_map_json) return res.status(400).json({ error: 'domain and dom_map_json required' });
    const pageCount = Object.keys(dom_map_json.pages || {}).length;
    const { data, error } = await supabase.from('dom_snapshots').insert({
      project_id, domain, dom_map_json, page_count: pageCount
    }).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/dom-snapshots/:id
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('dom_snapshots').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
