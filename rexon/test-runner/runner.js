require('dotenv').config();
const { chromium, devices } = require('@playwright/test');
const { supabase } = require('./lib/supabase');
const { uploadToR2 } = require('./lib/r2');
const { healSelector } = require('./lib/claude');
const fs = require('fs');
const path = require('path');
const os = require('os');

const RUN_ID = process.env.RUN_ID;

if (!RUN_ID) {
  console.error('❌ RUN_ID environment variable is required');
  process.exit(1);
}

// ── Execution log helpers ─────────────────────────────────────────────────────

async function appendExecutionLog(testCaseId, entry) {
  try {
    const { data } = await supabase
      .from('test_cases')
      .select('execution_log')
      .eq('id', testCaseId)
      .single();

    const log = Array.isArray(data?.execution_log) ? data.execution_log : [];
    log.push({ ...entry, timestamp: entry.timestamp || new Date().toISOString() });

    await supabase
      .from('test_cases')
      .update({ execution_log: log })
      .eq('id', testCaseId);
  } catch (err) {
    console.warn('appendExecutionLog error (non-fatal):', err.message);
  }
}

async function appendAiAction(testCaseId, action) {
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

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🚀 REXON Test Runner starting for run: ${RUN_ID}\n`);

  const { data: testCases, error } = await supabase
    .from('test_cases')
    .select('*')
    .eq('run_id', RUN_ID)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch test cases:', error.message);
    process.exit(1);
  }

  if (!testCases || testCases.length === 0) {
    console.error('No test cases found for run:', RUN_ID);
    await supabase.from('test_runs').update({
      status: 'failed',
      run_phase: 'failed',
      completed_at: new Date()
    }).eq('id', RUN_ID);
    process.exit(1);
  }

  console.log(`📋 Found ${testCases.length} test cases\n`);

  let passed = 0;
  let failed = 0;
  let healed = 0;

  for (const tc of testCases) {
    console.log(`\n▶ Running: ${tc.name}`);

    // Guard: skip test cases where script generation failed (no script stored)
    if (!tc.script) {
      console.log(`  ⚠ SKIPPED — no script for "${tc.name}" (generation may have failed)`);
      await supabase.from('test_cases').update({
        status: 'failed',
        run_phase: 'failed',
        error: 'Script is null — generation failed before runner started',
        duration_ms: 0,
        updated_at: new Date()
      }).eq('id', tc.id);
      failed++;
      continue;
    }

    const result = await executeTest(tc);

    if (result.status === 'passed') passed++;
    else if (result.status === 'healed') { passed++; healed++; }
    else failed++;
  }

  await supabase
    .from('test_runs')
    .update({
      status: 'completed',
      run_phase: 'completed',
      passed,
      failed,
      healed,
      completed_at: new Date()
    })
    .eq('id', RUN_ID);

  console.log(`\n✅ Run complete — Passed: ${passed} | Failed: ${failed} | Healed: ${healed}`);
  process.exit(failed > 0 ? 1 : 0);
}

// ── Execute a single test case ────────────────────────────────────────────────

async function executeTest(tc, isRetry = false) {
  const startTime = Date.now();
  const headless = process.env.HEADLESS !== 'false';
  const browser = await chromium.launch({ headless, slowMo: headless ? 0 : 300 });

  const deviceName = process.env.DEVICE;
  const deviceConfig = deviceName && devices[deviceName] ? devices[deviceName] : {};
  const context = await browser.newContext({ ...deviceConfig });

  await context.tracing.start({ screenshots: true, snapshots: true });
  const page = await context.newPage();

  // Mark as running
  await supabase
    .from('test_cases')
    .update({ status: 'running', run_phase: 'running', updated_at: new Date() })
    .eq('id', tc.id);

  await appendExecutionLog(tc.id, {
    event: 'execution_started',
    isRetry,
    device: deviceName || 'default',
    headless
  });

  // Extract testData from the stored test plan JSON
  const testData = tc.test_plan_json?.testData || tc.test_plan_json || {};

  try {
    // Execute the generated script dynamically
    const cleanScript = tc.script
      .replace(/^\s*module\.exports\s*=.*$/gm, '')   // strip module.exports
      .replace(/^\s*exports\.\w+\s*=.*$/gm, '')       // strip named exports
      .replace(/throw\s*\n\s*/g, 'throw ');            // fix illegal newline after throw

    // Use string concatenation (not template literal) so backticks inside
    // cleanScript don't break the outer template string
    const scriptFn = new Function(
      'page', 'testData', 'require', 'console',
      'return (async () => { ' + cleanScript + '\n return runTest(page, testData); })()'
    );

    await appendExecutionLog(tc.id, { event: 'script_executing' });
    await scriptFn(page, testData, require, console);

    const duration = Date.now() - startTime;
    const status = isRetry ? 'healed' : 'passed';

    await appendExecutionLog(tc.id, { event: 'execution_completed', status, durationMs: duration });

    // Always capture final screenshot on success (shows the passing state)
    try {
      const shot = await page.screenshot({ fullPage: true });
      const shotUrl = await uploadToR2(shot, `${RUN_ID}/${tc.id}/screenshot.png`, 'image/png');
      await supabase.from('artifacts').insert({
        test_case_id: tc.id, run_id: RUN_ID, type: 'screenshot', url: shotUrl
      });
      await appendExecutionLog(tc.id, { event: 'screenshot_captured', url: shotUrl });
      console.log(`  📸 Screenshot saved`);
    } catch (shotErr) {
      console.warn('  Screenshot error (non-fatal):', shotErr.message);
    }

    // Always save trace on success too
    try {
      const traceDir = path.join(os.tmpdir(), 'rexon-traces', tc.id);
      fs.mkdirSync(traceDir, { recursive: true });
      const tracePath = path.join(traceDir, 'trace.zip');
      await context.tracing.stop({ path: tracePath });
      const traceBuffer = fs.readFileSync(tracePath);
      const traceUrl = await uploadToR2(traceBuffer, `${RUN_ID}/${tc.id}/trace.zip`, 'application/zip');
      await supabase.from('artifacts').insert({
        test_case_id: tc.id, run_id: RUN_ID, type: 'trace', url: traceUrl
      });
      await appendExecutionLog(tc.id, { event: 'trace_captured', url: traceUrl });
      console.log(`  🔍 Trace saved`);
    } catch (traceErr) {
      console.warn('  Trace error (non-fatal):', traceErr.message);
    }

    await supabase
      .from('test_cases')
      .update({ status, run_phase: status, duration_ms: duration, updated_at: new Date() })
      .eq('id', tc.id);

    console.log(`  ${isRetry ? '🔧 HEALED' : '✅ PASSED'} — ${tc.name} (${duration}ms)`);
    await browser.close();
    return { status };

  } catch (error) {
    console.log(`  ❌ FAILED — ${tc.name}`);
    console.log(`     Error: ${error.message}`);

    const duration = Date.now() - startTime;

    await appendExecutionLog(tc.id, {
      event: 'execution_failed',
      error: error.message,
      durationMs: duration
    });

    // Capture screenshot
    let screenshotUrl = null;
    try {
      const screenshot = await page.screenshot({ fullPage: true });
      screenshotUrl = await uploadToR2(
        screenshot,
        `${RUN_ID}/${tc.id}/screenshot.png`,
        'image/png'
      );
      await supabase.from('artifacts').insert({
        test_case_id: tc.id,
        run_id: RUN_ID,
        type: 'screenshot',
        url: screenshotUrl
      });
      await appendExecutionLog(tc.id, { event: 'screenshot_captured', url: screenshotUrl });
      console.log(`  📸 Screenshot saved`);
    } catch (screenshotErr) {
      console.error('  Screenshot failed:', screenshotErr.message);
      await appendExecutionLog(tc.id, { event: 'screenshot_failed', error: screenshotErr.message });
    }

    // Capture trace
    let traceUrl = null;
    try {
      const traceDir = path.join(os.tmpdir(), 'rexon-traces', tc.id);
      fs.mkdirSync(traceDir, { recursive: true });
      const tracePath = path.join(traceDir, 'trace.zip');
      await context.tracing.stop({ path: tracePath });

      const traceBuffer = fs.readFileSync(tracePath);
      traceUrl = await uploadToR2(
        traceBuffer,
        `${RUN_ID}/${tc.id}/trace.zip`,
        'application/zip'
      );
      await supabase.from('artifacts').insert({
        test_case_id: tc.id,
        run_id: RUN_ID,
        type: 'trace',
        url: traceUrl
      });
      await appendExecutionLog(tc.id, { event: 'trace_captured', url: traceUrl });
      console.log(`  🔍 Trace saved`);
    } catch (traceErr) {
      console.error('  Trace capture failed:', traceErr.message);
      await appendExecutionLog(tc.id, { event: 'trace_failed', error: traceErr.message });
    }

    // Attempt Claude self-healing (first attempt only)
    if (!isRetry) {
      console.log(`  🤖 Attempting Claude self-healing...`);

      await appendAiAction(tc.id, {
        action: 'healing_attempt',
        status: 'started',
        input: { error: error.message.substring(0, 300) }
      });

      try {
        const dom = await page.content();
        const heal = await healSelector(
          error.message.match(/selector|locator|element/i) ? error.message : 'selector not found',
          dom,
          error.message,
          tc.script
        );

        if (heal && heal.patchedScript) {
          console.log(`  💡 Heal suggestion: ${heal.reason}`);

          await appendAiAction(tc.id, {
            action: 'healing_attempt',
            status: 'completed',
            output: { newSelector: heal.newSelector || '(see patched script)', reason: heal.reason }
          });

          await appendExecutionLog(tc.id, {
            event: 'healing_applied',
            reason: heal.reason,
            newSelector: heal.newSelector
          });

          await supabase
            .from('test_cases')
            .update({
              script: heal.patchedScript,
              heal_reason: heal.reason,
              updated_at: new Date()
            })
            .eq('id', tc.id);

          await browser.close();
          return executeTest({ ...tc, script: heal.patchedScript }, true);
        } else {
          console.log(`  ⚠️  Healing agent could not find a fix`);
          await appendAiAction(tc.id, { action: 'healing_attempt', status: 'no_fix_found' });
          await appendExecutionLog(tc.id, { event: 'healing_no_fix' });
        }
      } catch (healErr) {
        console.error('  Healing failed:', healErr.message);
        await appendAiAction(tc.id, { action: 'healing_attempt', status: 'failed', error: healErr.message });
        await appendExecutionLog(tc.id, { event: 'healing_error', error: healErr.message });
      }
    }

    // Mark as failed
    await supabase
      .from('test_cases')
      .update({
        status: 'failed',
        run_phase: 'failed',
        error: error.message,
        duration_ms: duration,
        updated_at: new Date()
      })
      .eq('id', tc.id);

    await browser.close();
    return { status: 'failed' };
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
