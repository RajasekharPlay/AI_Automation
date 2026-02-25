const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Generate a Playwright test script from a test case definition
 */
async function generateScript(testCase, domMap) {
  const hints = testCase._runtimeHints || {};
  const baseUrl = hints.baseUrl || 'https://skye1.dev.segurosb.innoveo-skye.net/page/banorteprivate/es/MX/index';
  const username = hints.loginUsername || 'rajasekhar.udumula+Ap1@innoveo.com';
  const password = hints.loginPassword || 'Test@1234';

  const domSection = domMap
    ? `\nPage DOM structure (interactive elements from crawl):\n${JSON.stringify(domMap, null, 2).substring(0, 3000)}`
    : '';

  const prompt = `You are a Playwright test automation expert.
Generate a complete runnable Playwright test script in JavaScript (CommonJS).

Test Case:
${JSON.stringify({ ...testCase, _runtimeHints: undefined }, null, 2)}
${domSection}

CRITICAL — SPA specifics you MUST follow:
1. Navigation: Use base URL: ${baseUrl}
   - Use waitUntil: 'domcontentloaded' and timeout: 60000 on page.goto()
2. Login credentials (use exactly as provided):
   - Username: ${username}
   - Password: ${password}
   - Username selector: input[name="username"]   (wait visible, timeout 30000)
   - Password selector: input[name="password"]
   - Login button: button.sk-button     (click via dispatchEvent)
3. Post-login wait: await page.waitForTimeout(4000) then waitForLoadState('networkidle', {timeout:30000}).catch(()=>{})
4. Navigation menu: a.sk-nav-menu
5. Zone icons: div[class="sk-nav-content "] li[id="sk-zone-ZONENAME"] i[role="img"]  (click via dispatchEvent)
6. ALL clicks MUST use dispatchEvent (NOT .click()):
   await locator.evaluate(function(el) { el.dispatchEvent(new MouseEvent('click', {bubbles:true,cancelable:true})); });
7. Always add .catch(function(){}) to waitForLoadState calls
8. After any navigation/click, wait 2000ms + networkidle before continuing

STRICT SELECTOR RULES — NEVER VIOLATE THESE:
- NEVER write comma-separated selectors like: 'input[name="username"], input[type="email"], #username'
  Playwright's waitForSelector does NOT retry across a list — it will FAIL if the first option doesn't exist.
- For the login username field use EXACTLY this — no alternatives, no fallbacks:
    await page.waitForSelector('input[name="username"]', { state: 'visible', timeout: 30000 });
    await page.fill('input[name="username"]', USERNAME);
- For the login password field use EXACTLY:
    await page.fill('input[name="password"]', PASSWORD);
- For ALL other selectors: use ONE selector only. If you are unsure, use the most specific single selector.
  Use separate sequential try/catch blocks if you want to try alternatives — NEVER put them in a comma list.

Requirements:
- Define async function runTest(page, testData) — no exports
- Return { passed: true } on success
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

/**
 * Classify the intent of a chat message.
 * Returns: { intent, entities, confidence }
 */
async function classifyIntent(message, context) {
  const prompt = `You are an intent classifier for a QA automation platform chatbot.

Classify this user message into exactly one intent and extract entities.

User message: "${message}"

Context (current page / project):
${JSON.stringify(context || {}, null, 2)}

Available intents:
- create_test       : user wants to create a new test case
- modify_test       : user wants to modify/update an existing test
- run_test          : user wants to run/execute tests
- analyze_failure   : user wants to understand why a test failed
- list_tests        : user wants to see/list test cases
- generate_plan     : user wants a test plan generated from URL/description
- crawl_dom         : user wants to crawl a URL to get page structure
- suggest_fix       : user wants suggestions to fix a test
- general_query     : general question about the platform or test results
- small_talk        : greeting or off-topic message

Return ONLY valid JSON (no markdown):
{
  "intent": "<intent_name>",
  "entities": {
    "testName": "<if mentioned>",
    "url": "<if mentioned>",
    "runId": "<if mentioned>",
    "testcaseId": "<if mentioned>",
    "environment": "<if mentioned>"
  },
  "confidence": 0.0-1.0,
  "reply_hint": "<one sentence describing what action to take>"
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    });
    let text = response.content[0].text.trim();
    text = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '');
    return JSON.parse(text);
  } catch (err) {
    console.error('Intent classifier error:', err.message);
    return { intent: 'general_query', entities: {}, confidence: 0.5, reply_hint: 'Answer the user question' };
  }
}

/**
 * Generate a structured test plan from a description + optional DOM map.
 * Returns: { steps: [...], assertions: [...], notes: string }
 */
async function generateTestPlan(description, domMap, credentialHint) {
  const prompt = `You are a QA test architect. Generate a structured test plan.

Test description: ${description}

${domMap ? `Page DOM structure (interactive elements):
${JSON.stringify(domMap, null, 2).substring(0, 3000)}` : ''}

${credentialHint ? `Login required: Yes (credentials will be injected at runtime — DO NOT include actual values)` : ''}

Return ONLY valid JSON (no markdown):
{
  "name": "<test name>",
  "steps": [
    { "index": 1, "action": "navigate", "target": "<url>", "description": "..." },
    { "index": 2, "action": "login", "description": "Login with provided credentials" },
    { "index": 3, "action": "click", "selector": "<selector>", "description": "..." },
    { "index": 4, "action": "fill", "selector": "<selector>", "value": "<value>", "description": "..." },
    { "index": 5, "action": "assert_visible", "selector": "<selector>", "description": "..." }
  ],
  "assertions": ["<list of expected outcomes>"],
  "estimated_duration_ms": 60000,
  "notes": "<any important implementation notes>"
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }]
    });
    let text = response.content[0].text.trim();
    text = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '');
    return JSON.parse(text);
  } catch (err) {
    console.error('Test plan generation error:', err.message);
    return null;
  }
}

/**
 * Generate a conversational response for the chatbot.
 */
async function chatReply(messages, systemContext) {
  const systemPrompt = `You are REXON AI, a helpful QA automation assistant built into the REXON platform.
You help users create test cases, analyze failures, trigger test runs, and improve test reliability.
Be concise, practical, and technical. Use markdown formatting for code blocks.
${systemContext ? `\nCurrent context:\n${JSON.stringify(systemContext, null, 2)}` : ''}`;

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1500,
      system: systemPrompt,
      messages
    });
    return response.content[0].text.trim();
  } catch (err) {
    console.error('Chat reply error:', err.message);
    return 'Sorry, I encountered an error. Please try again.';
  }
}

module.exports = { generateScript, healSelector, classifyIntent, generateTestPlan, chatReply };
