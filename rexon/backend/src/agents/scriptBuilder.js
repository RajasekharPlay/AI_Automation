const { supabase } = require('../lib/supabase');
const { generateScript } = require('../lib/claude');

/**
 * Appends a single ai_action entry to a test_case row.
 * Safe to call with null testCaseId (no-op).
 */
async function appendAiAction(testCaseId, action) {
  if (!testCaseId) return;
  try {
    const { data } = await supabase
      .from('test_cases')
      .select('ai_actions')
      .eq('id', testCaseId)
      .single();

    const actions = Array.isArray(data?.ai_actions) ? data.ai_actions : [];
    actions.push({ ...action, timestamp: action.timestamp || new Date().toISOString() });

    await supabase
      .from('test_cases')
      .update({ ai_actions: actions })
      .eq('id', testCaseId);
  } catch (err) {
    console.warn('appendAiAction error (non-fatal):', err.message);
  }
}

/**
 * Generate a Playwright script for a test case, logging progress
 * as ai_actions on the test_case row so the frontend can show a timeline.
 */
async function buildScript(testCase, testCaseId) {
  await appendAiAction(testCaseId, {
    action: 'script_generation',
    status: 'started',
    input: {
      testCaseName: testCase.name,
      stepCount: testCase.steps?.length || 0,
      url: testCase.url || null
    }
  });

  try {
    const script = await generateScript(testCase);

    await appendAiAction(testCaseId, {
      action: 'script_generation',
      status: 'completed',
      output: { scriptLength: script.length }
    });

    return script;
  } catch (err) {
    await appendAiAction(testCaseId, {
      action: 'script_generation',
      status: 'failed',
      error: err.message
    });
    throw err;
  }
}

module.exports = { buildScript, appendAiAction };
