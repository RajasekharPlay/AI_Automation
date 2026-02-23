require('dotenv').config();
const { chromium, devices } = require('@playwright/test');
const { supabase } = require('./lib/supabase');
const { uploadToR2 } = require('./lib/r2');
const fs = require('fs');
const path = require('path');
const os = require('os');

// JS click — works even outside viewport / overflow:hidden
async function jsClick(locator) {
  await locator.evaluate(function(el) {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

async function main() {
  console.log('\n🚀 Running Pet Tabs test (iPhone 12 headed)\n');

  // Create run in Supabase
  const { data: run, error: runErr } = await supabase
    .from('test_runs')
    .insert({ name: 'test12-pet-tabs-correct-nav', total: 1, status: 'running' })
    .select().single();
  if (runErr) throw runErr;
  console.log('Run ID:', run.id);

  // Create test case record
  const { data: tc, error: tcErr } = await supabase
    .from('test_cases')
    .insert({
      run_id: run.id,
      name: 'Verify 3 tabs are visible on Pet Landing Page',
      script: 'inline',
      original_script: 'inline',
      status: 'running'
    })
    .select().single();
  if (tcErr) throw tcErr;

  const startTime = Date.now();
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext({ ...devices['iPhone 12'] });
  await context.tracing.start({ screenshots: true, snapshots: true });
  const page = await context.newPage();

  try {
    // ── Step 1: Navigate (auto-redirects to login) ──────────────────────────
    console.log('  → Navigating to app...');
    await page.goto('https://skye1.dev.segurosb.innoveo-skye.net/page/banorteprivate/es/MX/index', {
      waitUntil: 'domcontentloaded', timeout: 60000
    });

    // ── Step 2: Wait for login form ─────────────────────────────────────────
    console.log('  → Waiting for login form...');
    await page.waitForSelector('input[name="username"]', { state: 'visible', timeout: 30000 });

    // ── Step 3: Fill credentials ─────────────────────────────────────────────
    console.log('  → Filling credentials...');
    await page.locator('input[name="username"]').fill('rajasekhar.udumula+Ap1@innoveo.com');
    await page.locator('input[name="password"]').fill('Test@1234');

    // ── Step 4: Click login ──────────────────────────────────────────────────
    console.log('  → Clicking login...');
    await jsClick(page.locator('button.sk-button').first());

    // ── Step 5: Wait for home page ───────────────────────────────────────────
    console.log('  → Waiting for home page...');
    await page.waitForTimeout(4000);
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    console.log('     URL after login:', page.url());

    // ── Step 6: Open nav menu — exact selector from working local tests ────────
    console.log('  → Opening nav menu (a.sk-nav-menu)...');
    await page.waitForSelector('a.sk-nav-menu', { state: 'visible', timeout: 20000 });
    await page.locator('a.sk-nav-menu').click();
    await page.waitForTimeout(1000);

    // ── Step 7: Click Pet zone icon — exact selector from working local tests ─
    console.log('  → Clicking Pet zone icon...');
    const petSelector = 'div[class="sk-nav-content "] li[id="sk-zone-Pet"] i[role="img"]';
    await page.waitForSelector(petSelector, { state: 'visible', timeout: 15000 });
    await page.locator(petSelector).click();
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    console.log('  → URL after Pet click:', page.url());

    // ── Step 8: Click Ver seguro ─────────────────────────────────────────────
    console.log('  → Clicking Ver seguro...');
    await page.waitForSelector('text=Ver seguro', { state: 'visible', timeout: 20000 });
    await page.locator('text=Ver seguro').first().click();
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    console.log('  → URL after Ver seguro:', page.url());

    // ── Step 9: Click Cotizar ────────────────────────────────────────────────
    console.log('  → Clicking Cotizar...');
    await page.waitForSelector('text=Cotizar', { state: 'visible', timeout: 20000 });
    await page.locator('text=Cotizar').first().click();
    // Wait longer for the quote process page to fully render
    await page.waitForTimeout(5000);
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    console.log('  → URL after Cotizar:', page.url());

    // Dump page text on the quote page
    const quoteText = await page.evaluate(function() {
      return document.body.innerText.substring(0, 2000);
    });
    console.log('  → Page text on quote page:\n', quoteText);

    // ── Step 10: Verify 3 tabs ───────────────────────────────────────────────
    console.log('  → Verifying tabs...');
    await page.waitForSelector('text=Coberturas base', { state: 'visible', timeout: 30000 });
    await page.waitForSelector('text=Servicios opcionales', { state: 'visible', timeout: 10000 });
    await page.waitForSelector('text=Exclusiones', { state: 'visible', timeout: 10000 });

    const duration = Date.now() - startTime;
    await supabase.from('test_cases').update({ status: 'passed', duration_ms: duration, updated_at: new Date() }).eq('id', tc.id);
    await supabase.from('test_runs').update({ status: 'completed', passed: 1, failed: 0, completed_at: new Date() }).eq('id', run.id);

    console.log('\n✅ PASSED — All 3 tabs visible! (' + duration + 'ms)\n');
    await browser.close();
    process.exit(0);

  } catch (err) {
    console.log('\n❌ FAILED:', err.message, '\n');
    const duration = Date.now() - startTime;

    // Screenshot
    try {
      const shot = await page.screenshot({ fullPage: true });
      const url = await uploadToR2(shot, run.id + '/' + tc.id + '/screenshot.png', 'image/png');
      await supabase.from('artifacts').insert({ test_case_id: tc.id, run_id: run.id, type: 'screenshot', url });
      console.log('  📸 Screenshot:', url);
    } catch (e) { console.error('  Screenshot error:', e.message); }

    // Trace
    try {
      const traceDir = path.join(os.tmpdir(), 'traces', tc.id);
      fs.mkdirSync(traceDir, { recursive: true });
      const tracePath = path.join(traceDir, 'trace.zip');
      await context.tracing.stop({ path: tracePath });
      const buf = fs.readFileSync(tracePath);
      const traceUrl = await uploadToR2(buf, run.id + '/' + tc.id + '/trace.zip', 'application/zip');
      await supabase.from('artifacts').insert({ test_case_id: tc.id, run_id: run.id, type: 'trace', url: traceUrl });
      console.log('  🔍 Trace saved');
    } catch (e) { console.error('  Trace error:', e.message); }

    await supabase.from('test_cases').update({ status: 'failed', error: err.message, duration_ms: duration, updated_at: new Date() }).eq('id', tc.id);
    await supabase.from('test_runs').update({ status: 'completed', passed: 0, failed: 1, completed_at: new Date() }).eq('id', run.id);

    await browser.close();
    process.exit(1);
  }
}

main().catch(function(err) { console.error('Fatal:', err); process.exit(1); });
