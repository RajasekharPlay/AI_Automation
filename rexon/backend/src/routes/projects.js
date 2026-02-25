const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase');

// GET /api/projects — list all projects
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('projects').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/projects/:id — get single project with stats
router.get('/:id', async (req, res) => {
  try {
    const { data: project, error } = await supabase
      .from('projects').select('*').eq('id', req.params.id).single();
    if (error) throw error;

    const { count: testcaseCount } = await supabase
      .from('testcases').select('*', { count: 'exact', head: true }).eq('project_id', req.params.id);
    const { count: runCount } = await supabase
      .from('test_runs').select('*', { count: 'exact', head: true }).eq('project_id', req.params.id);

    res.json({ ...project, testcase_count: testcaseCount, run_count: runCount });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/projects — create project
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const { data, error } = await supabase
      .from('projects').insert({ name, description }).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/projects/:id
router.patch('/:id', async (req, res) => {
  try {
    const { name, description } = req.body;
    const { data, error } = await supabase
      .from('projects').update({ name, description, updated_at: new Date() })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/projects/:id
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('projects').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
