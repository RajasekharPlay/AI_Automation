const router = require('express').Router();
const { supabase } = require('../lib/supabase');

// GET test cases for a run
router.get('/run/:runId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('test_cases')
      .select('*, artifacts(*)')
      .eq('run_id', req.params.runId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single test case
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('test_cases')
      .select('*, artifacts(*)')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH update test case (called by test runner)
router.patch('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('test_cases')
      .update({ ...req.body, updated_at: new Date() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Notify connected clients
    global.io?.to(data.run_id).emit('test-updated', data);

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
