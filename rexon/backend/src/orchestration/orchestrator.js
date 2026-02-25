const { supabase } = require('../lib/supabase');
const { buildScript } = require('../agents/scriptBuilder');
const { triggerGithubAction } = require('../lib/github');
const { decrypt } = require('../lib/encryption');

/**
 * Run state machine phases:
 *   creating → generating → pending → triggering → running → completed | failed
 */

async function setRunPhase(runId, phase) {
  await supabase.from('test_runs').update({ run_phase: phase }).eq('id', runId);
}

/**
 * Orchestrates a full test run:
 * 1. Create the run record
 * 2. Insert placeholder test_case rows (so we have IDs for ai_actions logging)
 * 3. Generate scripts in parallel (logged to ai_actions per test case)
 * 4. Trigger GitHub Actions runner
 */
/**
 * Resolve credentials from DB if credential_id is provided.
 * Returns { base_url, username, password } or null.
 */
async function resolveCredentials(credentialId) {
  if (!credentialId) return null;
  try {
    const { data } = await supabase.from('credentials').select('*').eq('id', credentialId).single();
    if (!data) return null;
    return {
      base_url: data.base_url,
      username: decrypt(data.username_enc),
      password: decrypt(data.password_enc),
      otp_field: data.otp_field,
      env_type: data.env_type
    };
  } catch (_) { return null; }
}

async function startRun({ name, testCases, credentialId, projectId, domSnapshotId }) {
  // Resolve credentials if provided
  const credentials = await resolveCredentials(credentialId);

  // Fetch DOM map if snapshot id provided
  let domMap = null;
  if (domSnapshotId) {
    const { data: snap } = await supabase.from('dom_snapshots').select('dom_map_json').eq('id', domSnapshotId).single();
    domMap = snap?.dom_map_json || null;
  }

  // ── Phase: creating ────────────────────────────────────────────────────
  const { data: run, error: runError } = await supabase
    .from('test_runs')
    .insert({
      name,
      total: testCases.length,
      status: 'generating',
      run_phase: 'creating',
      credential_id: credentialId || null,
      project_id: projectId || null
    })
    .select()
    .single();

  if (runError) throw runError;
  global.io?.emit('run-created', run);

  // ── Phase: generating ─────────────────────────────────────────────────
  await setRunPhase(run.id, 'generating');

  const generatedCases = await Promise.all(
    testCases.map(async (tc) => {
      // Insert placeholder so the row exists and we can log ai_actions
      const { data: placeholder, error: insertErr } = await supabase
        .from('test_cases')
        .insert({
          run_id: run.id,
          name: tc.name,
          status: 'pending',       // 'generating' violates CHECK constraint — use 'pending'
          run_phase: 'generating', // run_phase is unconstrained text, freely used for phase tracking
          test_plan_json: tc,
          ai_actions: [],
          execution_log: []
        })
        .select()
        .single();

      if (insertErr) {
        console.error(`Failed to insert placeholder for ${tc.name}:`, insertErr.message);
        return { name: tc.name, status: 'failed', error: insertErr.message };
      }

      try {
        const script = await buildScript(tc, placeholder.id, { credentials, domMap });

        await supabase
          .from('test_cases')
          .update({
            script,
            original_script: script,
            status: 'pending',
            run_phase: 'pending'
          })
          .eq('id', placeholder.id);

        return { ...placeholder, script, status: 'pending' };
      } catch (err) {
        console.error(`Script generation failed for ${tc.name}:`, err.message);
        await supabase
          .from('test_cases')
          .update({
            status: 'failed',
            run_phase: 'failed',
            error: `Script generation failed: ${err.message}`
          })
          .eq('id', placeholder.id);

        return { ...placeholder, status: 'failed', error: err.message };
      }
    })
  );

  // ── Guard: abort if no test cases were successfully created ───────────
  const successfulCases = generatedCases.filter(tc => tc.id && tc.status !== 'failed');
  if (successfulCases.length === 0) {
    const firstErr = generatedCases.find(tc => tc.error)?.error || 'All test cases failed to generate';
    console.error('No test cases created — aborting GitHub Actions trigger. Reason:', firstErr);
    await setRunPhase(run.id, 'failed');
    await supabase.from('test_runs').update({ status: 'failed' }).eq('id', run.id);
    throw new Error(`Run aborted: ${firstErr}`);
  }

  // ── Phase: triggering ─────────────────────────────────────────────────
  await setRunPhase(run.id, 'triggering');
  await supabase.from('test_runs').update({ status: 'running' }).eq('id', run.id);
  await triggerGithubAction(run.id);

  global.io?.to(run.id).emit('run-started', { runId: run.id });

  return { runId: run.id, testCases: generatedCases };
}

module.exports = { startRun };
