const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Generate a Playwright test script from a test case definition
 */
async function generateScript(testCase) {
  const prompt = `You are a Playwright test automation expert. Generate a complete, runnable Playwright test script in JavaScript (CommonJS) for the following test case.

Test Case:
${JSON.stringify(testCase, null, 2)}

Requirements:
- Use Playwright's page object
- Export an async function called "runTest" that accepts (page, testData)
- Handle waits properly with waitForSelector or waitForLoadState
- Use data-testid selectors when possible, fall back to semantic selectors
- Add proper error handling
- Return { passed: true } on success

Return ONLY the JavaScript code, no markdown, no explanation.

Example format:
async function runTest(page, testData) {
  await page.goto(testData.url || '${testCase.url || 'https://example.com'}');
  // ... test steps
  return { passed: true };
}
module.exports = { runTest };`;

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2000,
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
  const truncatedDom = domSnapshot.substring(0, 4000);

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
      max_tokens: 2000,
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
