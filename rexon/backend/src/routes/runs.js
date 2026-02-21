const router = require('express').Router();
const { supabase } = require('../lib/supabase');
const { generateScript } = require('../lib/claude');
const { triggerGithubAction } = require('../lib/github');

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

// POST create new run — upload test cases + generate scripts
router.post('/', async (req, res) => {
  const { name, testCases } = req.body;

  if (!name || !testCases || !Array.isArray(testCases) || testCases.length === 0) {
    return res.status(400).json({ error: 'name and testCases array required' });
  }

  try {
    // 1. Create test run
    const { data: run, error: runError } = await supabase
      .from('test_runs')
      .insert({ name, total: testCases.length, status: 'generating' })
      .select()
      .single();

    if (runError) throw runError;

    // Emit to UI immediately
    global.io?.emit('run-created', run);

    // 2. Generate scripts for each test case (in parallel)
    const scriptPromises = testCases.map(async (tc) => {
      try {
        console.log(`Generating script for: ${tc.name}`);
        const script = await generateScript(tc);
        return { ...tc, script, status: 'pending' };
      } catch (err) {
        console.error(`Script generation failed for ${tc.name}:`, err.message);
        return { ...tc, script: null, status: 'failed', error: `Script generation failed: ${err.message}` };
      }
    });

    const generatedCases = await Promise.all(scriptPromises);

    // 3. Save test cases to DB
    const { data: savedCases, error: casesError } = await supabase
      .from('test_cases')
      .insert(
        generatedCases.map((tc) => ({
          run_id: run.id,
          name: tc.name,
          script: tc.script,
          original_script: tc.script,
          status: tc.status,
          error: tc.error || null
        }))
      )
      .select();

    if (casesError) throw casesError;

    // 4. Update run status to 'running'
    await supabase
      .from('test_runs')
      .update({ status: 'running' })
      .eq('id', run.id);

    // 5. Trigger GitHub Actions
    await triggerGithubAction(run.id);

    global.io?.to(run.id).emit('run-started', { runId: run.id });

    res.json({ runId: run.id, testCases: savedCases });
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
