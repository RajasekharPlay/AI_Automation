require('dotenv').config();
const { chromium } = require('@playwright/test');
const { supabase } = require('./lib/supabase');
const { uploadToR2 } = require('./lib/r2');
const { healSelector } = require('./lib/claude');
const fs = require('fs');
const path = require('path');

const RUN_ID = process.env.RUN_ID;

if (!RUN_ID) {
  console.error('❌ RUN_ID environment variable is required');
  process.exit(1);
}

async function main() {
  console.log(`\n🚀 REXON Test Runner starting for run: ${RUN_ID}\n`);

  // Fetch all test cases for this run
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
    process.exit(1);
  }

  console.log(`📋 Found ${testCases.length} test cases\n`);

  let passed = 0;
  let failed = 0;
  let healed = 0;

  // Run tests sequentially
  for (const tc of testCases) {
    console.log(`\n▶ Running: ${tc.name}`);
    const result = await executeTest(tc);

    if (result.status === 'passed') passed++;
    else if (result.status === 'healed') { passed++; healed++; }
    else failed++;
  }

  // Update run as completed
  await supabase
    .from('test_runs')
    .update({
      status: 'completed',
      passed,
      failed,
      healed,
      completed_at: new Date()
    })
    .eq('id', RUN_ID);

  console.log(`\n✅ Run complete — Passed: ${passed} | Failed: ${failed} | Healed: ${healed}`);
  process.exit(failed > 0 ? 1 : 0);
}

async function executeTest(tc, isRetry = false) {
  const startTime = Date.now();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  // Start tracing
  await context.tracing.start({ screenshots: true, snapshots: true });
  const page = await context.newPage();

  // Update status to running
  await supabase
    .from('test_cases')
    .update({ status: 'running', updated_at: new Date() })
    .eq('id', tc.id);

  try {
    // Execute the generated script dynamically
    const scriptFn = new Function(
      'page', 'require', 'console',
      `return (async () => { ${tc.script} \n return runTest(page); })()`
    );
    await scriptFn(page, require, console);

    const duration = Date.now() - startTime;
    const status = isRetry ? 'healed' : 'passed';

    await supabase
      .from('test_cases')
      .update({ status, duration_ms: duration, updated_at: new Date() })
      .eq('id', tc.id);

    console.log(`  ${isRetry ? '🔧 HEALED' : '✅ PASSED'} — ${tc.name} (${duration}ms)`);
    await browser.close();
    return { status };

  } catch (error) {
    console.log(`  ❌ FAILED — ${tc.name}`);
    console.log(`     Error: ${error.message}`);

    const duration = Date.now() - startTime;

    // Capture screenshot
    let screenshotUrl = null;
    try {
      const screenshot = await page.screenshot({ fullPage: true });
      screenshotUrl = await uploadToR2(
        screenshot,
        `${RUN_ID}/${tc.id}/screenshot.png`,
        'image/png'
      );
      console.log(`  📸 Screenshot saved`);

      await supabase.from('artifacts').insert({
        test_case_id: tc.id,
        run_id: RUN_ID,
        type: 'screenshot',
        url: screenshotUrl
      });
    } catch (screenshotErr) {
      console.error('  Screenshot failed:', screenshotErr.message);
    }

    // Capture trace
    try {
      const traceDir = `/tmp/traces/${tc.id}`;
      fs.mkdirSync(traceDir, { recursive: true });
      const tracePath = path.join(traceDir, 'trace.zip');
      await context.tracing.stop({ path: tracePath });

      const traceBuffer = fs.readFileSync(tracePath);
      const traceUrl = await uploadToR2(
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
      console.log(`  🔍 Trace saved`);
    } catch (traceErr) {
      console.error('  Trace capture failed:', traceErr.message);
    }

    // If first attempt, try Claude healing
    if (!isRetry) {
      console.log(`  🤖 Attempting Claude self-healing...`);

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

          // Save patched script
          await supabase
            .from('test_cases')
            .update({
              script: heal.patchedScript,
              heal_reason: heal.reason,
              updated_at: new Date()
            })
            .eq('id', tc.id);

          await browser.close();

          // Retry with healed script
          return executeTest({ ...tc, script: heal.patchedScript }, true);
        } else {
          console.log(`  ⚠️  Healing agent could not find a fix`);
        }
      } catch (healErr) {
        console.error('  Healing failed:', healErr.message);
      }
    }

    // Mark as failed
    await supabase
      .from('test_cases')
      .update({
        status: 'failed',
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
