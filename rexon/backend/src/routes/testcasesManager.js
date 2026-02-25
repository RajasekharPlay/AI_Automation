/**
 * Persistent testcases (separate from test_cases run rows).
 * These are the "stored" test definitions that can be re-run.
 */
const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase');
const { triggerGithubAction } = require('../lib/github');
const { buildScript } = require('../agents/scriptBuilder');
const { decrypt } = require('../lib/encryption');

// GET /api/testcases-manager?project_id=xxx — list with last run info
router.get('/', async (req, res) => {
  try {
    const query = supabase.from('testcases')
      .select(`*, credentials(name, base_url, env_type), dom_snapshots(domain, page_count)`)
      .order('updated_at', { ascending: false });
    if (req.query.project_id) query.eq('project_id', req.query.project_id);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/testcases-manager/:id
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('testcases')
      .select(`*, credentials(id, name, base_url, env_type), dom_snapshots(id, domain, page_count, dom_map_json)`)
      .eq('id', req.params.id).single();
    if (error) throw error;

    // Attach run history
    const { data: runs } = await supabase.from('test_runs')
      .select('id, name, status, passed, failed, created_at')
      .eq('testcase_id', req.params.id)
      .order('created_at', { ascending: false })
      .limit(10);

    res.json({ ...data, run_history: runs || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/testcases-manager — create stored testcase
router.post('/', async (req, res) => {
  try {
    const { project_id, name, description, test_plan_json, dom_snapshot_id, credential_id } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const { data, error } = await supabase.from('testcases').insert({
      project_id, name, description, test_plan_json, dom_snapshot_id, credential_id
    }).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/testcases-manager/:id — update test plan
router.patch('/:id', async (req, res) => {
  try {
    const { name, description, test_plan_json, dom_snapshot_id, credential_id } = req.body;
    const updates = { updated_at: new Date() };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (test_plan_json !== undefined) updates.test_plan_json = test_plan_json;
    if (dom_snapshot_id !== undefined) updates.dom_snapshot_id = dom_snapshot_id;
    if (credential_id !== undefined) updates.credential_id = credential_id;
    const { data, error } = await supabase.from('testcases')
      .update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/testcases-manager/:id/rerun — trigger a new run for stored testcase
router.post('/:id/rerun', async (req, res) => {
  try {
    const { data: tc, error: tcErr } = await supabase.from('testcases')
      .select('*, credentials(id, name, base_url, username_enc, password_enc, env_type)')
      .eq('id', req.params.id).single();
    if (tcErr) throw tcErr;

    // Resolve credentials for script generation
    const cred = tc.credentials;
    const credentials = cred ? {
      base_url: cred.base_url,
      username: decrypt(cred.username_enc),
      password: decrypt(cred.password_enc),
      otp_field: cred.otp_field,
      env_type: cred.env_type
    } : null;

    // Create a run record linked to this testcase
    const { data: run, error: runErr } = await supabase.from('test_runs').insert({
      name: `Rerun — ${tc.name} — ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
      status: 'generating',
      run_phase: 'generating',
      total: 1,
      testcase_id: tc.id,
      credential_id: tc.credential_id,
      project_id: tc.project_id
    }).select().single();
    if (runErr) throw runErr;

    // Insert placeholder test_cases row (status: 'pending' — must satisfy CHECK constraint)
    const { data: placeholder, error: insertErr } = await supabase.from('test_cases').insert({
      run_id: run.id,
      name: tc.name,
      status: 'pending',
      run_phase: 'generating',
      test_plan_json: tc.test_plan_json,
      ai_actions: [],
      execution_log: []
    }).select().single();
    if (insertErr) throw insertErr;

    // Generate Playwright script via Claude before triggering runner
    let script;
    try {
      script = await buildScript(tc.test_plan_json || { name: tc.name }, placeholder.id, { credentials });
      await supabase.from('test_cases').update({
        script,
        original_script: script,
        status: 'pending',
        run_phase: 'pending'
      }).eq('id', placeholder.id);
    } catch (scriptErr) {
      console.error('Script generation failed for rerun:', scriptErr.message);
      await supabase.from('test_cases').update({
        status: 'failed',
        run_phase: 'failed',
        error: `Script generation failed: ${scriptErr.message}`
      }).eq('id', placeholder.id);
      await supabase.from('test_runs').update({ status: 'failed', run_phase: 'failed' }).eq('id', run.id);
      throw new Error(`Script generation failed: ${scriptErr.message}`);
    }

    // Update testcase last run info
    await supabase.from('testcases').update({
      last_run_at: new Date(),
      run_count: (tc.run_count || 0) + 1,
      status: 'running',
      updated_at: new Date()
    }).eq('id', tc.id);

    // Trigger GitHub Actions now that script is ready
    await supabase.from('test_runs').update({ status: 'running', run_phase: 'triggering' }).eq('id', run.id);
    await triggerGithubAction(run.id).catch(e => console.error('GH trigger failed:', e.message));

    if (global.io) global.io.emit('run-created', { runId: run.id });

    res.json({ runId: run.id, status: 'triggered' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/testcases-manager/:id
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('testcases').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
