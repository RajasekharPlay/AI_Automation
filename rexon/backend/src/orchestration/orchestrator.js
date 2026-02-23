const { supabase } = require('../lib/supabase');
const { buildScript } = require('../agents/scriptBuilder');
const { triggerGithubAction } = require('../lib/github');

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
async function startRun({ name, testCases }) {
  // ── Phase: creating ────────────────────────────────────────────────────
  const { data: run, error: runError } = await supabase
    .from('test_runs')
    .insert({
      name,
      total: testCases.length,
      status: 'generating',
      run_phase: 'creating'
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
          status: 'generating',
          run_phase: 'generating',
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
        const script = await buildScript(tc, placeholder.id);

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

  // ── Phase: triggering ─────────────────────────────────────────────────
  await setRunPhase(run.id, 'triggering');
  await supabase.from('test_runs').update({ status: 'running' }).eq('id', run.id);
  await triggerGithubAction(run.id);

  global.io?.to(run.id).emit('run-started', { runId: run.id });

  return { runId: run.id, testCases: generatedCases };
}

module.exports = { startRun };
