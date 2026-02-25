const router = require('express').Router();
const { supabase } = require('../lib/supabase');
const { startRun } = require('../orchestration/orchestrator');

// GET all runs
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('test_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single run with test cases
router.get('/:id', async (req, res) => {
  try {
    const { data: run, error: runError } = await supabase
      .from('test_runs')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (runError) throw runError;

    const { data: testCases, error: tcError } = await supabase
      .from('test_cases')
      .select('*, artifacts(*)')
      .eq('run_id', req.params.id)
      .order('created_at', { ascending: true });

    if (tcError) throw tcError;

    res.json({ ...run, testCases });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create new run — orchestrates script generation + runner trigger
router.post('/', async (req, res) => {
  const { name, testCases, credentialId, projectId, domSnapshotId } = req.body;

  if (!name || !testCases || !Array.isArray(testCases) || testCases.length === 0) {
    return res.status(400).json({ error: 'name and testCases array required' });
  }

  try {
    const result = await startRun({ name, testCases, credentialId, projectId, domSnapshotId });
    res.json(result);
  } catch (err) {
    console.error('Create run error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE run
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('test_runs')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
