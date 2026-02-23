/**
 * REXON — Pet Tabs Rebuild Test
 * Correct flow: login → menu → pet zone → ver seguro → verify 3 tabs
 * (Tabs are on PetInfoPageProccess, NOT after Cotizar form)
 *
 * Usage:
 *   HEADLESS=false node rebuild-pet-test.js   (visible browser)
 *   node rebuild-pet-test.js                  (headless, for CI)
 */
require('dotenv').config();
const { chromium, devices } = require('@playwright/test');
const { supabase } = require('./lib/supabase');
const { uploadToR2 } = require('./lib/r2');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ── Verified runTest script (stored in SCRIPTS tab) ───────────────────────────
const PET_TABS_SCRIPT = `async function runTest(page, testData) {
  function jsClick(loc) {
    return loc.evaluate(function(el) {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  }

  // 1. Navigate — auto-redirects to WS-Fed login
  await page.goto('https://skye1.dev.segurosb.innoveo-skye.net/page/banorteprivate/es/MX/index',
    { waitUntil: 'domcontentloaded', timeout: 60000 });

  // 2. Login
  await page.waitForSelector('input[name="username"]', { state: 'visible', timeout: 30000 });
  await page.locator('input[name="username"]').fill('rajasekhar.udumula+Ap1@innoveo.com');
  await page.locator('input[name="password"]').fill('Test@1234');
  await jsClick(page.locator('button.sk-button').first());
  await page.waitForTimeout(4000);
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(function() {});

  // 3. Open nav menu
  await page.waitForSelector('a.sk-nav-menu', { state: 'visible', timeout: 20000 });
  await jsClick(page.locator('a.sk-nav-menu'));
  await page.waitForTimeout(1000);

  // 4. Click Pet zone icon
  var petSel = 'div[class="sk-nav-content "] li[id="sk-zone-Pet"] i[role="img"]';
  await page.waitForSelector(petSel, { state: 'visible', timeout: 15000 });
  await jsClick(page.locator(petSel));
  await page.waitForTimeout(2000);
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(function() {});

  // 5. Click Ver seguro — opens PetInfoPageProccess with 3 tabs
  await page.waitForSelector('text=Ver seguro', { state: 'visible', timeout: 20000 });
  await jsClick(page.locator('text=Ver seguro').first());
  await page.waitForTimeout(3000);
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(function() {});

  // 6. Verify 3 coverage tabs are visible on PetInfoPageProccess
  await page.waitForSelector('li.sk-tab:has-text("Coberturas base")', { state: 'visible', timeout: 20000 });
  await page.waitForSelector('li.sk-tab:has-text("Servicios")', { state: 'visible', timeout: 10000 });
  await page.waitForSelector('li.sk-tab:has-text("Exclusiones")', { state: 'visible', timeout: 10000 });

  return { passed: true };
}`;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function jsClick(locator) {
  await locator.evaluate(function(el) {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

async function appendLog(tcId, entry) {
  try {
    const { data } = await supabase
      .from('test_cases').select('execution_log').eq('id', tcId).single();
    const log = Array.isArray(data?.execution_log) ? data.execution_log : [];
    log.push({ ...entry, timestamp: new Date().toISOString() });
    await supabase.from('test_cases').update({ execution_log: log }).eq('id', tcId);
  } catch (_) { /* column may not exist if migration not yet run */ }
}

async function step(label, tcId, event, fn) {
  console.log(`  ${label}`);
  await appendLog(tcId, { event });
  return fn();
}

async function takeScreenshot(page, runId, tcId, type, label) {
  try {
    const buf = await page.screenshot({ fullPage: true });
    const url = await uploadToR2(buf, `${runId}/${tcId}/${type}.png`, 'image/png');
    await supabase.from('artifacts').insert({
      test_case_id: tcId, run_id: runId, type, url
    });
    console.log(`     📸 ${label}: ${url}`);
    return url;
  } catch (e) {
    console.warn(`     ⚠  Screenshot '${label}' failed:`, e.message);
    return null;
  }
}

async function saveTrace(context, runId, tcId) {
  try {
    const traceDir = path.join(os.tmpdir(), 'rexon-traces', tcId);
    fs.mkdirSync(traceDir, { recursive: true });
    const tracePath = path.join(traceDir, 'trace.zip');
    await context.tracing.stop({ path: tracePath });
    const buf = fs.readFileSync(tracePath);
    const url = await uploadToR2(buf, `${runId}/${tcId}/trace.zip`, 'application/zip');
    await supabase.from('artifacts').insert({
      test_case_id: tcId, run_id: runId, type: 'trace', url
    });
    console.log('     🔍 Trace →', url);
    await appendLog(tcId, { event: 'trace_captured', url });
  } catch (e) {
    console.error('     Trace error:', e.message);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🚀 REXON Pet Tabs — iPhone 12\n');

  const { data: run, error: runErr } = await supabase
    .from('test_runs')
    .insert({ name: 'pet-tabs-' + new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-'), total: 1, status: 'running' })
    .select().single();
  if (runErr) throw runErr;
  console.log('  Run ID:', run.id);
  console.log('  View at: http://localhost:5173/run/' + run.id + '\n');

  const { data: tc, error: tcErr } = await supabase
    .from('test_cases')
    .insert({
      run_id: run.id,
      name: 'Verify 3 tabs are visible on Pet Landing Page',
      script: PET_TABS_SCRIPT,
      original_script: PET_TABS_SCRIPT,
      status: 'running'
    })
    .select().single();
  if (tcErr) throw tcErr;

  // Update .env RUN_ID
  try {
    const envPath = path.join(__dirname, '.env');
    let env = fs.readFileSync(envPath, 'utf8');
    env = env.replace(/^RUN_ID=.*/m, `RUN_ID=${run.id}`);
    fs.writeFileSync(envPath, env);
  } catch (_) {}

  const headless = process.env.HEADLESS !== 'false';
  const slowMo = headless ? 0 : 300;
  console.log(`  Mode: ${headless ? 'headless' : 'headed (browser visible)'} | device: iPhone 12\n`);

  await appendLog(tc.id, { event: 'execution_started', device: 'iPhone 12', headless });

  const startTime = Date.now();
  const browser = await chromium.launch({ headless, slowMo });
  const context = await browser.newContext({ ...devices['iPhone 12'] });
  await context.tracing.start({ screenshots: true, snapshots: true });
  const page = await context.newPage();

  try {
    // ── 1. Navigate ───────────────────────────────────────────────
    await step('[1/6] Navigating to app...', tc.id, 'step_navigate', async () => {
      await page.goto(
        'https://skye1.dev.segurosb.innoveo-skye.net/page/banorteprivate/es/MX/index',
        { waitUntil: 'domcontentloaded', timeout: 60000 }
      );
    });

    // ── 2. Login ──────────────────────────────────────────────────
    await step('[2/6] Logging in...', tc.id, 'step_login', async () => {
      await page.waitForSelector('input[name="username"]', { state: 'visible', timeout: 30000 });
      await page.locator('input[name="username"]').fill('rajasekhar.udumula+Ap1@innoveo.com');
      await page.locator('input[name="password"]').fill('Test@1234');
      await jsClick(page.locator('button.sk-button').first());
      await page.waitForTimeout(4000);
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    });
    console.log('     URL:', page.url());
    await takeScreenshot(page, run.id, tc.id, 'screenshot_login', 'After login');
    await appendLog(tc.id, { event: 'step_logged_in', url: page.url() });

    // ── 3. Open nav menu + Pet zone ───────────────────────────────
    await step('[3/6] Opening nav menu...', tc.id, 'step_menu', async () => {
      await page.waitForSelector('a.sk-nav-menu', { state: 'visible', timeout: 20000 });
      await jsClick(page.locator('a.sk-nav-menu'));
      await page.waitForTimeout(1000);
    });

    // ── 4. Click Pet zone ─────────────────────────────────────────
    await step('[4/6] Clicking Pet zone...', tc.id, 'step_pet_zone', async () => {
      const petSel = 'div[class="sk-nav-content "] li[id="sk-zone-Pet"] i[role="img"]';
      await page.waitForSelector(petSel, { state: 'visible', timeout: 15000 });
      await jsClick(page.locator(petSel));
      await page.waitForTimeout(2000);
      await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    });
    console.log('     URL:', page.url());
    await takeScreenshot(page, run.id, tc.id, 'screenshot_pet_zone', 'Pet zone');
    await appendLog(tc.id, { event: 'step_pet_zone_done', url: page.url() });

    // ── 5. Click Ver seguro → PetInfoPageProccess ─────────────────
    await step('[5/6] Clicking Ver seguro...', tc.id, 'step_ver_seguro', async () => {
      await page.waitForSelector('text=Ver seguro', { state: 'visible', timeout: 20000 });
      await jsClick(page.locator('text=Ver seguro').first());
      await page.waitForTimeout(3000);
      await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    });
    console.log('     URL:', page.url());
    await takeScreenshot(page, run.id, tc.id, 'screenshot_ver_seguro', 'PetInfoPageProccess');
    await appendLog(tc.id, { event: 'step_ver_seguro_done', url: page.url() });

    // ── 6. Verify 3 coverage tabs ─────────────────────────────────
    await step('[6/6] Verifying 3 coverage tabs...', tc.id, 'step_verify_tabs', async () => {
      await page.waitForSelector('li.sk-tab:has-text("Coberturas base")', { state: 'visible', timeout: 20000 });
      await page.waitForSelector('li.sk-tab:has-text("Servicios")', { state: 'visible', timeout: 10000 });
      await page.waitForSelector('li.sk-tab:has-text("Exclusiones")', { state: 'visible', timeout: 10000 });

      // Confirm all 3 are truly visible
      const coberturas = await page.locator('li.sk-tab:has-text("Coberturas base")').isVisible();
      const servicios  = await page.locator('li.sk-tab:has-text("Servicios")').isVisible();
      const exclusiones = await page.locator('li.sk-tab:has-text("Exclusiones")').isVisible();
      console.log('     Coberturas base:', coberturas);
      console.log('     Servicios Opcionales:', servicios);
      console.log('     Exclusiones:', exclusiones);
      if (!coberturas || !servicios || !exclusiones) {
        throw new Error('One or more tabs not visible: coberturas=' + coberturas + ' servicios=' + servicios + ' exclusiones=' + exclusiones);
      }
    });
    await appendLog(tc.id, { event: 'step_tabs_verified' });

    // Final success screenshot
    await takeScreenshot(page, run.id, tc.id, 'screenshot', 'PASSED — 3 tabs visible');
    await saveTrace(context, run.id, tc.id);

    const duration = Date.now() - startTime;
    await appendLog(tc.id, { event: 'execution_completed', status: 'passed', durationMs: duration });

    await supabase.from('test_cases')
      .update({ status: 'passed', duration_ms: duration, updated_at: new Date() })
      .eq('id', tc.id);
    await supabase.from('test_runs')
      .update({ status: 'completed', passed: 1, failed: 0, healed: 0, completed_at: new Date() })
      .eq('id', run.id);

    console.log('\n✅ PASSED — All 3 tabs visible! (' + (duration / 1000).toFixed(1) + 's)');
    console.log('   REXON: http://localhost:5173/run/' + run.id + '\n');
    await browser.close();
    process.exit(0);

  } catch (err) {
    console.log('\n❌ FAILED:', err.message);
    const duration = Date.now() - startTime;
    await appendLog(tc.id, { event: 'execution_failed', error: err.message, durationMs: duration });

    await takeScreenshot(page, run.id, tc.id, 'screenshot', 'FAILED');
    await saveTrace(context, run.id, tc.id);

    await supabase.from('test_cases')
      .update({ status: 'failed', error: err.message, duration_ms: duration, updated_at: new Date() })
      .eq('id', tc.id);
    await supabase.from('test_runs')
      .update({ status: 'completed', passed: 0, failed: 1, completed_at: new Date() })
      .eq('id', run.id);

    console.log('   REXON: http://localhost:5173/run/' + run.id + '\n');
    await browser.close();
    process.exit(1);
  }
}

main().catch(function(err) { console.error('Fatal:', err); process.exit(1); });
