const { healSelector } = require('../lib/claude');
const { appendAiAction } = require('./scriptBuilder');

/**
 * Attempts to heal a failing test case using Claude.
 * Logs progress as ai_actions on the test_case row.
 * Returns the heal result ({ newSelector, reason, patchedScript }) or null.
 */
async function attemptHealing({ testCase, errorMessage, domSnapshot }) {
  await appendAiAction(testCase.id, {
    action: 'healing_attempt',
    status: 'started',
    input: { error: (errorMessage || '').substring(0, 300) }
  });

  try {
    const failedSelector = errorMessage?.match(/selector|locator|element/i)
      ? errorMessage
      : 'selector not found';

    const heal = await healSelector(failedSelector, domSnapshot, errorMessage, testCase.script);

    if (heal && heal.patchedScript) {
      await appendAiAction(testCase.id, {
        action: 'healing_attempt',
        status: 'completed',
        output: {
          newSelector: heal.newSelector || '(see patched script)',
          reason: heal.reason
        }
      });
      return heal;
    }

    await appendAiAction(testCase.id, {
      action: 'healing_attempt',
      status: 'no_fix_found'
    });
    return null;
  } catch (err) {
    await appendAiAction(testCase.id, {
      action: 'healing_attempt',
      status: 'failed',
      error: err.message
    });
    return null;
  }
}

module.exports = { attemptHealing };
