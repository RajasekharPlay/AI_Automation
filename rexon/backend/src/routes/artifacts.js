const router = require('express').Router();
const { supabase } = require('../lib/supabase');

// GET artifacts for a test case
router.get('/testcase/:testCaseId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('artifacts')
      .select('*')
      .eq('test_case_id', req.params.testCaseId);

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST save artifact record
router.post('/', async (req, res) => {
  try {
    const { test_case_id, run_id, type, url } = req.body;
    const { data, error } = await supabase
      .from('artifacts')
      .insert({ test_case_id, run_id, type, url })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
