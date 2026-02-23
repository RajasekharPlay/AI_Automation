const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Generate a Playwright test script from a test case definition
 */
async function generateScript(testCase) {
  const prompt = `You are a Playwright test automation expert for the Innoveo Skye insurance platform.
Generate a complete runnable Playwright test script in JavaScript (CommonJS).

Test Case:
${JSON.stringify(testCase, null, 2)}

CRITICAL — Skye SPA specifics you MUST follow:
1. Navigation: ALWAYS use this exact base URL: https://skye1.dev.segurosb.innoveo-skye.net/page/banorteprivate/es/MX/index
   - Use waitUntil: 'domcontentloaded' and timeout: 60000 on page.goto()
   - This URL auto-redirects to WS-Fed login. NEVER navigate directly to WS-Fed/idp URLs.
2. Login selectors (exact, no alternatives):
   - Username: input[name="username"]   (wait visible, timeout 30000)
   - Password: input[name="password"]
   - Login button: button.sk-button     (click via dispatchEvent, see below)
3. Post-login wait: await page.waitForTimeout(4000) then waitForLoadState('networkidle', {timeout:30000}).catch(()=>{})
4. Navigation menu: a.sk-nav-menu  (wait visible, then .click())
5. Zone icons: div[class="sk-nav-content "] li[id="sk-zone-ZONENAME"] i[role="img"]  (click via dispatchEvent)
6. All clicks MUST use dispatchEvent (NOT .click()):
   await locator.evaluate(function(el) { el.dispatchEvent(new MouseEvent('click', {bubbles:true,cancelable:true})); });
7. Always add .catch(function(){}) to waitForLoadState calls — they may time out on SPAs
8. After any navigation/click, wait 2000ms + networkidle before continuing
9. Login credentials: rajasekhar.udumula+Ap1@innoveo.com / Test@1234

Requirements:
- Define async function runTest(page, testData) — no exports
- Return { passed: true } on success
- Use exact selectors from the test case steps
- All timeouts minimum 20000ms for selector waits, 30000ms for critical steps

Return ONLY the JavaScript function, no markdown, no explanation.`;

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }]
  });

  let script = response.content[0].text.trim();
  // Strip markdown code blocks if present
  script = script.replace(/^```(?:javascript|js)?\n?/m, '').replace(/\n?```$/m, '');
  return script;
}

/**
 * Claude Healing Agent — fixes broken selectors using DOM snapshot
 */
async function healSelector(failedSelector, domSnapshot, errorMessage, originalScript) {
  const truncatedDom = domSnapshot.substring(0, 2000);

  const prompt = `You are a Playwright self-healing agent. A test failed due to a selector issue.

Failed selector: ${failedSelector}
Error: ${errorMessage}

Current page DOM (truncated):
${truncatedDom}

Original script:
${originalScript}

Analyze the DOM and suggest a fix. Return a JSON object ONLY (no markdown):
{
  "newSelector": "the corrected CSS/XPath/text selector",
  "reason": "brief explanation of why the original failed and what changed",
  "patchedScript": "the complete fixed script with the new selector applied"
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    let text = response.content[0].text.trim();
    text = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '');
    return JSON.parse(text);
  } catch (err) {
    console.error('Healing agent error:', err.message);
    return null;
  }
}

module.exports = { generateScript, healSelector };
